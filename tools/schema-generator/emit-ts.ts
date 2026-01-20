// tools/schema-generator/emit-ts.ts

import { ManPageDef } from './types';
// Use require for JSON to avoid import assertion issues in this setup
const descriptions = require('./descriptions.json');

// Helper to get doc URL
function getDocUrl(unit: string, sectionName: string): string {
  // Unit mapping to man page names
  // network -> systemd.network
  // netdev -> systemd.netdev
  // link -> systemd.link
  const page = `systemd.${unit}`;

  // Freedesktop format: #%5BSection%5D%20Section%20Options
  const anchor = `%5B${sectionName}%5D%20Section%20Options`;
  return `https://www.freedesktop.org/software/systemd/man/257/${page}.html#${anchor}`;
}

// Helper to emit a section without external config
function emitSection(section: any, unit: string): string {
  // We emit ALL options found in the manpage.

  // Check for description override
  const sectionOverride = (descriptions as any)[section.name];
  const descOverride = sectionOverride?.description;
  const description = descOverride || section.description || '';
  const docUrl = getDocUrl(unit, section.name);

  const opts = section.options.map((o: any) => {
    // Determine primary type for UI
    let primaryType = 'string';
    if (o.types.length === 1) {
      primaryType = o.types[0];
    } else {
      primaryType = 'string';
    }

    if (o.types.includes('list')) {
      primaryType = 'list';
    } else if (o.types.includes('select')) {
      if (o.types.length === 1) primaryType = 'select';
    }

    // Option Overrides
    const optOverride = sectionOverride?.options?.[o.key];
    const optDesc = optOverride?.description || o.description || '';
    const optRequired = optOverride?.required || false;

    if (optOverride?.type) {
      primaryType = optOverride.type;
    }
    const enumValues = optOverride?.options || o.enumValues;

    return `{
      key: '${o.key}',
      name: '${o.key}', 
      label: '${o.key}',
      description: ${JSON.stringify(optDesc)},
      type: '${primaryType}',
      types: ${JSON.stringify(o.types)},
      options: ${JSON.stringify(enumValues)},
      advanced: false, // Controlled by frontend View Config
      required: ${optRequired},
      default: ${JSON.stringify(o.default)},
    }`;
  });

  return `
  '${section.name}': {
    name: '${section.name}',
    label: '${section.name}',
    description: ${JSON.stringify(description)},
    docUrl: '${docUrl}',
    multiple: ${section.multiple || false},
    options: [
      ${opts.join(',\n')}
    ],
  }`;
}

export interface ConfigOption {
  key: string;
  name: string;
  label: string;
  description?: string;
  type: string;
  options?: string[];
  advanced?: boolean;
  required?: boolean;
  placeholder?: string;
  dynamic_options?: string;
  ini_name?: string;
}

export function emitSchema(
  network: ManPageDef,
  netdev: ManPageDef,
  link: ManPageDef | undefined,
): string {

  return `
// GENERATED FILE - DO NOT EDIT
// systemd ${network.unit} + ${netdev.unit} ${link ? '+ ' + link.unit : ''}

export const NETWORK_SECTIONS = {
${network.sections.map(s => emitSection(s, 'network')).join(',')}
};

export const NETDEV_SECTIONS = {
${netdev.sections.map(s => emitSection(s, 'netdev')).join(',')}
};

export const LINK_SECTIONS = {
${link ? link.sections.map(s => emitSection(s, 'link')).join(',') : ''}
};

// STATIC DEFINITIONS APPENDED BY GENERATOR

export interface ConfigOption {
    key: string;
    name: string;
    label: string;
    description?: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'list' | 'ipv4' | 'ipv6' | 'ip' | 'mac' | 'duration' | 'bytes' | 'prefix';
    types?: string[];
    options?: string[];
    advanced?: boolean;
    required?: boolean;
    placeholder?: string;
    dynamic_options?: string;
    ini_name?: string;
    default?: string | number | boolean;
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
