export interface ConfigOption {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'list' | 'boolean';
    options?: string[]; // For select type
    description?: string;
    placeholder?: string;
    required?: boolean;
    dynamic_options?: 'vlan' | 'bridge' | 'bond';
    advanced?: boolean;
    ini_name?: string; // Explicit INI key if not PascalCase
}

export interface ConfigSection {
    name: string;
    label: string;
    options: ConfigOption[];
    advanced?: boolean;
}

export interface KindDefinition {
    kind: string;
    label: string;
    sections: string[]; // Names of sections applicable to this kind
}

// Common Network Sections applicable to .network files (Physical or Virtual matched)
export const NETWORK_SECTIONS: Record<string, ConfigSection> = {
    'Match': {
        name: 'match',
        label: 'Match (Device Selection)',
        options: [
            { name: 'name', label: 'Interface Name', type: 'text', placeholder: 'eth0', description: 'Match by device name (e.g. eth0, vlan10)', required: true },
            { name: 'mac_address', label: 'MAC Address', type: 'text', placeholder: '00:11:22:33:44:55', advanced: true, ini_name: 'MACAddress' },
            { name: 'driver', label: 'Driver', type: 'text', advanced: true },
            { name: 'type', label: 'Device Type', type: 'text', advanced: true },
            { name: 'kind', label: 'Device Kind', type: 'text', advanced: true },
        ]
    },
    'Link': {
        name: 'link',
        label: 'Link Settings', // Physical link properties
        advanced: true,
        options: [
            { name: 'mac_address', label: 'MAC Address', type: 'text', description: 'Spoof/Set MAC Address', ini_name: 'MACAddress' },
            { name: 'mtu_bytes', label: 'MTU', type: 'text', placeholder: '1500 or "infinity"', ini_name: 'MTUBytes' },
            { name: 'unmanaged', label: 'Unmanaged', type: 'select', options: ['yes', 'no'] },
            { name: 'required_for_online', label: 'Required for Online', type: 'select', options: ['yes', 'no', 'degraded', 'carrier', 'routable'], ini_name: 'RequiredForOnline' },
        ]
    },
    'Network': {
        name: 'network',
        label: 'Network',
        options: [
            // Common
            { name: 'dhcp', label: 'DHCP', type: 'select', options: ['yes', 'no', 'ipv4', 'ipv6'], ini_name: 'DHCP' },
            { name: 'address', label: 'Addresses (CIDR)', type: 'list', placeholder: '192.168.1.5/24' },
            { name: 'gateway', label: 'Gateways', type: 'list', placeholder: '192.168.1.1' },
            { name: 'dns', label: 'DNS Servers', type: 'list', placeholder: '8.8.8.8', ini_name: 'DNS' },

            // Advanced / Less Common
            { name: 'domains', label: 'Search Domains', type: 'list', advanced: true },
            { name: 'ntp', label: 'NTP Servers', type: 'list', advanced: true, ini_name: 'NTP' },
            { name: 'ip_forwarding', label: 'IP Forwarding', type: 'select', options: ['yes', 'no'], advanced: true, ini_name: 'IPForwarding' },
            { name: 'ipv6_accept_ra', label: 'IPv6 Accept RA', type: 'select', options: ['yes', 'no'], advanced: true, ini_name: 'IPv6AcceptRA' },
            { name: 'link_local_addressing', label: 'Link Local Addressing', type: 'select', options: ['yes', 'no', 'ipv4', 'ipv6'], advanced: true, ini_name: 'LinkLocalAddressing' },
            { name: 'vlan', label: 'VLANs (Stacked)', type: 'list', dynamic_options: 'vlan', advanced: true, ini_name: 'VLAN' }, // Stacked VLANs are advanced for physical ports usually
            { name: 'bond', label: 'Bond', type: 'text', dynamic_options: 'bond', advanced: true },
            { name: 'bridge', label: 'Bridge', type: 'text', dynamic_options: 'bridge', advanced: true },
            { name: 'vrf', label: 'VRF', type: 'text', advanced: true, ini_name: 'VRF' },
        ]
    },
    'DHCPv4': {
        name: 'dhcpv4',
        label: 'DHCPv4 Client',
        advanced: true,
        options: [
            { name: 'use_dns', label: 'Use DNS', type: 'select', options: ['yes', 'no'], ini_name: 'UseDNS' },
            { name: 'use_ntp', label: 'Use NTP', type: 'select', options: ['yes', 'no'], ini_name: 'UseNTP' },
            { name: 'use_domains', label: 'Use Domains', type: 'select', options: ['yes', 'no'], ini_name: 'UseDomains' },
            { name: 'use_mtu', label: 'Use MTU', type: 'select', options: ['yes', 'no'], ini_name: 'UseMTU' },
        ]
    },
    'DHCPv6': {
        name: 'dhcpv6',
        label: 'DHCPv6 Client',
        advanced: true,
        options: [
            { name: 'use_dns', label: 'Use DNS', type: 'select', options: ['yes', 'no'], ini_name: 'UseDNS' },
            { name: 'use_ntp', label: 'Use NTP', type: 'select', options: ['yes', 'no'], ini_name: 'UseNTP' },
            { name: 'prefix_delegation_hint', label: 'Prefix Delegation Hint', type: 'text', ini_name: 'PrefixDelegationHint' },
        ]
    },
    'Route': {
        name: 'routes', // Maps to Routes []RouteSection
        label: 'Static Routes',
        advanced: true,
        options: [
            { name: 'destination', label: 'Destination', type: 'text', placeholder: '10.0.0.0/8' },
            { name: 'gateway', label: 'Gateway', type: 'text', placeholder: '192.168.1.1' },
            { name: 'metric', label: 'Metric', type: 'number' },
            { name: 'source', label: 'Source (Preferred Source)', type: 'text' },
        ]
    }
};

