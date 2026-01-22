package api

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(h *Handler, staticDir string) http.Handler {
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
		r.Get("/schemas", h.GetSchemas)        // JSON Schemas
		r.Get("/view-config", h.GetViewConfig) // UI View Prefs

		// NetDevs (.netdev)
		r.Get("/netdevs", h.ListNetDevs)
		r.Post("/netdevs", h.CreateNetDev)
		r.Get("/netdevs/{filename}", h.GetNetworkConfig)
		r.Delete("/netdevs/{filename}", h.DeleteNetwork)

		// Networks (.network)
		r.Get("/networks", h.ListNetworks)
		r.Post("/networks", h.CreateNetwork)
		r.Get("/networks/{filename}", h.GetNetworkConfig)
		r.Delete("/networks/{filename}", h.DeleteNetwork)

		// Links (.link)
		r.Get("/links", h.ListLinks)
		r.Post("/links", h.CreateLink)
		r.Get("/links/{filename}", h.GetNetworkConfig)
		r.Delete("/links/{filename}", h.DeleteNetwork)

		// System Management
		r.Get("/system/status", h.GetSystemStatus)
		r.Get("/system/config", h.GetGlobalConfig)
		r.Post("/system/config", h.SaveGlobalConfig)
		r.Get("/system/view-config", h.GetViewConfig)
		r.Post("/system/view-config", h.SaveViewConfig)
		r.Post("/system/reload", h.ReloadNetworkd)
		r.Get("/system/reconfigure", h.ReconfigureSystem)
		r.Post("/system/reconfigure", h.ReconfigureSystem)
		r.Get("/system/ssh-key", h.GetPublicSSHKey)
		r.Get("/system/routes", h.GetRoutes)
		r.Get("/system/logs", h.GetLogs)

		r.Get("/system/hosts", h.ListHosts)
		r.Post("/system/hosts", h.AddHost)
		r.Delete("/system/hosts/{name}", h.RemoveHost)
	})

	// Serve Static Files (SPA) if staticDir is configured
	if staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Check if file exists, otherwise serve index.html
			// This is a naive SPA implementation but sufficient for this scale
			path := r.URL.Path
			// Prevent directory traversal is handled by http.ServeFile/FileServer generally,
			// but we need to check existence to fallback to index.html
			fullPath := staticDir + path

			// If it's a file that exists, serve it
			if info, err := // Wait, I need os package
				os.Stat(fullPath); err == nil && !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}

			// Serve index.html for all other routes (client-side routing)
			http.ServeFile(w, r, staticDir+"/index.html")
		})
	}

	return r
}
