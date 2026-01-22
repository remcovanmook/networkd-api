package service

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/godbus/dbus/v5"
)

type LocalConnector struct {
	ConfigDir string
	Conn      *dbus.Conn
}

func NewLocalConnector(configDir string, conn *dbus.Conn) *LocalConnector {
	return &LocalConnector{
		ConfigDir: configDir,
		Conn:      conn,
	}
}

func (c *LocalConnector) ListConfigDir(suffix string) ([]os.DirEntry, error) {
	entries, err := os.ReadDir(c.ConfigDir)
	if err != nil {
		return nil, err
	}
	// Filter logic is usually in Service, but Service expects ReadDir result
	// Service filters by suffix. So just returning all entries is fine?
	// But `os.DirEntry` is local type. Remote needs to allow abstraction.
	// `os.DirEntry` is interface, so it works locally. Remote implementation needs to support it or return struct matching it.
	// Actually `os.DirEntry` is hard to serialize/implement for custom types comfortably?
	// It's just Name(), IsDir(), Type(), Info().
	return entries, nil
}

func (c *LocalConnector) ReadConfigFile(filename string) ([]byte, error) {
	return os.ReadFile(filepath.Join(c.ConfigDir, filename))
}

func (c *LocalConnector) WriteConfigFile(filename string, content []byte) error {
	return os.WriteFile(filepath.Join(c.ConfigDir, filename), content, 0644)
}

func (c *LocalConnector) DeleteConfigFile(filename string) error {
	return os.Remove(filepath.Join(c.ConfigDir, filename))
}

func (c *LocalConnector) Reconfigure(devices []string) error {
	args := []string{"reconfigure"}
	if len(devices) > 0 {
		args = append(args, devices...)
	}
	cmd := exec.Command("networkctl", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("networkctl failed: %s (%w)", string(output), err)
	}
	return nil
}

func (c *LocalConnector) GetLinks() ([]Link, error) {
	if c.Conn == nil {
		// Mock/Fallback for MacOS dev
		return []Link{
			{Index: 1, Name: "lo", OperationalState: "carrier", NetworkFile: "", Addresses: []string{"127.0.0.1/8", "::1/128"}},
			{Index: 2, Name: "eth0", OperationalState: "routable", NetworkFile: "10-eth0.network", Addresses: []string{"192.168.1.5/24", "fe80::1/64"}},
		}, nil
	}

	obj := c.Conn.Object("org.freedesktop.network1", "/org/freedesktop/network1")
	var result [][]interface{}
	err := obj.Call("org.freedesktop.network1.Manager.ListLinks", 0).Store(&result)
	if err != nil {
		return nil, fmt.Errorf("failed to call ListLinks: %w", err)
	}

	var links []Link
	for _, linkData := range result {
		if len(linkData) < 2 {
			continue
		}
		idx, ok1 := linkData[0].(int32)
		name, ok2 := linkData[1].(string)
		if !ok1 || !ok2 {
			continue
		}

		link := Link{
			Index:            int(idx),
			Name:             name,
			OperationalState: "unknown",
			Addresses:        []string{},
		}

		// DBus doesn't give addresses directly in ListLinks, usually separate call or GetLink request.
		// Original code used net.InterfaceByIndex for local addresses.
		// For remote, this won't work easily (GetLinks via SSH networkctl list gives some info).
		// Local connector using `net` package is fine.
		if iface, err := net.InterfaceByIndex(int(idx)); err == nil {
			if addrs, err := iface.Addrs(); err == nil {
				for _, addr := range addrs {
					link.Addresses = append(link.Addresses, addr.String())
				}
			}
		}
		links = append(links, link)
	}
	return links, nil
}

func (c *LocalConnector) GetSystemdVersion() string {
	// Not easily retrievable via simple command without parsing?
	// Used to be Schema.SystemdVersion.
	// For now return empty or implement parsing `networkctl --version`.
	return ""
}

func (c *LocalConnector) GetGlobalConfig() (string, error) {
	content, err := os.ReadFile("/etc/systemd/networkd.conf")
	if err != nil {
		if os.IsNotExist(err) {
			return "# /etc/systemd/networkd.conf\n# No configuration file found.\n", nil
		}
		return "", err
	}
	return string(content), nil
}

func (c *LocalConnector) SaveGlobalConfig(content string) error {
	return os.WriteFile("/etc/systemd/networkd.conf", []byte(content), 0644)
}

func (c *LocalConnector) ReloadNetworkd() (string, error) {
	cmd := exec.Command("networkctl", "reload")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (c *LocalConnector) GetRoutes() (string, error) {
	cmd := exec.Command("ip", "route", "show", "table", "all")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (c *LocalConnector) GetRules() (string, error) {
	cmd := exec.Command("ip", "rule", "show")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (c *LocalConnector) GetLogs() (string, error) {
	cmd := exec.Command("journalctl", "-u", "systemd-networkd", "-n", "100", "--no-pager")
	out, err := cmd.CombinedOutput()
	return string(out), err
}
