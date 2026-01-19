"use strict";
// tools/schema-generator/emit-ts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSchema = emitSchema;
// Helper to preprocess config for faster lookup
function createLookups(config) {
    const categoryMap = {};
    const visibleOptionsMap = {};
    const categoryOrder = [];
    config.forEach(cat => {
        categoryOrder.push(cat.name);
        cat.sections.forEach(sec => {
            categoryMap[sec.name] = cat.name;
            if (sec.visible) {
                visibleOptionsMap[sec.name] = sec.visible;
            }
        });
    });
    return { categoryMap, visibleOptionsMap, categoryOrder };
}
function emitSection(section, lookups) {
    const category = lookups.categoryMap[section.name] || 'Advanced';
    const visibleOpts = lookups.visibleOptionsMap[section.name] || [];
    const opts = section.options.map((o) => {
        // Determine if Advanced
        // If visibleOpts is empty/undefined, ALL are advanced? 
        // User said: "items within a section that are not advanced"
        // So if listed in visible, it's NOT advanced.
        const isAdvanced = !visibleOpts.includes(o.key);
        if (o.type === 'enum') {
            return `{
        key: '${o.key}',
        name: '${o.key}', 
        label: '${o.key}',
        type: 'select',
        options: ${JSON.stringify(o.enumValues)},
        advanced: ${isAdvanced},
      }`;
        }
        return `{
      key: '${o.key}',
      name: '${o.key}',
      label: '${o.key}',
      type: '${o.type === 'list' ? 'list' : o.type}',
      advanced: ${isAdvanced},
    }`;
    });
    return `
  '${section.name}': {
    name: '${section.name}',
    label: '${section.name}',
    category: '${category}',
    options: [
      ${opts.join(',\n')}
    ],
  }`;
}
function emitSchema(network, netdev, config) {
    const lookups = createLookups(config);
    return `
// GENERATED FILE - DO NOT EDIT
// systemd ${network.unit} + ${netdev.unit}

// Derived from schema-config.json
export const CATEGORY_ORDER = ${JSON.stringify([...lookups.categoryOrder, 'Advanced'])};

export const NETWORK_SECTIONS = {
${network.sections.map(s => emitSection(s, lookups)).join(',')}
};

export const NETDEV_SECTIONS = {
${netdev.sections.map(s => emitSection(s, lookups)).join(',')}
};

// STATIC DEFINITIONS APPENDED BY GENERATOR

export interface ConfigOption {
    key: string;
    name: string;
    label: string;
    type: string;
    options?: string[];
    advanced?: boolean;
    required?: boolean;
    placeholder?: string;
    dynamic_options?: string;
    ini_name?: string;
}

export const COMMON_NETDEV_KINDS = ['bridge', 'bond', 'vlan', 'vxlan', 'wireguard', 'macvlan', 'dummy', 'tun', 'tap', 'veth'];

export const NETDEV_KINDS: Record<string, string[]> = {
    bridge: ['NetDev', 'Bridge'],
    bond: ['NetDev', 'Bond'],
    vlan: ['NetDev', 'VLAN'],
    vxlan: ['NetDev', 'VXLAN'],
    wireguard: ['NetDev', 'WireGuard', 'WireGuardPeer'],
    macvlan: ['NetDev', 'MACVLAN'],
    tun: ['NetDev', 'Tun'],
    tap: ['NetDev', 'Tap'],
    ipip: ['NetDev', 'Tunnel'],
    gre: ['NetDev', 'Tunnel'],
    sit: ['NetDev', 'Tunnel'],
    vti: ['NetDev', 'Tunnel'],
    veth: ['NetDev', 'Peer'],
    dummy: ['NetDev'],
};
`;
}
