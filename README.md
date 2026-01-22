# networkd-api

`networkd-api` is a web-based interface for managing `systemd-networkd` configurations. It provides a visual way to view, create, and modify network configurations and devices on Linux systems.

The project consists of a Go backend that communicates with `systemd-networkd` (via D-Bus or file system) and a React frontend for the user interface.

## Prerequisites

- **Go**: Version 1.25 or higher
- **Node.js**: Version 18 or higher (for building the frontend)
- **Linux**: Required for full functionality (D-Bus interaction). On macOS/Windows, the application runs in development mode with mock data or file-based operations only.

#### Environment Setup

To install the necessary dependencies (Go and Node.js) on various distributions:

**Debian/Ubuntu (`apt`)**
```bash
sudo apt update
sudo apt install golang nodejs npm
```

**Fedora (`dnf`)**
```bash
sudo dnf install golang nodejs
```

**Arch Linux (`pacman`)**
```bash
sudo pacman -S go nodejs npm
```

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

#### Configuration

-   **`NETWORKD_CONFIG_DIR`**: Directory where `.network`, `.netdev`, and `.link` files are located.
    -   Default: `/etc/systemd/network`
    -   Example for dev: `export NETWORKD_CONFIG_DIR=./dev-config`

-   **`NETWORKD_SCHEMA_DIR`**: (Optional) Directory containing JSON schemas (e.g., `schemas/v257`).
    -   If not set, the server attempts to load schemas from the `schemas/` directory relative to the binary or current working directory.
    -   The server automatically detects the `systemd` version on the host (`networkctl --version`) and loads the corresponding schema version.

-   **`NETWORKD_GLOBAL_CONFIG`**: Path to the global `networkd.conf` file.
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

The frontend will be available at `http://localhost:5173`. It expects the backend to be running at `http://localhost:8080`.

## Building for Production

To build the full application:

1.  Build the frontend:
    ```bash
    cd frontend
    npm run build
    ```
    This generates static assets in `frontend/dist`.

2.  (Optional) Serve the `dist` folder using the Go backend or a separate web server (e.g., Nginx). *Note: Current backend implementation may strictly be an API server; you might need to configure it to serve static files or use a reverse proxy.*

## Usage

1.  Open the web interface.
2.  **Dashboard**: View existing network devices and configurations.
3.  **Edit**: Click on a configuration to edit its properties (IP, DHCP, etc.).
4.  **Create**: Use the "Add" button to create new `.network` or `.netdev` files.

## License

## System Architecture & Frontend API

### Frontend Architecture

The frontend is designed as a bridge to `systemd-networkd`, utilizing a typed API client to interact with the backend service.

-   **API Client** (`src/api/client.ts`): The central definition of the API's contract. It maps `networkd` configuration files (`.network`, `.netdev`) to TypeScript interfaces, ensuring type safety across the application.
-   **State Management**: Uses `@tanstack/react-query` for efficient data fetching, caching, and synchronization with the backend state.
-   **Routing**: The application uses `react-router-dom` for navigation, splitting the view into:
    -   **Detailed View** (`/interfaces/:filename`, `/networks/:filename`): For editing specific configuration files.
    -   **System Management** (`/system`): For viewing logs, routes, and reloading the `networkd` daemon.
    -   **API Documentation** (`/api-docs`): An embedded Swagger UI view of the API specification.

### API Endpoints

The backend exposes a RESTful API organized into:

-   `/api/interfaces`: Managing physical links and `.netdev` virtual devices.
-   `/api/networks`: Managing `.network` configuration profiles.
-   `/api/system`: System operational commands (reload, logs, routes).

## Production Deployment

To run the application in a production environment (Standalone Mode):

### 1. Build the Frontend
```bash
cd frontend
npm install
npm run build
```
This creates the production assets in `frontend/dist`.

### 2. Install the Backend
Build the backend binary:
```bash
cd ..
go build -o networkd-api-server cmd/server/main.go
sudo mkdir -p /opt/networkd-api
sudo mv networkd-api-server /opt/networkd-api/
```

### 3. Configure Systemd Service
The backend runs as a systemd service. We configure it to listen on all interfaces (or a specific public IP) and serve the frontend assets directly.

1.  Copy the service file:
    ```bash
    sudo cp systemd/networkd-api.service /etc/systemd/system/
    ```
2.  Edit configuration:
    ```bash
    sudo nano /etc/systemd/system/networkd-api.service
    ```
    Ensure the following environment variables are set:
    *   `NETWORKD_HOST`: Set to `0.0.0.0` to listen on all interfaces (or your public IP).
    *   `NETWORKD_PORT`: Port to listen on (e.g., `80`). Note: Ports < 1024 require root or `CAP_NET_BIND_SERVICE`.
    *   `STATIC_DIR`: Path to the frontend `dist` folder (e.g., `/opt/networkd-api/dist`).

    **Example Service Configuration:**
    ```ini
    [Service]
    ...
    Environment=NETWORKD_HOST=0.0.0.0
    Environment=NETWORKD_PORT=80
    Environment=STATIC_DIR=/opt/networkd-api/dist
    ...
    ```

3.  Copy Frontend Assets:
    ```bash
    sudo cp -r frontend/dist /opt/networkd-api/
    ```

4.  Reload and start the service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable --now networkd-api
    ```

Now, navigate to your server's IP address. The Go server handles both the API and the React frontend.

## License

This project is licensed under the **GNU General Public License v2.0**.
See the [LICENSE](LICENSE) file for details.
