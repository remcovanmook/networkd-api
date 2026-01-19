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

func TestHandlers(t *testing.T) {
	// Setup temp dir for config
	tmpDir, err := os.MkdirTemp("", "networkd-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	svc := service.NewNetworkdService(tmpDir)
	h := NewHandler(svc)
	router := NewRouter(h)

	// Test 1: List Interfaces (Empty)
	req := httptest.NewRequest("GET", "/api/interfaces", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}

	// Test 2: Create Network
	config := service.NetworkConfig{
		Match:   service.MatchSection{Name: "eth0"},
		Network: service.NetworkSection{DHCP: "yes"},
	}

	payload := map[string]interface{}{
		"filename": "10-eth0.network",
		"config":   config,
	}
	body, _ := json.Marshal(payload)
	req = httptest.NewRequest("POST", "/api/networks", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected 201 Created, got %d", w.Code)
	}

	// Verify file created
	content, err := os.ReadFile(filepath.Join(tmpDir, "10-eth0.network"))
	if err != nil {
		t.Errorf("File not created: %v", err)
	}
	if err != nil {
		t.Errorf("File not created: %v", err)
	}

	// Since we generating via INI lib, whitespace might differ slightly, but key content should be there.
	// Or we can parse it back.
	if !bytes.Contains(content, []byte("Name = eth0")) {
		t.Errorf("Content missing Name=eth0: %s", content)
	}
	if !bytes.Contains(content, []byte("DHCP = yes")) { // ini lib usually checks spaces
		t.Errorf("Content missing DHCP=yes: %s", content)
	}

	// Test 3: List Interfaces (Populated)
	req = httptest.NewRequest("GET", "/api/interfaces", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}
	// Verify output contains "10-eth0.network"
	if !bytes.Contains(w.Body.Bytes(), []byte("10-eth0.network")) {
		t.Errorf("Response did not contain filename: %s", w.Body.String())
	}
}
