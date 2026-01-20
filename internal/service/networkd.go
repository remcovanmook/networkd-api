package service

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/godbus/dbus/v5"
)

type Link struct {
	Index            int      `json:"index"`
	Name             string   `json:"name"`
	OperationalState string   `json:"operational_state"`
	NetworkFile      string   `json:"network_file"`
	Addresses        []string `json:"addresses"`
}

type NetworkdService struct {
	ConfigDir        string
	GlobalConfigPath string
	conn             *dbus.Conn
}

func NewNetworkdService(configDir string) *NetworkdService {
	// Default to /etc/systemd/network if not specified,
	// but for development on non-Linux, we might want a safer default or expect the caller to set it.
	if configDir == "" {
		configDir = "/etc/systemd/network"
	}

	// Default global config path
	globalConfigPath := "/etc/systemd/networkd.conf"
	// Allow override via env for dev
	if env := os.Getenv("NETWORKD_GLOBAL_CONFIG"); env != "" {
		globalConfigPath = env
	} else if configDir != "/etc/systemd/network" {
		// If using custom config dir (dev mode), try to place networkd.conf nearby or in tmp
		globalConfigPath = filepath.Join(filepath.Dir(configDir), "networkd.conf")
	}

	var conn *dbus.Conn
	var err error
	if runtime.GOOS == "linux" {
		conn, err = dbus.SystemBus()
		if err != nil {
			fmt.Printf("Failed to connect to SystemBus: %v\n", err)
		}
	}

	return &NetworkdService{
		ConfigDir:        configDir,
		GlobalConfigPath: globalConfigPath,
		conn:             conn,
	}
}

