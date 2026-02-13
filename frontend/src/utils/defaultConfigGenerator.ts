export type ConfigType = 'network' | 'netdev' | 'link' | 'networkd-conf';

export function getDefaultConfig(configType: ConfigType, matchName?: string, netdevKind?: string): any {
    switch (configType) {
        case 'network':
            return { Match: { Name: matchName || '' }, Network: { DHCP: 'yes' } };
        case 'netdev':
            return { NetDev: { Kind: netdevKind || 'bridge' } };
        case 'link':
            return { Match: { OriginalName: matchName || '' } };
        case 'networkd-conf':
            return {};
    }
}

export function generateFilename(configType: ConfigType, config: any): string {
    switch (configType) {
        case 'network': {
            const name = config.Match?.Name || '';
            if (name) return `10-${name}.network`;
            const mac = config.Match?.MACAddress || '';
            if (mac) return `10-${mac.replace(/:/g, '')}.network`;
            return '';
        }
        case 'netdev': {
            const name = config.NetDev?.Name || '';
            return name ? `25-${name}.netdev` : '';
        }
        case 'link': {
            const name = config.Match?.OriginalName || '';
            return name ? `99-${name}.link` : '';
        }
        case 'networkd-conf':
            return 'networkd.conf';
    }
}

export function getConfigLabel(configType: ConfigType): string {
    switch (configType) {
        case 'network': return 'Network';
        case 'netdev': return 'Virtual Device';
        case 'link': return 'Link';
        case 'networkd-conf': return 'networkd.conf';
    }
}

export function getFirstTab(configType: ConfigType): string {
    switch (configType) {
        case 'network': return 'Match';
        case 'netdev': return 'NetDev';
        case 'link': return 'Match';
        case 'networkd-conf': return 'Network';
    }
}

export function getFilenameTab(configType: ConfigType): string | null {
    switch (configType) {
        case 'network': return 'Match';
        case 'netdev': return 'NetDev';
        case 'link': return 'Match';
        case 'networkd-conf': return null;
    }
}
