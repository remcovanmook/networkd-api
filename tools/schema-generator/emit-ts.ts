// tools/schema-generator/emit-ts.ts

import { ManPageDef } from './types';

function emitSection(section: any): string {
  const opts = section.options.map((o: any) => {
    if (o.type === 'enum') {
      return `{
        key: '${o.key}',
        name: '${o.key}', 
        label: '${o.key}',
        type: 'select',
        options: ${JSON.stringify(o.enumValues)},
        advanced: true,
      }`;
    }

    return `{
      key: '${o.key}',
      name: '${o.key}',
      label: '${o.key}',
      type: '${o.type === 'list' ? 'list' : o.type}',
      advanced: true,
    }`;
  });

  return `
  '${section.name}': {
    name: '${section.name}',
    label: '${section.name}',
    options: [
      ${opts.join(',\n')}
    ],
  }`;
}

export function emitSchema(
  network: ManPageDef,
  netdev: ManPageDef
): string {
  return `
// GENERATED FILE - DO NOT EDIT
// systemd ${network.unit} + ${netdev.unit}

export const NETWORK_SECTIONS = {
${network.sections.map(emitSection).join(',')}
};

export const NETDEV_SECTIONS = {
${netdev.sections.map(emitSection).join(',')}
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
