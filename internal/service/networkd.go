package service

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/godbus/dbus/v5"
	"github.com/santhosh-tekuri/jsonschema/v6"
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
	DataDir          string
	Schema           *SchemaService

	LocalConnector   *LocalConnector
	HostManager      *HostManager
	RemoteConnectors map[string]*SSHConnector
	connsMu          sync.Mutex
}

func NewNetworkdService(configDir, dataDir string) *NetworkdService {
	// Default values
	if configDir == "" {
		configDir = "/etc/systemd/network"
	}
	if dataDir == "" {
		dataDir = "/var/lib/networkd-api"
	}

	// Ensure DataDir exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		fmt.Printf("Warning: Failed to create DataDir %s: %v\n", dataDir, err)
	}

	// Ensure SSH Key
	if err := ensureSSHKey(dataDir); err != nil {
		fmt.Printf("Warning: Failed to generate SSH key: %v\n", err)
	}

	globalConfigPath := "/etc/systemd/networkd.conf"
	if env := os.Getenv("NETWORKD_GLOBAL_CONFIG"); env != "" {
		globalConfigPath = env
	} else if configDir != "/etc/systemd/network" {
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

	// Initialize Schema Service
	// Use local schemas directory (symlinked to submodule) or env override
	schemaBase := "schemas"
	if env := os.Getenv("NETWORKD_SCHEMA_DIR"); env != "" {
		schemaBase = env
	} else if _, err := os.Stat(schemaBase); os.IsNotExist(err) {
		// Fallback... but now we expect it in project.
		// We still keep fallback for robust dev env if symlink missing?
		homeDir, _ := os.UserHomeDir()
		schemaBase = filepath.Join(homeDir, "networkd-schema", "schemas")
	}

	sService, err := NewSchemaService(schemaBase)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize SchemaService: %v. Validation will be limited.\n", err)
		// We can still proceed but maybe with empty schemas?
		sService = &SchemaService{
			Schemas:            make(map[string]map[string]interface{}),
			TypeCache:          make(map[string]map[string]map[string]TypeInfo),
			RepeatableSections: make(map[string]map[string]bool),
			Validators:         make(map[string]*jsonschema.Schema),
		}
	} else {
		fmt.Printf("Initialized SchemaService: Systemd=%s, Schema=%s\n", sService.RealVersion, sService.LoadedVersion)
	}

	localConnector := NewLocalConnector(configDir, conn)
	hostManager, _ := NewHostManager(dataDir) // Ignore error? Log it?

	return &NetworkdService{
		ConfigDir:        configDir,
		GlobalConfigPath: globalConfigPath,
		DataDir:          dataDir,
		Schema:           sService,
		LocalConnector:   localConnector,
		HostManager:      hostManager,
		RemoteConnectors: make(map[string]*SSHConnector),
	}
}

func (s *NetworkdService) GetConnector(host string) (Connector, error) {
	if host == "" || host == "local" {
		return s.LocalConnector, nil
	}

	s.connsMu.Lock()
	defer s.connsMu.Unlock()

	if conn, ok := s.RemoteConnectors[host]; ok {
		return conn, nil
	}

	// Create new
	cfg, ok := s.HostManager.GetHost(host)
	if !ok {
		return nil, fmt.Errorf("unknown host: %s", host)
	}

	keyFile := filepath.Join(s.DataDir, "id_rsa")
	conn := NewSSHConnector(cfg.Host, cfg.Port, cfg.User, keyFile)
	s.RemoteConnectors[host] = conn
	return conn, nil
}

// ListLinks retrieves runtime links
func (s *NetworkdService) ListLinks(host string) ([]Link, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return nil, err
	}
	return c.GetLinks()
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
	Type             string         `json:"type"`
	NetDevKind       string         `json:"netdev_kind,omitempty"`
	NetDevName       string         `json:"netdev_name,omitempty"`
	NetworkMatchName string         `json:"network_match_name,omitempty"`
	Summary          *ConfigSummary `json:"summary,omitempty"`
}

type MatchCriteria struct {
	Name       string
	MACAddress string
	Type       string
}

