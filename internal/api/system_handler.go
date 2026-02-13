package api

import (
	"encoding/json"
	"net/http"
	"networkd-api/internal/service"
)

func (h *Handler) GetGlobalConfig(w http.ResponseWriter, r *http.Request) {
	content, err := h.Service.GetGlobalConfig(getHost(r))
	if err != nil {
		// File doesn't exist or is empty — return empty config
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{})
		return
	}

	config, err := service.INIToMap(content, h.Service.Schema, "networkd-conf")
	if err != nil {
		http.Error(w, "Failed to parse config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (h *Handler) SaveGlobalConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Config map[string]interface{} `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if req.Config == nil {
		http.Error(w, "Config is required", http.StatusBadRequest)
		return
	}

	if err := h.Service.Schema.Validate("networkd-conf", req.Config); err != nil {
		http.Error(w, "Validation failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	content, err := service.MapToINI(req.Config, h.Service.Schema, "networkd-conf")
	if err != nil {
		http.Error(w, "Conversion failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Service.SaveGlobalConfig(getHost(r), content); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Configuration saved"})
}

func (h *Handler) ReloadNetworkd(w http.ResponseWriter, r *http.Request) {
	out, err := h.Service.ReloadNetworkd(getHost(r))
	if err != nil {
		// 500 but return output
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error(), "output": out})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Reload successful", "output": out})
}

func (h *Handler) GetRoutes(w http.ResponseWriter, r *http.Request) {
	host := getHost(r)
	routes, err := h.Service.GetRoutes(host)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	rules, err := h.Service.GetRules(host)
	if err != nil {
		// Not fatal, maybe just log or ignore
		rules = "Failed to fetch rules: " + err.Error()
	}

	json.NewEncoder(w).Encode(map[string]string{
		"routes": routes,
		"rules":  rules,
	})
}

func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := h.Service.GetLogs(getHost(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"logs": logs})
}
