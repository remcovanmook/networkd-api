package api

import (
	"encoding/json"
	"io"
	"net/http"
	"networkd-api/internal/service"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	Service *service.NetworkdService
}

func NewHandler(s *service.NetworkdService) *Handler {
	return &Handler{Service: s}
}

// ListNetDevs returns list of .netdev files (Virtual Devices/Interfaces)
func (h *Handler) ListNetDevs(w http.ResponseWriter, r *http.Request) {
	files, err := h.Service.ListNetDevs(getHost(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// ListNetworks returns list of .network config files
func (h *Handler) ListNetworks(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	mac := r.URL.Query().Get("macaddress")
	matchType := r.URL.Query().Get("type")

	var criteria *service.MatchCriteria
	if name != "" || mac != "" || matchType != "" {
		criteria = &service.MatchCriteria{
			Name:       name,
			MACAddress: mac,
			Type:       matchType,
		}
	}

	files, err := h.Service.ListNetworkConfigs(getHost(r), criteria)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// ListLinks returns list of .link config files
func (h *Handler) ListLinks(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	mac := r.URL.Query().Get("macaddress")
	matchType := r.URL.Query().Get("type")

	var criteria *service.MatchCriteria
	if name != "" || mac != "" || matchType != "" {
		criteria = &service.MatchCriteria{
			Name:       name,
			MACAddress: mac,
			Type:       matchType,
		}
	}

	files, err := h.Service.ListLinkConfigs(getHost(r), criteria)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (h *Handler) GetNetworkConfig(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	content, err := h.Service.ReadNetworkFile(getHost(r), filename)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	configType := "network"
	if strings.HasSuffix(filename, ".netdev") {
		configType = "netdev"
	} else if strings.HasSuffix(filename, ".link") {
		configType = "link"
	}

	// Dynamic parse
	config, err := service.INIToMap(content, h.Service.Schema, configType)
	if err != nil {
		http.Error(w, "Failed to parse file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

type createRequest struct {
	Filename string                 `json:"filename"`
	Config   map[string]interface{} `json:"config"`
}

// CreateNetwork handles POST /api/networks (Creates .network file only)
func (h *Handler) CreateNetwork(w http.ResponseWriter, r *http.Request) {
	h.handleCreate(w, r, ".network", "network")
}

// CreateLink handles POST /api/links (Creates .link file only)
func (h *Handler) CreateLink(w http.ResponseWriter, r *http.Request) {
	h.handleCreate(w, r, ".link", "link")
}

// CreateNetDev handles POST /api/interfaces (Creates .netdev file only)
func (h *Handler) CreateNetDev(w http.ResponseWriter, r *http.Request) {
	h.handleCreate(w, r, ".netdev", "netdev")
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request, suffix, configType string) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Filename == "" || req.Config == nil {
		http.Error(w, "Filename and config are required", http.StatusBadRequest)
		return
	}
	// Enforce suffix
	if !strings.HasSuffix(req.Filename, suffix) {
		req.Filename += suffix
	}

	// Validate against Schema
	if err := h.Service.Schema.Validate(configType, req.Config); err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Convert Map -> INI
	content, err := service.MapToINI(req.Config, h.Service.Schema, configType)
	if err != nil {
		http.Error(w, "Conversion failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.WriteNetworkFile(getHost(r), req.Filename, content); err != nil {
		http.Error(w, "Failed to write file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Configuration created"})
}

// UpdateNetwork handles PUT /api/networks/{filename}
func (h *Handler) UpdateNetwork(w http.ResponseWriter, r *http.Request) {
	h.handleUpdate(w, r, "network")
}

// UpdateLink handles PUT /api/links/{filename}
func (h *Handler) UpdateLink(w http.ResponseWriter, r *http.Request) {
	h.handleUpdate(w, r, "link")
}

// UpdateNetDev handles PUT /api/netdevs/{filename}
func (h *Handler) UpdateNetDev(w http.ResponseWriter, r *http.Request) {
	h.handleUpdate(w, r, "netdev")
}

func (h *Handler) handleUpdate(w http.ResponseWriter, r *http.Request, configType string) {
	filename := chi.URLParam(r, "filename")

	// Verify file exists
	if _, err := h.Service.ReadNetworkFile(getHost(r), filename); err != nil {
		http.Error(w, "File not found: "+filename, http.StatusNotFound)
		return
	}

	var req struct {
		Config map[string]interface{} `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Config == nil {
		http.Error(w, "Config is required", http.StatusBadRequest)
		return
	}

	if err := h.Service.Schema.Validate(configType, req.Config); err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	content, err := service.MapToINI(req.Config, h.Service.Schema, configType)
	if err != nil {
		http.Error(w, "Conversion failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.WriteNetworkFile(getHost(r), filename, content); err != nil {
		http.Error(w, "Failed to write file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Configuration updated"})
}

func (h *Handler) DeleteNetwork(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if err := h.Service.DeleteNetworkFile(getHost(r), filename); err != nil {
		http.Error(w, "Failed to delete file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetSystemStatus returns system information including version and runtime interfaces
func (h *Handler) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	host := getHost(r)
	links, err := h.Service.ListLinks(host)
	if err != nil {
		http.Error(w, "Failed to list runtime interfaces: "+err.Error(), http.StatusInternalServerError)
		return
	}

	version, _ := h.Service.GetSystemdVersion(host)
	// fallback handled in Service

	// Resolve the best matching schema version for this host version
	schemaVersion := h.Service.Schema.ResolveSchemaVersion(version)

	status := map[string]interface{}{
		"systemd_version": version,
		"schema_version":  schemaVersion,
		"interfaces":      links,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

type reconfigureRequest struct {
	Interfaces []string `json:"interfaces"`
}

// ListHosts returns configured remote hosts
func (h *Handler) ListHosts(w http.ResponseWriter, r *http.Request) {
	if h.Service.HostManager == nil {
		http.Error(w, "HostManager not initialized", http.StatusInternalServerError)
		return
	}
	hosts := h.Service.HostManager.ListHosts()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hosts)
}

// AddHost adds a new remote host
func (h *Handler) AddHost(w http.ResponseWriter, r *http.Request) {
	var host service.HostConfig
	if err := json.NewDecoder(r.Body).Decode(&host); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if host.Name == "" || host.Host == "" {
		http.Error(w, "Name and Host are required", http.StatusBadRequest)
		return
	}
	// Default user/port
	if host.User == "" {
		host.User = "networkd-api"
	}
	if host.Port == 0 {
		host.Port = 22
	}

	if err := h.Service.HostManager.AddHostSafe(host); err != nil {
		http.Error(w, "Failed to add host: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(host)
}

// RemoveHost removes a remote host
func (h *Handler) RemoveHost(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if err := h.Service.HostManager.RemoveHost(name); err != nil {
		http.Error(w, "Failed to remove host: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ReconfigureSystem triggers networkctl reconfigure
func (h *Handler) ReconfigureSystem(w http.ResponseWriter, r *http.Request) {
	var devices []string

	if r.Method == http.MethodPost && r.ContentLength > 0 {
		var req reconfigureRequest
		// Ignore error if body is empty or invalid structure, just act as reconfigure-all?
		// Or specific check?
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			devices = req.Interfaces
		}
	}

	if err := h.Service.Reconfigure(getHost(r), devices); err != nil {
		http.Error(w, "Reconfigure failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Reconfiguration triggered"})
}

// GetPublicSSHKey returns the backend's public SSH key
func (h *Handler) GetPublicSSHKey(w http.ResponseWriter, r *http.Request) {
	key, err := h.Service.GetPublicSSHKey()
	if err != nil {
		http.Error(w, "Failed to read public key: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(key))
}

// GetSchemas returns the loaded JSON schemas
func (h *Handler) GetSchemas(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.Service.Schema.Schemas)
}

// GetViewConfig returns the UI layout configuration
func (h *Handler) GetViewConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.Service.GetViewConfig()
	if err != nil {
		if os.IsNotExist(err) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}"))
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(config)
}

// SaveViewConfig saves the UI layout configuration
func (h *Handler) SaveViewConfig(w http.ResponseWriter, r *http.Request) {
	// Read raw body since we are just saving JSON to file
	// Limit body size to avoid DoS
	r.Body = http.MaxBytesReader(w, r.Body, 1024*1024) // 1MB max for config
	content, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.SaveViewConfig(content); err != nil {
		http.Error(w, "Failed to save config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "View configuration saved"})
}

func getHost(r *http.Request) string {
	if h := r.Header.Get("X-Target-Host"); h != "" {
		return h
	}
	return r.URL.Query().Get("host")
}
