package main

import (
	"log"
	"net/http"
	"networkd-api/internal/api"
	"networkd-api/internal/service"
	"os"
)

func main() {
	configDir := os.Getenv("NETWORKD_CONFIG_DIR")
	dataDir := os.Getenv("NETWORKD_DATA_DIR")
	staticDir := os.Getenv("STATIC_DIR")

	svc := service.NewNetworkdService(configDir, dataDir)
	log.Printf("Using ConfigDir: %s", svc.ConfigDir)
	log.Printf("Using DataDir: %s", svc.DataDir)
	h := api.NewHandler(svc)
	r := api.NewRouter(h, staticDir)

	host := os.Getenv("NETWORKD_HOST")
	port := os.Getenv("NETWORKD_PORT")
	if port == "" {
		port = "8080"
	}
	addr := host + ":" + port

	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
