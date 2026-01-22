# networkd-api

`networkd-api` is a powerful, web-based interface for managing `systemd-networkd` configurations across multiple hosts. It provides a visual, intuitive way to view, create, and modify network configurations and devices on Linux systems, supporting both local and remote management via SSH.

## Key Features

-   **Multi-Host Management**: Manage multiple Linux servers from a single dashboard using secure SSH tunneling.
-   **Visual Configuration**: Create and edit `.network`, `.netdev`, and `.link` files with a modern UI.
-   **Dynamic Validation**: Automatically detects the remote `systemd` version and validates configurations against the appropriate schema.
-   **Live Feedback**: Real-time validation, syntax highlighting, and visual status indicators.
-   **System Operations**: Reload, reconfigure, and view logs/routes directly from the browser.
-   **Secure**: Uses SSH keys for remote host authentication; no agent installation required on remote targets (requires only standard SSH and sudo).

## Prerequisites

-   **Go**: Version 1.25 or higher
-   **Node.js**: Version 18 or higher (for building the frontend)
-   **Linux**: Required for the backend to interact with D-Bus (local mode).
    -   *Note*: The application can run on macOS/Windows in "Remote functionality only" mode or for development.

## Installation & Running

### Backend

The backend is written in Go.

1.  Navigate to the project root.
2.  Install dependencies:
    ```bash
    go mod download
    ```
3.  Run the server:
    ```bash
    go run cmd/server/main.go
    ```

The server will start on port `8080`.

#### Configuration (Environment Variables)

-   **`NETWORKD_CONFIG_DIR`**: Directory where `.network`, `.netdev`, and `.link` files are located (Local Mode).
    -   Default: `/etc/systemd/network`
-   **`NETWORKD_DATA_DIR`**: Directory for storing application data (Host registry, SSH keys, UI preferences).
    -   Default: `./data`
-   **`NETWORKD_SCHEMA_DIR`**: (Optional) Directory containing JSON schemas. The app will auto-detect systemd versions and load schemas accordingly.
-   **`NETWORKD_GLOBAL_CONFIG`**: Path to the global `networkd.conf`.
    -   Default: `/etc/systemd/networkd.conf`

### Frontend

The frontend is a React application built with Vite.

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

The frontend will be available at `http://localhost:5173`.

## System Architecture

The application uses an **Agent/Connector** pattern:

1.  **Frontend**: A Single Page Application (SPA) that communicates with the Go backend API.
2.  **Backend (Golang)**: Acts as the central management plane.
    -   **Local Connector**: Manages the local machine using direct file access and D-Bus.
    -   **SSH Connector**: Manages remote hosts by establishing secure SSH tunnels. It executes standard commands (`networkctl`, `ip`, `cat`, `sudo`) to read/write configurations and gather status, requiring no custom binary on the remote host.

## API Endpoints

The backend exposes a RESTful API:

### System & Hosts
-   `GET /api/system/hosts`: List managed hosts.
-   `POST /api/system/hosts`: Add a new remote host.
-   `DELETE /api/system/hosts/{name}`: Remove a host.
-   `GET /api/system/ssh-key`: Retrieve the public SSH key for setting up remote access.
-   `GET /api/system/status`: Get networkd status (local or active remote).
-   `POST /api/system/reload`: Reload networkd daemon.
-   `POST /api/system/reconfigure`: Trigger reconfiguration of interfaces.

### Network Resources
All resource endpoints respect the `X-Target-Host` header to route requests to the correct machine.

-   **Networks** (`.network`): `GET/POST/DELETE /api/networks`
-   **NetDevs** (`.netdev`): `GET/POST/DELETE /api/netdevs`
-   **Links** (`.link`): `GET/POST/DELETE /api/links`
-   **Configs**: `GET /api/{type}/{filename}` to fetch specific file content.

## Production Deployment

1.  **Build Frontend**:
    ```bash
    cd frontend && npm run build
    ```
2.  **Build Backend**:
    ```bash
    go build -o networkd-api-server cmd/server/main.go
    ```
3.  **Run**:
    Set `STATIC_DIR` to the path of the `frontend/dist` directory to serve the UI directly from the Go binary.
    ```bash
    export STATIC_DIR=$(pwd)/frontend/dist
    ./networkd-api-server
    ```

## License

This project is licensed under the **GNU General Public License v2.0**.
