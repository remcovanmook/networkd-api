package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type HostConfig struct {
	Name string `json:"name"`
	Host string `json:"host"` // IP or Hostname
	User string `json:"user"`
	Port int    `json:"port"`
}

type HostManager struct {
	DataDir string
	Hosts   map[string]HostConfig
	mu      sync.RWMutex
}

func NewHostManager(dataDir string) (*HostManager, error) {
	hm := &HostManager{
		DataDir: dataDir,
		Hosts:   make(map[string]HostConfig),
	}
	if err := hm.Load(); err != nil {
		return nil, err
	}
	return hm, nil
}

func (hm *HostManager) Load() error {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	path := filepath.Join(hm.DataDir, "hosts.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil // No hosts yet
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var hosts []HostConfig
	if err := json.Unmarshal(content, &hosts); err != nil {
		return err
	}

	hm.Hosts = make(map[string]HostConfig)
	for _, h := range hosts {
		hm.Hosts[h.Name] = h
	}
	return nil
}

func (hm *HostManager) Save() error {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	var hosts []HostConfig
	for _, h := range hm.Hosts {
		hosts = append(hosts, h)
	}

	content, err := json.MarshalIndent(hosts, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(hm.DataDir, "hosts.json"), content, 0644)
}

func (hm *HostManager) AddHost(h HostConfig) error {
	hm.mu.Lock()
	if h.Name == "local" {
		hm.mu.Unlock()
		return fmt.Errorf("reserved name 'local'")
	}
	hm.Hosts[h.Name] = h
	hm.mu.Unlock()
	return hm.Save()
}

func (hm *HostManager) RemoveHost(name string) error {
	hm.mu.Lock()
	delete(hm.Hosts, name)
	hm.mu.Unlock()
	return hm.Save()
}

func (hm *HostManager) GetHost(name string) (HostConfig, bool) {
	hm.mu.RLock()
	defer hm.mu.RUnlock()
	h, ok := hm.Hosts[name]
	return h, ok
}

func (hm *HostManager) ListHosts() []HostConfig {
	hm.mu.RLock()
	defer hm.mu.RUnlock()
	var list []HostConfig
	for _, h := range hm.Hosts {
		list = append(list, h)
	}
	return list
}