// NetDev Sections for Virtual Devices
export const NETDEV_SECTIONS: Record<string, ConfigSection> = {
    'NetDev': { // Common for all
        name: 'netdev',
        label: 'General Device Settings',
        options: [
            { name: 'name', label: 'Device Name', type: 'text', required: true, description: 'Name of the virtual interface (e.g. vlan100)' },
            { name: 'kind', label: 'Kind', type: 'text', required: true }, // Usually hidden/fixed
            { name: 'mtu_bytes', label: 'MTU', type: 'text', advanced: true, ini_name: 'MTUBytes' },
            { name: 'mac_address', label: 'MAC Address', type: 'text', advanced: true, ini_name: 'MACAddress' },
        ]
    },
    'VLAN': {
        name: 'vlan',
        label: 'VLAN Settings',
        options: [
            { name: 'id', label: 'VLAN ID', type: 'number', required: true, description: 'VLAN Tag (0-4094)', ini_name: 'Id' },
        ]
    },
    'Bridge': {
        name: 'bridge',
        label: 'Bridge Settings',
        options: [
            { name: 'stp', label: 'STP (Spanning Tree)', type: 'select', options: ['yes', 'no'], advanced: false, ini_name: 'STP' },
        ]
    },
    'Bond': {
        name: 'bond',
        label: 'Bond Settings',
        options: [
            { name: 'mode', label: 'Bond Mode', type: 'select', options: ['balance-rr', 'active-backup', 'balance-xor', 'broadcast', '802.3ad', 'balance-tlb', 'balance-alb'], required: true },
            { name: 'transmit_hash_policy', label: 'Transmit Hash Policy', type: 'select', options: ['layer2', 'layer2+3', 'layer3+4', 'encap2+3', 'encap3+4'], advanced: true, ini_name: 'TransmitHashPolicy' },
            { name: 'lacp_transmit_rate', label: 'LACP Rate', type: 'select', options: ['slow', 'fast'], advanced: true, ini_name: 'LACPTransmitRate' },
            { name: 'mii_monitor_sec', label: 'MII Monitor', type: 'text', placeholder: '100ms', advanced: true, ini_name: 'MIIMonitorSec' },
        ]
    },
    'VXLAN': {
        name: 'vxlan',
        label: 'VXLAN Settings',
        options: [
            { name: 'vni', label: 'VNI', type: 'number', required: true, ini_name: 'VNI' },
            { name: 'local', label: 'Local IP', type: 'text' },
            { name: 'remote', label: 'Remote IP (Multicast Group)', type: 'text' },
            { name: 'destination_port', label: 'Dest Port', type: 'number', placeholder: '4789', advanced: true, ini_name: 'DestinationPort' },
        ]
    },
    'WireGuard': {
        name: 'wireguard',
        label: 'WireGuard Interface',
        options: [
            { name: 'private_key', label: 'Private Key', type: 'text', required: true, ini_name: 'PrivateKey' },
            { name: 'listen_port', label: 'Listen Port', type: 'number', ini_name: 'ListenPort' },
        ]
    },
    'WireGuardPeer': {
        name: 'wireguard_peers', // Array
        label: 'WireGuard Peers',
        options: [
            { name: 'public_key', label: 'Public Key', type: 'text', required: true, ini_name: 'PublicKey' },
            { name: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'ip:port' },
            { name: 'allowed_ips', label: 'Allowed IPs', type: 'list', ini_name: 'AllowedIPs' },
            { name: 'preshared_key', label: 'Preshared Key', type: 'text', advanced: true, ini_name: 'PresharedKey' },
        ]
    },
    'Tun': {
        name: 'tun',
        label: 'Tun Settings',
        advanced: true,
        options: [
            { name: 'multi_queue', label: 'Multi Queue', type: 'select', options: ['yes', 'no'], ini_name: 'MultiQueue' },
            { name: 'packet_info', label: 'Packet Info', type: 'select', options: ['yes', 'no'], ini_name: 'PacketInfo' },
        ]
    },
    'Tap': {
        name: 'tap',
        label: 'Tap Settings',
        advanced: true,
        options: [
            { name: 'multi_queue', label: 'Multi Queue', type: 'select', options: ['yes', 'no'], ini_name: 'MultiQueue' },
            { name: 'packet_info', label: 'Packet Info', type: 'select', options: ['yes', 'no'], ini_name: 'PacketInfo' },
        ]
    },
    'MACVLAN': {
        name: 'macvlan',
        label: 'MACVLAN Settings',
        options: [
            { name: 'mode', label: 'Mode', type: 'select', options: ['private', 'vepa', 'bridge', 'passthru', 'source'] },
        ]
    },
    'IPVLAN': {
        name: 'ipvlan',
        label: 'IPVLAN Settings',
        options: [
            { name: 'mode', label: 'Mode', type: 'select', options: ['l2', 'l3', 'l3s'] },
        ]
    },
    'VRF': {
        name: 'vrf',
        label: 'VRF Settings',
        options: [
            { name: 'table', label: 'Routing Table ID', type: 'number', required: true }
        ]
    }
};

