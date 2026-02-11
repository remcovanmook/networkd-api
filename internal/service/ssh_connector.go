package service

import (
	"bytes" // Added for bytes.NewReader
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SSHConnector struct {
	Host      string
	Port      int
	User      string
	KeyFile   string
	Client    *ssh.Client
	SFTP      *sftp.Client
	ConfigDir string // Remote config dir, e.g. /etc/systemd/network
}

// shellQuote wraps a string in single quotes for safe use in shell commands,
// escaping any embedded single quotes.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

func NewSSHConnector(host string, port int, user, keyFile string) *SSHConnector {
	return &SSHConnector{
		Host:      host,
		Port:      port,
		User:      user,
		KeyFile:   keyFile,
		ConfigDir: "/etc/systemd/network",
	}
}

func (c *SSHConnector) connect() error {
	if c.Client != nil && c.SFTP != nil {
		return nil // Already connected (todo: check liveness)
	}

	key, err := os.ReadFile(c.KeyFile)
	if err != nil {
		return fmt.Errorf("unable to read private key: %v", err)
	}

	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return fmt.Errorf("unable to parse private key: %v", err)
	}

	config := &ssh.ClientConfig{
		User: c.User,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: manage known_hosts
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("failed to dial: %v", err)
	}

	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		client.Close()
		return fmt.Errorf("failed to create sftp client: %v", err)
	}

	c.Client = client
	c.SFTP = sftpClient
	return nil
}

func (c *SSHConnector) Close() {
	if c.SFTP != nil {
		c.SFTP.Close()
	}
	if c.Client != nil {
		c.Client.Close()
	}
}

// Wrapper to ensure connection
func (c *SSHConnector) ensureConnected() error {
	return c.connect()
}

func (c *SSHConnector) ListConfigDir(suffix string) ([]os.DirEntry, error) {
	if err := c.ensureConnected(); err != nil {
		return nil, err
	}
	// SFTP ReadDir returns []os.FileInfo
	infos, err := c.SFTP.ReadDir(c.ConfigDir)
	if err != nil {
		return nil, err
	}

	var entries []os.DirEntry
	for _, info := range infos {
		// fs.FileInfoToDirEntry is generic, but not available in old Go? Go 1.25 should have it?
		// or simpler wrapper
		entries = append(entries, fs.FileInfoToDirEntry(info))
	}
	return entries, nil
}

