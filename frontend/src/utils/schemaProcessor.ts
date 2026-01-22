
export interface ConfigOption {
    key: string;
    name: string;
    label: string;
    description?: string;
    type: string;
    types?: string[];
    options?: string[];
    advanced?: boolean;
    required?: boolean;
    default?: any;
    placeholder?: string;
    dynamic_options?: string;
    ini_name?: string;
}

export interface SectionDef {
    name: string;
    label: string;
    description?: string;
    docUrl?: string;
    multiple?: boolean;
    options: ConfigOption[];
}

export type SchemaMap = Record<string, SectionDef>;

function mapType(prop: any, definitions: any): { type: string, types: string[], options?: string[] } {
    let types: string[] = [];
    let primaryType = 'string';
    let options: string[] | undefined = undefined;

    const resolveRef = (ref: string) => {
        const name = ref.replace('#/definitions/', '');
        return definitions[name];
    };

    // Recursive type collection for oneOf/anyOf
    const collect = (p: any) => {
        if (p.$ref) {
            const refName = p.$ref.replace('#/definitions/', '');
            if (refName === 'mac_address') types.push('mac');
            else if (refName === 'ipv4_address') types.push('ipv4');
            else if (refName === 'ipv6_address') types.push('ipv6');
            else if (refName === 'ip_address') types.push('ip');
            else if (refName === 'seconds') types.push('duration');
            else if (refName === 'bytes' || refName === 'MTUBytes' || refName === 'MTUv6Bytes') types.push('bytes');
            else if (refName === 'ipv4_prefix' || refName === 'ipv6_prefix' || refName === 'ip_prefix') types.push('prefix');
            else {
                const def = resolveRef(p.$ref);
                if (def) collect(def);
            }
            return;
        }

        if (p.enum) {
            types.push('select');
            options = p.enum;
            return;
        }

        if (p.type === 'boolean') types.push('boolean');
        else if (p.type === 'integer' || p.type === 'number') types.push('number');
        else if (p.type === 'array') types.push('list');
        else if (p.type === 'string') types.push('string');

        if (p.oneOf) p.oneOf.forEach(collect);
        if (p.anyOf) p.anyOf.forEach(collect);
        if (p.allOf) p.allOf.forEach(collect);
    };

    collect(prop);

    // Filter duplicates
    types = Array.from(new Set(types));

    // Heuristics
    if (types.includes('select')) primaryType = 'select';
    else if (types.includes('boolean') && types.includes('select')) {
        if (options) primaryType = 'select'; // Prefer explicit enum
        else primaryType = 'boolean';
    }
    else if (types.includes('boolean')) primaryType = 'boolean';
    else if (types.includes('list')) primaryType = 'list';
    else if (types.includes('mac')) primaryType = 'mac';
    else if (types.includes('ip') || types.includes('ipv4') || types.includes('ipv6')) primaryType = 'ip';
    else if (types.includes('duration')) primaryType = 'duration';
    else if (types.includes('bytes')) primaryType = 'bytes';
    else if (types.includes('number')) primaryType = 'number';

    return { type: primaryType, types, options };
}

export function processSchema(schema: any): SchemaMap {
    const definitions = schema.definitions || {};
    const sections: SchemaMap = {};

    const rootProps = schema.properties || {};

    for (const [sectionName, sectionDef] of Object.entries(rootProps) as [string, any][]) {
        let isMultiple = false;
        let objectDef = sectionDef;

        // Detect multiplicity
        if (sectionDef.type === 'array' && sectionDef.items) {
            isMultiple = true;
            objectDef = sectionDef.items;
        } else if (sectionDef.oneOf) {
            const arrayVariant = sectionDef.oneOf.find((v: any) => v.type === 'array');
            if (arrayVariant) {
                isMultiple = true;
                objectDef = arrayVariant.items;
            } else {
                const objectVariant = sectionDef.oneOf.find((v: any) => v.type === 'object');
                if (objectVariant) objectDef = objectVariant;
                else {
                    // Try to find one with properties
                    const propVariant = sectionDef.oneOf.find((v: any) => v.properties);
                    if (propVariant) objectDef = propVariant;
                }
            }
        }

        // Hardcoded overrides for known multiple sections (heuristic)
        // [Address], [Route] are usually multiple.
        if (['Address', 'Route', 'RoutingPolicyRule', 'Neighbor', 'IPv6AddressLabel', 'IPv6Prefix', 'IPv6RoutePrefix', 'DHCPv4', 'DHCPv6'].includes(sectionName)) {
            isMultiple = true;
        }
        // [Network] is singular. [Match] is singular. [NetDev] is singular.

        if (!objectDef.properties && !objectDef.oneOf && !objectDef.allOf) continue;

        // If objectDef doesn't have properties directly, it might be an allOf/oneOf mix.
        // For now assume properties exist or we skip.
        // In systemd schema, sections usually have properties.
        const sectionProps = objectDef.properties || {};
        const optionsDocs: ConfigOption[] = [];

        for (const [key, propDef] of Object.entries(sectionProps) as [string, any][]) {
            const { type, types, options } = mapType(propDef, definitions);
            const description = propDef.description || '';

            optionsDocs.push({
                key,
                name: key,
                label: key, // Could be prettier
                description,
                type: type,
                types: types,
                options: options,
                advanced: false,
                required: false, // Extract from required list if needed
                default: propDef.default
            });
        }

        sections[sectionName] = {
            name: sectionName,
            label: sectionName,
            description: objectDef.description || sectionDef.description || '',
            docUrl: objectDef.documentation || sectionDef.documentation || '',
            multiple: isMultiple,
            options: optionsDocs
        };
    }
    return sections;
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
