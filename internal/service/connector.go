package service

import "os"

// FileInfo is shared, defined in networkd.go currently.
// Link is defined in networkd.go

type Connector interface {
	// File Operations (relative to /etc/systemd/network or absolute?)
	// For simplicity, let's assume methods take filename relative to config directory,
	// or we handle paths inside connector.
	// NetworkdService handles "ConfigDir" logic, but for remote, ConfigDir is remote.
	// So Connector should know its ConfigDir.

	ListConfigDir(suffix string) ([]os.DirEntry, error)
	ReadConfigFile(filename string) ([]byte, error)
	WriteConfigFile(filename string, content []byte) error
	DeleteConfigFile(filename string) error

	// System Operations
	// System Operations
	Reconfigure(devices []string) error
	GetLinks() ([]Link, error)
	GetSystemdVersion() string

	// Global Config & Status
	GetGlobalConfig() (string, error)
	SaveGlobalConfig(content string) error
	ReloadNetworkd() (string, error)
	GetRoutes() (string, error)
	GetRules() (string, error)
	GetLogs() (string, error)
}