export const COMMON_NETDEV_KINDS = ['bridge', 'vlan', 'bond', 'vxlan', 'wireguard'];

// NetDev Kinds mapping to their specific config sections
// Expanded list based on systemd.netdev
export const NETDEV_KINDS: Record<string, string[]> = {
    // Common
    'bridge': ['NetDev', 'Bridge'],
    'vlan': ['NetDev', 'VLAN'],
    'bond': ['NetDev', 'Bond'],
    'vxlan': ['NetDev', 'VXLAN'],
    'wireguard': ['NetDev', 'WireGuard'],

    // Advanced / Less Common
    'dummy': ['NetDev'],
    'veth': ['NetDev'], // Peer section needed? keeping simple for now
    'macvlan': ['NetDev', 'MACVLAN'],
    'ipvlan': ['NetDev', 'IPVLAN'],
    'macvtap': ['NetDev', 'MACVLAN'], // Reuses MACVLAN config usually
    'ipvtap': ['NetDev', 'IPVLAN'],
    'tun': ['NetDev', 'Tun'],
    'tap': ['NetDev', 'Tap'],
    'geneve': ['NetDev'], // Needs Geneve section
    'vrf': ['NetDev', 'VRF'],
    'ipoib': ['NetDev'],
    'nlmon': ['NetDev'],
};