// ListLinks retrieves a list of network links from systemd-networkd via D-Bus.
func (s *NetworkdService) ListLinks() ([]Link, error) {
	if s.conn == nil {
		// Mock data for non-Linux dev environments
		return []Link{
			{Index: 1, Name: "lo", OperationalState: "carrier", NetworkFile: "", Addresses: []string{"127.0.0.1/8", "::1/128"}},
			{Index: 2, Name: "eth0", OperationalState: "routable", NetworkFile: "10-eth0.network", Addresses: []string{"192.168.1.5/24", "fe80::1/64"}},
			{Index: 3, Name: "wlan0", OperationalState: "degraded", NetworkFile: "", Addresses: []string{}},
		}, nil
	}

	var links []Link

	// Check against org.freedesktop.network1.Manager interface
	obj := s.conn.Object("org.freedesktop.network1", "/org/freedesktop/network1")

	var result [][]interface{}
	// ListLinks returns array of structs: (int index, string name, object_path path)
	err := obj.Call("org.freedesktop.network1.Manager.ListLinks", 0).Store(&result)
	if err != nil {
		return nil, fmt.Errorf("failed to call ListLinks: %w", err)
	}

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

		// Fetch Runtime Addresses via Go net package
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

type ConfigSummary struct {
	DHCP    string   `json:"dhcp,omitempty"`
	Address []string `json:"address,omitempty"`
	DNS     []string `json:"dns,omitempty"`
	VLAN    []string `json:"vlan,omitempty"`
	VlanId  *int     `json:"vlan_id,omitempty"`
}

type FileInfo struct {
	Filename         string         `json:"filename"`
	Type             string         `json:"type"` // "network" or "netdev"
	NetDevKind       string         `json:"netdev_kind,omitempty"`
	NetDevName       string         `json:"netdev_name,omitempty"`
	NetworkMatchName string         `json:"network_match_name,omitempty"`
	Summary          *ConfigSummary `json:"summary,omitempty"`
}

// MatchCriteria defines filters for listing configs
type MatchCriteria struct {
	Name       string
	MACAddress string
	Type       string
}

// matches checks if the config match section satisfies the criteria
// matches checks if the config match section satisfies the criteria
func (c *MatchCriteria) matches(matchName []string, matchMAC []string, matchType []string) bool {
	if c.Name != "" {
		found := false
		for _, name := range matchName {
			if name == c.Name {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if c.MACAddress != "" {
		found := false
		for _, mac := range matchMAC {
			if strings.EqualFold(mac, c.MACAddress) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if c.Type != "" {
		found := false
		for _, typ := range matchType {
			if strings.EqualFold(typ, c.Type) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// ListNetDevs returns a list of .netdev files with metadata
func (s *NetworkdService) ListNetDevs() ([]FileInfo, error) {
	return s.listFiles(".netdev", nil)
}

// ListNetworkConfigs returns a list of .network files with metadata (optional filter)
func (s *NetworkdService) ListNetworkConfigs(criteria *MatchCriteria) ([]FileInfo, error) {
	return s.listFiles(".network", criteria)
}

// ListLinkConfigs returns a list of .link files with metadata (optional filter)
func (s *NetworkdService) ListLinkConfigs(criteria *MatchCriteria) ([]FileInfo, error) {
	return s.listFiles(".link", criteria)
}

// listFiles is a helper to list files by suffix
func (s *NetworkdService) listFiles(suffix string, criteria *MatchCriteria) ([]FileInfo, error) {
	var files []FileInfo
	entries, err := os.ReadDir(s.ConfigDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read config dir: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			if strings.HasSuffix(name, suffix) {
				if suffix == ".network" {
					info := FileInfo{Filename: name, Type: "network"}
					content, err := s.ReadNetworkFile(name)
					if err == nil {
						cfg, _ := ParseNetworkConfig(content)
						if cfg != nil {
							// Apply Filter if present
							if criteria != nil {
								if !criteria.matches(cfg.Match.Name, cfg.Match.MACAddress, cfg.Match.Type) {
									continue
								}
							}

							if len(cfg.Match.Name) > 0 {
								info.NetworkMatchName = strings.Join(cfg.Match.Name, ", ")
							}
							info.Summary = &ConfigSummary{
								DHCP:    cfg.Network.DHCP,
								Address: cfg.Network.Address,
								DNS:     cfg.Network.DNS,
								VLAN:    cfg.Network.VLAN,
							}
						}
					}
					files = append(files, info)
				} else if suffix == ".netdev" {
					// NetDevs don't really have Match sections
					info := FileInfo{Filename: name, Type: "netdev"}
					content, err := s.ReadNetworkFile(name)
					if err == nil {
						cfg, _ := ParseNetDevConfig(content)
						if cfg != nil {
							info.NetDevKind = cfg.NetDev.Kind
							info.NetDevName = cfg.NetDev.Name
							info.Summary = &ConfigSummary{}
							if cfg.VLAN != nil {
								id := cfg.VLAN.Id
								info.Summary.VlanId = &id
							}
						}
					}
					files = append(files, info)
				} else if suffix == ".link" {
					info := FileInfo{Filename: name, Type: "link"}
					content, err := s.ReadNetworkFile(name)
					if err == nil {
						cfg, _ := ParseLinkConfig(content)
						if cfg != nil {
							// Apply Filter if present
							if criteria != nil {
								if !criteria.matches(cfg.Match.Name, cfg.Match.MACAddress, cfg.Match.Type) {
									continue
								}
							}

							// For link files, we might want to show what they match
							if len(cfg.Match.Name) > 0 {
								info.NetworkMatchName = "Match: " + strings.Join(cfg.Match.Name, ", ")
							} else if len(cfg.Match.MACAddress) > 0 {
								info.NetworkMatchName = "Match: " + strings.Join(cfg.Match.MACAddress, ", ")
							}
							info.Summary = &ConfigSummary{}
						}
					}
					files = append(files, info)
				}
			}
		}
	}
	return files, nil
}

// ReadNetworkFile reads the content of a specific file
func (s *NetworkdService) ReadNetworkFile(filename string) (string, error) {
	// Security check to prevent path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		return "", fmt.Errorf("invalid filename")
	}
	path := filepath.Join(s.ConfigDir, filename)
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// WriteNetworkFile writes content to a file
func (s *NetworkdService) WriteNetworkFile(filename string, content string) error {
	// Security check
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		return fmt.Errorf("invalid filename")
	}
	path := filepath.Join(s.ConfigDir, filename)
	return os.WriteFile(path, []byte(content), 0644)
}

// DeleteNetworkFile deletes a file
func (s *NetworkdService) DeleteNetworkFile(filename string) error {
	// Security check
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		return fmt.Errorf("invalid filename")
	}
	path := filepath.Join(s.ConfigDir, filename)
	return os.Remove(path)
}

// GetViewConfig reads the UI layout configuration
func (s *NetworkdService) GetViewConfig() ([]byte, error) {
	// Look for .schema-config.json in the config directory
	path := filepath.Join(s.ConfigDir, ".schema-config.json")
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return content, nil
}

// SaveViewConfig saves the UI layout configuration
func (s *NetworkdService) SaveViewConfig(content []byte) error {
	// Validate JSON?
	if !json.Valid(content) {
		return fmt.Errorf("invalid json")
	}
	path := filepath.Join(s.ConfigDir, ".schema-config.json")
	fmt.Printf("Saving view config to: %s\n", path)
	return os.WriteFile(path, content, 0644)
}
