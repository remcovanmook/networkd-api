import axios from 'axios';

const API_Base = '/api';

let currentHost = '';

axios.interceptors.request.use((config) => {
    if (currentHost) {
        config.headers['X-Target-Host'] = currentHost;
    }
    return config;
});

export interface Link {
    index: number;
    name: string;
    operational_state: string;
    network_file: string;
    addresses?: string[];
}

// Flexible dictionary type for loose schema mapping
type ConfigDict = Record<string, any>;

export interface NetworkConfig {
    match: ConfigDict;
    link?: ConfigDict;
    network: ConfigDict;
    address?: ConfigDict[]; // This might be handled differently if shadows are flattened
    routes?: ConfigDict[];
    dhcpv4?: ConfigDict;
    dhcpv6?: ConfigDict;
}

export interface NetDevConfig {
    netdev: ConfigDict;
    vlan?: ConfigDict;
    bridge?: ConfigDict;
    bond?: ConfigDict;
    vxlan?: ConfigDict;
    macvlan?: ConfigDict;
    ipvlan?: ConfigDict;
    tun?: ConfigDict;
    tap?: ConfigDict;
    wireguard?: ConfigDict;
    wireguard_peers?: ConfigDict[];
    vrf?: ConfigDict;
}


export interface ConfigSummary {
    dhcp?: string;
    address?: string[];
    dns?: string[];
    vlan?: string[];
    vlan_id?: number;
}

export interface InterfaceFile {
    filename: string;
    type: 'network' | 'netdev';
    netdev_kind?: string;
    netdev_name?: string;
    network_match_name?: string;
    summary?: ConfigSummary;
}

// System Status Response
export interface SystemStatus {
    systemd_version: string;
    schema_version?: string;
    interfaces: Link[];
}

export interface HostConfig {
    name: string;
    host: string;
    user?: string;
    port?: number;
}

export const apiClient = {
    // NetDevs (.netdev file management)
    getNetDevs: async () => {
        const response = await axios.get<InterfaceFile[]>(`${API_Base}/netdevs`);
        return response.data;
    },
    createNetDev: async (filename: string, config: NetDevConfig) => {
        const response = await axios.post(`${API_Base}/netdevs`, { filename, config });
        return response.data;
    },
    deleteNetDev: async (filename: string) => {
        await axios.delete(`${API_Base}/netdevs/${filename}`);
    },

    // Networks (.network file management)
    getNetworks: async () => {
        const response = await axios.get<InterfaceFile[]>(`${API_Base}/networks`);
        return response.data;
    },
    createNetwork: async (filename: string, config: NetworkConfig) => {
        const response = await axios.post(`${API_Base}/networks`, { filename, config });
        return response.data;
    },
    deleteNetwork: async (filename: string) => {
        await axios.delete(`${API_Base}/networks/${filename}`);
    },

    // Link Configs (.link file management)
    getLinkConfigs: async () => {
        const response = await axios.get<InterfaceFile[]>(`${API_Base}/links`);
        return response.data;
    },
    createLink: async (filename: string, config: any) => {
        const response = await axios.post(`${API_Base}/links`, { filename, config });
        return response.data;
    },
    deleteLink: (filename: string) =>
        axios.delete(`${API_Base}/links/${filename}`).then(res => res.data),

    // System
    reconfigure: (interfaces?: string[]) =>
        axios.post(`${API_Base}/system/reconfigure`, { interfaces: interfaces || [] }).then(res => res.data),

    // Generic Config Reader
    getNetwork: async (filename: string, type: 'network' | 'netdev' | 'link' = 'network') => {
        let endpoint = 'networks';
        if (type === 'netdev') endpoint = 'netdevs';
        if (type === 'link') endpoint = 'links';

        const response = await axios.get<any>(`${API_Base}/${endpoint}/${filename}`);
        return response.data;
    },

    // System Management (Runtime Status & Global Config)
    getSystemStatus: async () => { // Replaces getInterfaces & getInfo
        const response = await axios.get<SystemStatus>(`${API_Base}/system/status`);
        return response.data;
    },
    getGlobalConfig: async () => {
        const response = await axios.get<{ content: string }>(`${API_Base}/system/config`);
        return response.data;
    },
    saveGlobalConfig: async (content: string) => {
        await axios.post(`${API_Base}/system/config`, { content });
    },
    reloadNetworkd: async () => {
        const response = await axios.post<{ message: string, output: string }>(`${API_Base}/system/reload`);
        return response.data;
    },
    getRoutes: async () => {
        const response = await axios.get<{ routes: string, rules: string }>(`${API_Base}/system/routes`);
        return response.data;
    },
    getLogs: async () => {
        const response = await axios.get<{ logs: string }>(`${API_Base}/system/logs`);
        return response.data;
    },

    // Host Management
    setHost: (host: string) => {
        currentHost = host;
    },
    getCurrentHost: () => currentHost,

    getHosts: async () => {
        const response = await axios.get<HostConfig[]>(`${API_Base}/system/hosts`);
        return response.data;
    },
    addHost: async (host: HostConfig) => {
        await axios.post(`${API_Base}/system/hosts`, host);
    },
    removeHost: async (name: string) => {
        await axios.delete(`${API_Base}/system/hosts/${name}`);
    },
    getPublicSSHKey: async () => {
        const response = await axios.get<string>(`${API_Base}/system/ssh-key`);
        return response.data;
    },
};
