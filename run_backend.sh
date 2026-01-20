#!/bin/bash
# run_backend.sh - Development startup script for networkd-api backend

# Set a local config directory for development
export NETWORKD_CONFIG_DIR="$(pwd)/dev-config"
export STATIC_DIR="$(pwd)/frontend/dist"

# Create the directory if it doesn't exist
mkdir -p "$NETWORKD_CONFIG_DIR"

echo "Starting networkd-api server..."
echo "Config Directory: $NETWORKD_CONFIG_DIR"
echo "Static Directory: $STATIC_DIR"

# Run the server
go run cmd/server/main.go
