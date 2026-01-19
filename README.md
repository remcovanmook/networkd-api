# networkd-api

`networkd-api` is a web-based interface for managing `systemd-networkd` configurations. It provides a visual way to view, create, and modify network configurations and devices on Linux systems.

The project consists of a Go backend that communicates with `systemd-networkd` (via D-Bus or file system) and a React frontend for the user interface.

## Prerequisites

- **Go**: Version 1.25 or higher
- **Node.js**: Version 18 or higher (for building the frontend)
- **Linux**: Required for full functionality (D-Bus interaction). On macOS/Windows, the application runs in development mode with mock data or file-based operations only.

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

-   **`NETWORKD_CONFIG_DIR`**: Set this environment variable to specify the directory where `.network` and `.netdev` files are located.
    -   Default: `/etc/systemd/network`
    -   Example for dev: `export NETWORKD_CONFIG_DIR=./tmp`

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

## License

This project is licensed under the **GNU General Public License v2.0**.
See the [LICENSE](LICENSE) file for details.
