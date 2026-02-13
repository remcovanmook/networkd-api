
export type CategoryTier = 'basic' | 'advanced' | 'expert';

export interface ValidationConstraints {
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    examples?: any[];
}

export interface ConfigOption {
    key: string;
    name: string;
    label: string;
    description?: string;
    type: string;
    types?: string[];
    options?: string[];
    category: CategoryTier;
    subcategory?: string;
    required?: boolean;
    default?: any;
    placeholder?: string;
    dynamic_options?: string;
    ini_name?: string;
    validation?: ValidationConstraints;
}

export interface SectionDef {
    name: string;
    label: string;
    description?: string;
    docUrl?: string;
    multiple?: boolean;
    category: CategoryTier;
    options: ConfigOption[];
}

export type SchemaMap = Record<string, SectionDef>;

interface MapTypeResult {
    type: string;
    types: string[];
    options?: string[];
    validation: ValidationConstraints;
}

function mapType(prop: any, definitions: any): MapTypeResult {
    let types: string[] = [];
    let primaryType = 'string';
    let options: string[] | undefined = undefined;
    const validation: ValidationConstraints = {};

    const resolveRef = (ref: string) => {
        const name = ref.replace('#/definitions/', '');
        return definitions[name];
    };

    const collectConstraints = (p: any) => {
        if (p.minimum !== undefined && (validation.minimum === undefined || p.minimum > validation.minimum)) {
            validation.minimum = p.minimum;
        }
        if (p.maximum !== undefined && (validation.maximum === undefined || p.maximum < validation.maximum)) {
            validation.maximum = p.maximum;
        }
        if (p.minLength !== undefined) validation.minLength = p.minLength;
        if (p.maxLength !== undefined) validation.maxLength = p.maxLength;
        if (p.pattern && !validation.pattern) validation.pattern = p.pattern;
        if (p.examples && !validation.examples) validation.examples = p.examples;
    };

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
                if (def) {
                    collectConstraints(def);
                    collect(def);
                }
            }
            return;
        }

        collectConstraints(p);

        if (p.enum) {
            types.push('select');
            options = p.enum;
            return;
        }

        if (p.type === 'boolean') types.push('boolean');
        else if (p.type === 'integer' || p.type === 'number') types.push('number');
        else if (p.type === 'array') {
            types.push('list');
            // Extract constraints from array items
            if (p.items) collect(p.items);
        }
        else if (p.type === 'string') types.push('string');

        if (p.oneOf) p.oneOf.forEach(collect);
        if (p.anyOf) p.anyOf.forEach(collect);
        if (p.allOf) p.allOf.forEach(collect);
    };

    // Also collect top-level constraints (e.g. from allOf wrappers)
    collectConstraints(prop);
    collect(prop);

    types = Array.from(new Set(types));

    if (types.includes('select')) primaryType = 'select';
    else if (types.includes('boolean') && types.includes('select')) {
        if (options) primaryType = 'select';
        else primaryType = 'boolean';
    }
    else if (types.includes('boolean')) primaryType = 'boolean';
    else if (types.includes('list')) primaryType = 'list';
    else if (types.includes('mac')) primaryType = 'mac';
    else if (types.includes('ip') || types.includes('ipv4') || types.includes('ipv6')) primaryType = 'ip';
    else if (types.includes('duration')) primaryType = 'duration';
    else if (types.includes('bytes')) primaryType = 'bytes';
    else if (types.includes('number')) primaryType = 'number';

    return { type: primaryType, types, options, validation };
}

function resolveCategoryTier(xCategory: string | undefined): CategoryTier {
    if (xCategory === 'basic') return 'basic';
    if (xCategory === 'advanced') return 'advanced';
    return 'expert';
}

