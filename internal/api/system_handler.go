package api

import (
	"encoding/json"
	"net/http"
)

func (h *Handler) GetGlobalConfig(w http.ResponseWriter, r *http.Request) {
	content, err := h.Service.GetGlobalConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Return raw text or JSON wrapper?
	// JSON wrapper is safer for future expansion.
	json.NewEncoder(w).Encode(map[string]string{"content": content})
}

func (h *Handler) SaveGlobalConfig(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if err := h.Service.SaveGlobalConfig(body.Content); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) ReloadNetworkd(w http.ResponseWriter, r *http.Request) {
	out, err := h.Service.ReloadNetworkd()
	if err != nil {
		// 500 but return output
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error(), "output": out})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Reload successful", "output": out})
}

func (h *Handler) GetRoutes(w http.ResponseWriter, r *http.Request) {
	routes, err := h.Service.GetRoutes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	rules, err := h.Service.GetRules()
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
	logs, err := h.Service.GetLogs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"logs": logs})
}
