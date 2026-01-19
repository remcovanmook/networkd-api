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
	svc := service.NewNetworkdService(configDir)
	h := api.NewHandler(svc)
	r := api.NewRouter(h)

	port := ":8080"
	log.Printf("Server starting on %s", port)
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
