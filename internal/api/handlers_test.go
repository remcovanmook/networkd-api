package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"networkd-api/internal/service"
	"os"
	"path/filepath"
	"testing"
)

func setupTestService(t *testing.T) (*service.NetworkdService, string) {
	tmpDir, err := os.MkdirTemp("", "networkd-test")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	// Reuse tmpDir as DataDir for simplicity in tests, or create separate
	svc := service.NewNetworkdService(tmpDir, tmpDir)

	// Manually inject dummy schemas
	if svc.Schema == nil {
		svc.Schema = &service.SchemaService{
			Schemas:            make(map[string]map[string]interface{}),
			TypeCache:          make(map[string]map[string]map[string]service.TypeInfo),
			RepeatableSections: make(map[string]map[string]bool),
		}
	}

	svc.Schema.Schemas["network"] = map[string]interface{}{
		"properties": map[string]interface{}{
			"Match": map[string]interface{}{
				"properties": map[string]interface{}{"Name": map[string]interface{}{"type": "string"}},
			},
			"Network": map[string]interface{}{
				"properties": map[string]interface{}{"DHCP": map[string]interface{}{"type": "string", "enum": []interface{}{"yes", "no", "ipv4", "ipv6"}}},
			},
		},
	}
	// Simplified cache
	svc.Schema.TypeCache["network"] = map[string]map[string]service.TypeInfo{
		"Match":   {"Name": {}},
		"Network": {"DHCP": {}},
	}

	return svc, tmpDir
}

func TestListConfigs(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer os.RemoveAll(tmpDir)

	// Create a dummy network file
	content := "[Match]\nName=eth0\n[Network]\nDHCP=yes\n"
	os.WriteFile(filepath.Join(tmpDir, "eth0.network"), []byte(content), 0644)

	handler := NewHandler(svc)
	req := httptest.NewRequest("GET", "/api/networks", nil)
	w := httptest.NewRecorder()

	handler.ListNetworks(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", resp.StatusCode)
	}

	var files []service.FileInfo
	json.NewDecoder(resp.Body).Decode(&files)
	if len(files) != 1 {
		t.Errorf("Expected 1 file, got %d", len(files))
	}
	if files[0].Filename != "eth0.network" {
		t.Errorf("Expected filename 'eth0.network', got %s", files[0].Filename)
	}
}

func TestCreateNetwork(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(svc)

	reqBody := map[string]interface{}{
		"filename": "test.network",
		"config": map[string]interface{}{
			"Match": map[string]interface{}{
				"Name": "test0",
			},
			"Network": map[string]interface{}{
				"DHCP": "yes",
			},
		},
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/networks", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateNetwork(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected 201 Created, got %d", resp.StatusCode)
	}

	content, err := os.ReadFile(filepath.Join(tmpDir, "test.network"))
	if err != nil {
		t.Fatalf("File not created: %v", err)
	}

	sContent := string(content)
	// Check loosely because parsing/generating might reorder or format
	// Actually MapToINI sorts keys so it's deterministic
	// But whitespace (spaces around =) depends on library default.
	if !contains(sContent, "Name") || !contains(sContent, "test0") || !contains(sContent, "DHCP") || !contains(sContent, "yes") {
		t.Errorf("Content mismatch: %s", sContent)
	}
}

func contains(s, substr string) bool {
	// Basic impl or use strings.Contains
	for i := 0; i < len(s)-len(substr)+1; i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestHostManagement(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(svc)
	w := httptest.NewRecorder()

	// Add Host
	hostBody := map[string]interface{}{
		"name": "node1",
		"host": "192.168.1.10",
	}
	body, _ := json.Marshal(hostBody)
	req := httptest.NewRequest("POST", "/api/system/hosts", bytes.NewBuffer(body))
	handler.AddHost(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("AddHost failed: %d", resp.StatusCode)
	}

	// List Hosts
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/system/hosts", nil)
	handler.ListHosts(w, req)

	resp = w.Result()
	var hosts []service.HostConfig
	if err := json.NewDecoder(resp.Body).Decode(&hosts); err != nil {
		t.Fatal(err)
	}
	if len(hosts) != 1 || hosts[0].Name != "node1" {
		t.Errorf("ListHosts failed, got %v", hosts)
	}
}
