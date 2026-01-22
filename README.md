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

The backend exposes a RESTful API. All endpoints are prefixed with `/api`.

### Generic Resources
-   `GET /api/schemas`: Retrieve all loaded JSON schemas.
-   `GET /api/view-config`: Get current UI view preferences.

### Network Configuration
These endpoints respect the `X-Target-Host` header to target a specific remote host.

-   **Virtual Devices (.netdev)**:
    -   `GET /api/netdevs`: List all netdev files.
    -   `POST /api/netdevs`: Create a new netdev file.
    -   `GET /api/netdevs/{filename}`: Unused (alias for generic config retrieval).
    -   `DELETE /api/netdevs/{filename}`: Delete a netdev file.

-   **Networks (.network)**:
    -   `GET /api/networks`: List all network files.
    -   `POST /api/networks`: Create a new network file.
    -   `GET /api/networks/{filename}`: Unused (alias for generic config retrieval).
    -   `DELETE /api/networks/{filename}`: Delete a network file.

-   **Links (.link)**:
    -   `GET /api/links`: List all link files (and runtime links).
    -   `POST /api/links`: Create a new link file.
    -   `GET /api/links/{filename}`: Unused (alias for generic config retrieval).
    -   `DELETE /api/links/{filename}`: Delete a link file.

-   **File Content**:
    -   `GET /api/{type}/{filename}`: Retrieve parsed content of a specific file (where type is `netdevs`, `networks`, or `links`).

### System Management
System operations also respect the `X-Target-Host` header.

-   `GET /api/system/status`: Get systemd-networkd status and version.
-   `GET /api/system/config`: Get global networkd.conf.
-   `POST /api/system/config`: Save global networkd.conf.
-   `GET /api/system/view-config`: Get system-level view config.
-   `POST /api/system/view-config`: Save system-level view config.
-   `POST /api/system/reload`: Reload the networkd daemon.
-   `GET /api/system/reconfigure`: Trigger reconfiguration (GET is supported but POST preferred).
-   `POST /api/system/reconfigure`: Trigger reconfiguration for specific interfaces.
-   `GET /api/system/ssh-key`: Get the backend's public SSH key for remote setup.
-   `GET /api/system/routes`: List current network routes.
-   `GET /api/system/logs`: Fetch recent networkd logs.

### Host Management
Endpoints for managing the registry of remote hosts.

-   `GET /api/system/hosts`: List all registered hosts.
-   `POST /api/system/hosts`: Register a new host.
-   `DELETE /api/system/hosts/{name}`: Deregister a host.

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
