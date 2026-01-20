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
	files, err := h.Service.ListNetDevs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// ListConfigs returns list of .network config files
func (h *Handler) ListConfigs(w http.ResponseWriter, r *http.Request) {
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

	files, err := h.Service.ListNetworkConfigs(criteria)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// ListLinkConfigs returns list of .link config files
func (h *Handler) ListLinkConfigs(w http.ResponseWriter, r *http.Request) {
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

	files, err := h.Service.ListLinkConfigs(criteria)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// ListLinks returns list of Runtime Links
func (h *Handler) ListLinks(w http.ResponseWriter, r *http.Request) {
	links, err := h.Service.ListLinks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(links)
}

func (h *Handler) GetNetworkConfig(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	content, err := h.Service.ReadNetworkFile(filename)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	if strings.HasSuffix(filename, ".network") {
		config, err := service.ParseNetworkConfig(content)
		if err != nil {
			http.Error(w, "Failed to parse file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(config)
	} else if strings.HasSuffix(filename, ".netdev") {
		config, err := service.ParseNetDevConfig(content)
		if err != nil {
			http.Error(w, "Failed to parse file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(config)
	} else if strings.HasSuffix(filename, ".link") {
		config, err := service.ParseLinkConfig(content)
		if err != nil {
			http.Error(w, "Failed to parse file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(config)
	} else {
		http.Error(w, "Unknown file type", http.StatusBadRequest)
	}
}

type createNetworkRequest struct {
	Filename string                 `json:"filename"`
	Config   *service.NetworkConfig `json:"config"`
}

type createNetDevRequest struct {
	Filename string                `json:"filename"`
	Config   *service.NetDevConfig `json:"config"`
}

type createLinkRequest struct {
	Filename string              `json:"filename"`
	Config   *service.LinkConfig `json:"config"`
}

// CreateNetwork handles POST /api/networks (Creates .network file only)
func (h *Handler) CreateNetwork(w http.ResponseWriter, r *http.Request) {
	var req createNetworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Filename == "" || req.Config == nil {
		http.Error(w, "Filename and config are required", http.StatusBadRequest)
		return
	}
	// Enforce .network suffix
	if !strings.HasSuffix(req.Filename, ".network") {
		req.Filename += ".network"
	}

	content, err := service.GenerateNetworkConfig(req.Config)
	if err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.WriteNetworkFile(req.Filename, content); err != nil {
		http.Error(w, "Failed to write network file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Network configuration created"})
}

// CreateLink handles POST /api/links (Creates .link file only)
func (h *Handler) CreateLink(w http.ResponseWriter, r *http.Request) {
	var req createLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Filename == "" || req.Config == nil {
		http.Error(w, "Filename and config are required", http.StatusBadRequest)
		return
	}
	// Enforce .link suffix
	if !strings.HasSuffix(req.Filename, ".link") {
		req.Filename += ".link"
	}

	content, err := service.GenerateLinkConfig(req.Config)
	if err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.WriteNetworkFile(req.Filename, content); err != nil {
		http.Error(w, "Failed to write link file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Link configuration created"})
}

// CreateNetDev handles POST /api/interfaces (Creates .netdev file only)
func (h *Handler) CreateNetDev(w http.ResponseWriter, r *http.Request) {
	var req createNetDevRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Filename == "" || req.Config == nil {
		http.Error(w, "Filename and config are required", http.StatusBadRequest)
		return
	}
	// Enforce .netdev suffix
	if !strings.HasSuffix(req.Filename, ".netdev") {
		req.Filename += ".netdev"
	}

	content, err := service.GenerateNetDevConfig(req.Config)
	if err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.WriteNetworkFile(req.Filename, content); err != nil {
		http.Error(w, "Failed to write netdev file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "NetDev configuration created"})
}

func (h *Handler) DeleteNetwork(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if err := h.Service.DeleteNetworkFile(filename); err != nil {
		http.Error(w, "Failed to delete file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetViewConfig returns the UI layout configuration
func (h *Handler) GetViewConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.Service.GetViewConfig()
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "View config not found", http.StatusNotFound)
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