func (c *MatchCriteria) matches(matchName interface{}, matchMAC interface{}, matchType interface{}) bool {
	// Helper to convert interface{} to []string
	toStringSlice := func(v interface{}) []string {
		if s, ok := v.(string); ok {
			return []string{s}
		}
		if s, ok := v.([]string); ok {
			return s
		}
		if list, ok := v.([]interface{}); ok {
			var res []string
			for _, item := range list {
				res = append(res, fmt.Sprintf("%v", item))
			}
			return res
		}
		return nil
	}

	matchNames := toStringSlice(matchName)
	matchMACs := toStringSlice(matchMAC)
	matchTypes := toStringSlice(matchType)

	if c.Name != "" {
		found := false
		for _, name := range matchNames {
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
		for _, mac := range matchMACs {
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
		for _, typ := range matchTypes {
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

// List methods
func (s *NetworkdService) ListNetDevs(host string) ([]FileInfo, error) {
	return s.listFiles(host, ".netdev", nil)
}

func (s *NetworkdService) ListNetworkConfigs(host string, criteria *MatchCriteria) ([]FileInfo, error) {
	return s.listFiles(host, ".network", criteria)
}

func (s *NetworkdService) ListLinkConfigs(host string, criteria *MatchCriteria) ([]FileInfo, error) {
	return s.listFiles(host, ".link", criteria)
}

func (s *NetworkdService) listFiles(host, suffix string, criteria *MatchCriteria) ([]FileInfo, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return nil, err
	}
	files := []FileInfo{}
	entries, err := c.ListConfigDir("")
	if err != nil {
		return nil, fmt.Errorf("failed to read config dir: %w", err)
	}

	configType := "network"
	if suffix == ".netdev" {
		configType = "netdev"
	}
	if suffix == ".link" {
		configType = "link"
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), suffix) {
			info := FileInfo{Filename: entry.Name(), Type: configType}
			content, err := s.ReadNetworkFile(host, entry.Name())
			if err == nil {
				// Parse using dynamic converter
				cfg, _ := INIToMap(content, s.Schema, configType)
				if cfg != nil {
					// Extract Summary Data from Map
					// Since it's a map, we need safe access helpers or just direct map access
					// cfg["Match"] -> map, ["Name"] -> value

					var matchName, matchMAC, matchType interface{}
					if match, ok := cfg["Match"].(map[string]interface{}); ok {
						matchName = match["Name"]
						matchMAC = match["MACAddress"]
						matchType = match["Type"]
					}

					if criteria != nil && !criteria.matches(matchName, matchMAC, matchType) {
						continue
					}

					// Populate Info
					if matchNameSlice, ok := matchName.([]string); ok {
						info.NetworkMatchName = strings.Join(matchNameSlice, ", ")
					} else if s, ok := matchName.(string); ok {
						info.NetworkMatchName = s
					}

					info.Summary = &ConfigSummary{}

					if configType == "network" {
						if netSec, ok := cfg["Network"].(map[string]interface{}); ok {
							info.Summary.DHCP = fmt.Sprintf("%v", netSec["DHCP"])
							// Address, DNS usually arrays
							if addrs, ok := netSec["Address"].([]interface{}); ok {
								for _, a := range addrs {
									info.Summary.Address = append(info.Summary.Address, fmt.Sprintf("%v", a))
								}
							}
							if dnss, ok := netSec["DNS"].([]interface{}); ok {
								for _, d := range dnss {
									info.Summary.DNS = append(info.Summary.DNS, fmt.Sprintf("%v", d))
								}
							}
						}
					} else if configType == "netdev" {
						if ndSec, ok := cfg["NetDev"].(map[string]interface{}); ok {
							info.NetDevKind = fmt.Sprintf("%v", ndSec["Kind"])
							info.NetDevName = fmt.Sprintf("%v", ndSec["Name"])
						}
					}
				}
			}
			files = append(files, info)
		}
	}
	return files, nil
}

func (s *NetworkdService) ReadNetworkFile(host, filename string) (string, error) {
	if strings.Contains(filename, "..") {
		return "", fmt.Errorf("invalid filename")
	}
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	content, err := c.ReadConfigFile(filename)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (s *NetworkdService) WriteNetworkFile(host, filename string, content string) error {
	if strings.Contains(filename, "..") {
		return fmt.Errorf("invalid filename")
	}
	// TODO: Write validation logic here or earlier?
	// Handlers usually do validation. Here we just write.
	c, err := s.GetConnector(host)
	if err != nil {
		return err
	}
	return c.WriteConfigFile(filename, []byte(content))
}

func (s *NetworkdService) DeleteNetworkFile(host, filename string) error {
	if strings.Contains(filename, "..") {
		return fmt.Errorf("invalid filename")
	}
	c, err := s.GetConnector(host)
	if err != nil {
		return err
	}
	return c.DeleteConfigFile(filename)
}

func (s *NetworkdService) Reconfigure(host string, devices []string) error {
	c, err := s.GetConnector(host)
	if err != nil {
		return err
	}
	return c.Reconfigure(devices)
}

func ensureSSHKey(dataDir string) error {
	keyPath := filepath.Join(dataDir, "id_rsa")
	if _, err := os.Stat(keyPath); err == nil {
		return nil // exists
	}

	// Generate
	// Note: ssh-keygen might output to stdout/stderr
	cmd := exec.Command("ssh-keygen", "-t", "rsa", "-b", "4096", "-f", keyPath, "-N", "")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ssh-keygen failed: %s (%v)", string(output), err)
	}
	return nil
}

func (s *NetworkdService) GetPublicSSHKey() (string, error) {
	keyPath := filepath.Join(s.DataDir, "id_rsa.pub")
	content, err := os.ReadFile(keyPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (s *NetworkdService) GetSystemdVersion(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	v := c.GetSystemdVersion()
	if v != "" {
		return v, nil
	}
	// Fallback for local if connector returns empty (LocalConnector currently does)
	if host == "" || host == "local" {
		return s.Schema.RealVersion, nil
	}
	return "unknown", nil
}

func (s *NetworkdService) GetViewConfig() ([]byte, error) {
	path := filepath.Join(s.DataDir, "frontend-prefs.json")
	return os.ReadFile(path)
}

func (s *NetworkdService) SaveViewConfig(content []byte) error {
	if !json.Valid(content) {
		return fmt.Errorf("invalid json")
	}
	path := filepath.Join(s.DataDir, "frontend-prefs.json")
	return os.WriteFile(path, content, 0644)
}

func (s *NetworkdService) GetGlobalConfig(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	return c.GetGlobalConfig()
}

func (s *NetworkdService) SaveGlobalConfig(host, content string) error {
	c, err := s.GetConnector(host)
	if err != nil {
		return err
	}
	return c.SaveGlobalConfig(content)
}

func (s *NetworkdService) ReloadNetworkd(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	return c.ReloadNetworkd()
}

func (s *NetworkdService) GetRoutes(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	return c.GetRoutes()
}

func (s *NetworkdService) GetRules(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	return c.GetRules()
}

func (s *NetworkdService) GetLogs(host string) (string, error) {
	c, err := s.GetConnector(host)
	if err != nil {
		return "", err
	}
	return c.GetLogs()
}
