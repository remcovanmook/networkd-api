package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(h *Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Basic CORS setup
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"}, // Vite default and others
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		// Interfaces (Device Management)
		r.Get("/interfaces", h.ListLinks)                   // Runtime Links (Physical & Virtual)
		r.Get("/interfaces/netdevs", h.ListNetDevs)         // Virtual Device Definitions (.netdev)
		r.Post("/interfaces", h.CreateNetDev)               // Create Virtual Device
		r.Get("/interfaces/{filename}", h.GetNetworkConfig) // Reuses generic reader
		r.Delete("/interfaces/{filename}", h.DeleteNetwork) // Reuses generic delete

		// Networks (Configuration Management)
		r.Get("/networks", h.ListConfigs) // Network Configurations (.network)
		r.Post("/networks", h.CreateNetwork)
		r.Get("/networks/{filename}", h.GetNetworkConfig)
		r.Delete("/networks/{filename}", h.DeleteNetwork)

		// System Management
		r.Get("/system/config", h.GetGlobalConfig)
		r.Post("/system/config", h.SaveGlobalConfig)
		r.Post("/system/reload", h.ReloadNetworkd)
		r.Get("/system/routes", h.GetRoutes)
		r.Get("/system/logs", h.GetLogs)
	})

	return r
}