func (c *SSHConnector) ReadConfigFile(filename string) ([]byte, error) {
	if err := c.ensureConnected(); err != nil {
		return nil, err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	remotePath := filepath.Join(c.ConfigDir, filename)
	cmd := fmt.Sprintf("sudo cat -- %s", shellQuote(remotePath))
	return session.Output(cmd)
}

func (c *SSHConnector) WriteConfigFile(filename string, content []byte) error {
	if err := c.ensureConnected(); err != nil {
		return err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	session.Stdin = bytes.NewReader(content)
	remotePath := filepath.Join(c.ConfigDir, filename)
	cmd := fmt.Sprintf("sudo tee -- %s > /dev/null", shellQuote(remotePath))
	if err := session.Run(cmd); err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}
	return nil
}

func (c *SSHConnector) DeleteConfigFile(filename string) error {
	if err := c.ensureConnected(); err != nil {
		return err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	remotePath := filepath.Join(c.ConfigDir, filename)
	cmd := fmt.Sprintf("sudo rm -- %s", shellQuote(remotePath))
	return session.Run(cmd)
}

func (c *SSHConnector) Reconfigure(devices []string) error {
	if err := c.ensureConnected(); err != nil {
		return err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	cmd := "sudo networkctl reconfigure"
	if len(devices) > 0 {
		for _, d := range devices {
			cmd += " " + shellQuote(d)
		}
	}

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return fmt.Errorf("remote networkctl failed: %s (%w)", string(output), err)
	}
	return nil
}

type networkctlLink struct {
	Index            int    `json:"Index"`
	Name             string `json:"Name"`
	OperationalState string `json:"OperationalState"`
	NetworkFile      string `json:"NetworkFile"`
}

type ipAddress struct {
	IfIndex  int `json:"ifindex"`
	AddrInfo []struct {
		Local string `json:"local"`
	} `json:"addr_info"`
}

func (c *SSHConnector) GetLinks() ([]Link, error) {
	if err := c.ensureConnected(); err != nil {
		return nil, err
	}

	// 1. Fetch Links via networkctl
	var links []Link
	useJSON := true

	session, err := c.Client.NewSession()
	if err != nil {
		return nil, err
	}
	// Try JSON first
	jsonOut, err := session.Output("networkctl list --json=short")
	session.Close()

	if err == nil {
		var nLinks []networkctlLink
		if err := json.Unmarshal(jsonOut, &nLinks); err == nil {
			for _, nl := range nLinks {
				links = append(links, Link{
					Index:            nl.Index,
					Name:             nl.Name,
					OperationalState: nl.OperationalState,
					NetworkFile:      nl.NetworkFile,
				})
			}
		} else {
			useJSON = false
		}
	} else {
		useJSON = false
	}

	if !useJSON {
		// Fallback to text parsing
		session, err = c.Client.NewSession()
		if err != nil {
			return nil, err
		}
		txtOut, err := session.Output("networkctl list --no-legend")
		session.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to list links: %v", err)
		}

		// Text format: IDX LINK TYPE OPERATIONAL SETUP
		//              1 lo loopback carrier unmanaged
		lines := strings.Split(string(txtOut), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 5 {
				// fields[0] might contain the bullet point if not careful, but --no-legend helps
				// usually: "  1 lo ..." -> fields: ["1", "lo", ...]
				var idx int
				fmt.Sscanf(fields[0], "%d", &idx)
				if idx > 0 {
					links = append(links, Link{
						Index:            idx,
						Name:             fields[1],
						OperationalState: fields[3],
					})
				}
			}
		}
	}

	// 2. Fetch Addresses via ip -j addr
	session, err = c.Client.NewSession()
	if err == nil {
		defer session.Close()
		ipOut, err := session.Output("ip -j addr")
		if err == nil {
			var ipAddrs []ipAddress
			if err := json.Unmarshal(ipOut, &ipAddrs); err == nil {
				// Map addresses to links
				addrMap := make(map[int][]string)
				for _, ip := range ipAddrs {
					for _, info := range ip.AddrInfo {
						addrMap[ip.IfIndex] = append(addrMap[ip.IfIndex], info.Local)
					}
				}
				// Merge into links
				for i := range links {
					if addrs, ok := addrMap[links[i].Index]; ok {
						links[i].Addresses = addrs
					}
				}
			}
		}
	}

	return links, nil
}

func (c *SSHConnector) GetSystemdVersion() string {
	if err := c.ensureConnected(); err != nil {
		return ""
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return ""
	}
	defer session.Close()

	out, err := session.Output("networkctl --version | head -n1 | awk '{print $2}'")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (c *SSHConnector) GetGlobalConfig() (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.Output("sudo cat /etc/systemd/networkd.conf")
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (c *SSHConnector) SaveGlobalConfig(content string) error {
	if err := c.ensureConnected(); err != nil {
		return err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	session.Stdin = strings.NewReader(content)
	// sudo tee
	if err := session.Run("sudo tee /etc/systemd/networkd.conf > /dev/null"); err != nil {
		return fmt.Errorf("failed to write global config: %v", err)
	}
	return nil
}

func (c *SSHConnector) ReloadNetworkd() (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.CombinedOutput("sudo networkctl reload")
	return string(out), err
}

func (c *SSHConnector) GetRoutes() (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.Output("ip route show")
	return string(out), err
}

func (c *SSHConnector) GetRules() (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.Output("ip rule show")
	return string(out), err
}

func (c *SSHConnector) GetLogs() (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}
	session, err := c.Client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.Output("journalctl -u systemd-networkd -n 100 --no-pager")
	return string(out), err
}
