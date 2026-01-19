package api

import (
	"encoding/json"
	"net/http"
	"networkd-api/internal/service"
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
	files, err := h.Service.ListNetworkConfigs()
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

	// Try to parse as NetworkConfig first, if fails try NetDevConfig?
	// But /api/networks/{filename} implies .network.
	// We might need /api/interfaces/{filename} for .netdev.
	// For now, simple logic: check suffix or try both.

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
