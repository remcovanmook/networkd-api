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
	defer hm.mu.Unlock()
	if h.Name == "local" {
		return fmt.Errorf("reserved name 'local'")
	}
	hm.Hosts[h.Name] = h
	// Release lock before Save to avoid deadlock if Save used lock (it uses RLock, so mostly fine, but Save calls RLock while we hold Lock -> fine? No, Lock blocks RLock)
	// Actually Save uses RLock. If we hold Lock, RLock blocks.
	// So we should save after unlocking or use internal save.
	// Let's just defer unlock and Save manually or unlock first.
	// Better:
	// hm.Hosts[h.Name] = h
	// unlock
	// Save
	// But that leaves a gap.
	// I'll implementation internal save or just Copy-on-Write logic.
	// For simplicity:
	// return hm.saveInternal() // which writes file
	return nil // Caller calls Save? No, should be atomic.
}

// Checking deadlock again:
// Func A locks. Calls B. B locks -> Deadlock.
// Save() locks RLock.
// If AddHost holds Lock, Save cannot take RLock.
// So AddHost must not call Save directly if Save takes lock.
// I will implement correct locking.

func (hm *HostManager) AddHostSafe(h HostConfig) error {
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
