#!/bin/bash
# run_backend.sh - Development startup script for networkd-api backend

# Set a local config directory for development
export NETWORKD_CONFIG_DIR="$(pwd)/dev-config"
export NETWORKD_DATA_DIR="$(pwd)/dev-data"
export STATIC_DIR="$(pwd)/frontend/dist"

# Create the directories if they don't exist
mkdir -p "$NETWORKD_CONFIG_DIR"
mkdir -p "$NETWORKD_DATA_DIR"

echo "Starting networkd-api server..."
echo "Config Directory: $NETWORKD_CONFIG_DIR"
echo "Data Directory:   $NETWORKD_DATA_DIR"
echo "Static Directory: $STATIC_DIR"

# Run the server
go run cmd/server/main.go