export function processSchema(schema: any, targetVersion: number | null = null): SchemaMap {
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
                    const propVariant = sectionDef.oneOf.find((v: any) => v.properties);
                    if (propVariant) objectDef = propVariant;
                }
            }
        }

        // Hardcoded overrides for known multiple sections
        if (['Address', 'Route', 'RoutingPolicyRule', 'Neighbor', 'IPv6AddressLabel', 'IPv6Prefix', 'IPv6RoutePrefix', 'DHCPv4', 'DHCPv6'].includes(sectionName)) {
            isMultiple = true;
        }

        // Resolve $ref if objectDef points to a definition
        if (objectDef.$ref) {
            const refName = objectDef.$ref.replace('#/definitions/', '');
            if (definitions[refName]) {
                objectDef = definitions[refName];
            }
        }

        if (!objectDef.properties && !objectDef.oneOf && !objectDef.allOf) continue;

        if (targetVersion !== null && objectDef.version_added) {
            const added = parseInt(objectDef.version_added, 10);
            if (!isNaN(added) && added > targetVersion) {
                continue;
            }
        }

        // Section-level category from x-category (on the raw sectionDef, not the resolved objectDef)
        const sectionCategory = resolveCategoryTier(sectionDef['x-category'] || objectDef['x-category']);

        const sectionProps = objectDef.properties || {};
        const optionsDocs: ConfigOption[] = [];

        for (const [key, propDef] of Object.entries(sectionProps) as [string, any][]) {
            // Skip internal comment properties — these are INI comment lines, not config fields
            if (key === '_comments' || key === '_property_comments') continue;

            if (targetVersion !== null && propDef.version_added) {
                const added = parseInt(propDef.version_added, 10);
                if (!isNaN(added) && added > targetVersion) {
                    continue;
                }
            }

            const { type, types, options, validation } = mapType(propDef, definitions);
            const description = propDef.description || '';

            // Merge top-level examples/default from the propDef itself
            if (propDef.examples && !validation.examples) {
                validation.examples = propDef.examples;
            }

            // Field-level category: use field's own x-category, or inherit from section
            const fieldCategory = propDef['x-category']
                ? resolveCategoryTier(propDef['x-category'])
                : sectionCategory;

            // Only include validation if it has any constraints
            const hasValidation = validation.minimum !== undefined || validation.maximum !== undefined ||
                validation.minLength !== undefined || validation.maxLength !== undefined ||
                validation.pattern !== undefined || validation.examples !== undefined;

            optionsDocs.push({
                key,
                name: key,
                label: propDef.title || key,
                description,
                type,
                types,
                options,
                category: fieldCategory,
                subcategory: propDef['x-subcategory'],
                required: false,
                default: propDef.default,
                ...(hasValidation ? { validation } : {}),
            });
        }

        sections[sectionName] = {
            name: sectionName,
            label: sectionName,
            description: objectDef.description || sectionDef.description || '',
            docUrl: objectDef.documentation || sectionDef.documentation || '',
            multiple: isMultiple,
            category: sectionCategory,
            options: optionsDocs
        };
    }
    return sections;
}

// Tunnel kinds that map to the [Tunnel] section (not auto-derivable from schema dependencies)
const TUNNEL_KINDS = ['ipip', 'sit', 'gre', 'gretap', 'ip6gre', 'ip6gretap', 'ip6tnl', 'vti', 'vti6', 'erspan'];

// Kind→section mappings not present in the schema's dependencies keyword
const EXTRA_KIND_SECTIONS: Record<string, string[]> = {
    veth: ['Peer'],
    vxcan: ['VXCAN'],
    xfrm: ['Xfrm'],
    hsr: ['HSR'],
    dummy: [],
};

// Curated list of commonly used netdev kinds for the wizard
const COMMON_KINDS = ['bridge', 'bond', 'vlan', 'vxlan', 'wireguard', 'macvlan', 'dummy', 'tun', 'tap', 'veth'];

export interface NetDevKindInfo {
    kindSections: Record<string, string[]>;
    commonKinds: string[];
}

export function extractNetdevKinds(schema: any): NetDevKindInfo {
    const kindSections: Record<string, string[]> = {};
    const deps = schema.dependencies || {};

    // Extract kind→sections from the dependency graph
    // Pattern: dep.properties.NetDev.not.properties.Kind.not.const = kindValue
    for (const [sectionName, dep] of Object.entries(deps) as [string, any][]) {
        const kindConst = dep?.properties?.NetDev?.not?.properties?.Kind?.not?.const;
        if (kindConst) {
            if (!kindSections[kindConst]) {
                kindSections[kindConst] = ['NetDev'];
            }
            kindSections[kindConst].push(sectionName);
        }
        // The Tunnel section has a different pattern (just requires Kind, no specific value)
        // — handled via TUNNEL_KINDS fallback below
    }

    // Add tunnel kinds
    for (const kind of TUNNEL_KINDS) {
        if (!kindSections[kind]) {
            kindSections[kind] = ['NetDev'];
        }
        if (!kindSections[kind].includes('Tunnel')) {
            kindSections[kind].push('Tunnel');
        }
    }

    // Add extra kinds not in dependencies
    for (const [kind, sections] of Object.entries(EXTRA_KIND_SECTIONS)) {
        if (!kindSections[kind]) {
            kindSections[kind] = ['NetDev', ...sections];
        } else {
            for (const s of sections) {
                if (!kindSections[kind].includes(s)) {
                    kindSections[kind].push(s);
                }
            }
        }
    }

    // Filter common kinds to those actually present
    const commonKinds = COMMON_KINDS.filter(k => kindSections[k]);

    return { kindSections, commonKinds };
}
