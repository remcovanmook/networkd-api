package service

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// GetGlobalConfig reads the main networkd.conf file
func (s *NetworkdService) GetGlobalConfig() (string, error) {
	// If file doesn't exist, return empty or default template
	if _, err := os.Stat(s.GlobalConfigPath); os.IsNotExist(err) {
		return "# /etc/systemd/networkd.conf\n# No configuration file found.\n", nil
	}
	content, err := os.ReadFile(s.GlobalConfigPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// SaveGlobalConfig writes the main networkd.conf file
func (s *NetworkdService) SaveGlobalConfig(content string) error {
	// Ensure directory exists
	// Verify we are writing to allowed path? s.GlobalConfigPath is assumed safe from initialization
	return os.WriteFile(s.GlobalConfigPath, []byte(content), 0644)
}

// ReloadNetworkd executes 'networkctl reload'
func (s *NetworkdService) ReloadNetworkd() (string, error) {
	if runtime.GOOS != "linux" {
		return "Mock: Reloaded systemd-networkd", nil
	}
	cmd := exec.Command("networkctl", "reload")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("failed to reload: %w", err)
	}
	return "Successfully reloaded systemd-networkd.\n" + string(out), nil
}

// GetRoutes returns the output of 'ip route show table all'
func (s *NetworkdService) GetRoutes() (string, error) {
	if runtime.GOOS != "linux" {
		return "default via 192.168.1.1 dev eth0 proto dhcp \n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.5", nil
	}
	// table all gives robust view including local table
	cmd := exec.Command("ip", "route", "show", "table", "all")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GetRules returns the output of 'ip rule show' (Policy Routing)
func (s *NetworkdService) GetRules() (string, error) {
	if runtime.GOOS != "linux" {
		return "0:      from all lookup local\n32766:  from all lookup main\n32767:  from all lookup default", nil
	}
	cmd := exec.Command("ip", "rule", "show")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GetLogs returns the tail of networkd logs
func (s *NetworkdService) GetLogs() (string, error) {
	if runtime.GOOS != "linux" {
		return "Jan 19 12:00:00 host systemd-networkd[123]: eth0: Gained carrier\nJan 19 12:00:01 host systemd-networkd[123]: eth0: DHCPv4 address 192.168.1.5/24", nil
	}
	// journalctl -u systemd-networkd -n 100 --no-pager
	cmd := exec.Command("journalctl", "-u", "systemd-networkd", "-n", "100", "--no-pager")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}
