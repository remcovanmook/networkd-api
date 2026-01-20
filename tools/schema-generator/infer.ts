// tools/schema-generator/infer.ts

import { OptionType } from './types';

export function inferOption(
  key: string,
  description: string
): {
  types: OptionType[];
  enumValues?: string[];
  multiple?: boolean;
  default?: string | number | boolean;
} {
  const d = description.toLowerCase();
  const defVal = extractDefault(description);
  const types: OptionType[] = [];
  let enumValues: string[] = [];

  // Boolean
  if (
    d.includes('takes a boolean') ||
    d.includes('boolean value') ||
    d.includes('boolean argument') ||
    d.startsWith('when true')
  ) {
    types.push('boolean');
  }

  // Enums - Pattern 1 (Takes one of...)
  let enumMatch = description.match(/takes one of ([^.\n]+)/i);
  if (!enumMatch) {
    // Enum - Pattern 2 (Accepts "A", "B", ...)
    enumMatch = description.match(/accepts ([^.\n]+)/i);
  }

  if (enumMatch) {
    let raw = enumMatch[1];
    // Special case for 'a boolean' mixed with enums
    if (raw.includes('boolean')) {
      if (!types.includes('boolean')) types.push('boolean');
      raw = raw.replace('a boolean', '');
    }

    // Remove "or"
    raw = raw.replace(/\s+or\s+/g, ', ');

    const values = raw
      .split(/,\s*/)
      .map(v => v.replace(/['"]/g, '').trim())
      .filter(v => v && !v.includes(' ') && v.length < 50); // Sanity check length

    // Filter out garbage words that might be captured
    const cleanValues = values.filter(v => !v.match(/value|option|setting/i));

    if (cleanValues.length > 0) {
      if (!types.includes('select')) types.push('select');
      enumValues = cleanValues;
    }
  }

  // Lists
  let multiple = false;
  if (
    d.includes('space-separated') ||
    d.includes('list of') ||
    d.includes('may be specified more than once') ||
    d.includes('whitespace-separated')
  ) {
    types.push('list'); // 'list' is a type in our enum, though acts more like a modifier. 
    // Wait, types.ts has 'list' as OptionType. 
    multiple = true;
  }

  // Specific Types based on Key
  if (key === 'LinkLayerAddress') {
    // Explicit override for the user request
    if (!types.includes('mac')) types.push('mac');
    if (!types.includes('ip')) types.push('ip');
  } else {
    if (key.endsWith('Sec')) types.push('duration');
    if (key.endsWith('Bytes')) types.push('bytes');
    if (key.endsWith('Address') && !key.includes('MAC')) types.push('ip');
    if (key.endsWith('MACAddress')) types.push('mac');

    // Separate Prefix (CIDR) from PrefixLength (Number)
    if (key === 'Prefix' || key === 'Destination' || key === 'Source' || key.endsWith('DeploymentPrefix')) types.push('prefix');
    // Common heuristics
    if (key.endsWith('Prefix') && !key.startsWith('Use') && !key.endsWith('DeploymentPrefix') && key !== 'Prefix' && !key.includes('Length')) {
      // E.g. IPv6Prefix. Likely CIDR or delegate.
      types.push('prefix');
    }

    // Explicit IP keys
    if (key === 'Gateway' || key === 'DNS') types.push('ip');
  }

  // Specific Types based on Description
  if (d.includes('ipv4 address')) { if (!types.includes('ipv4')) types.push('ipv4'); }
  if (d.includes('ipv6 address')) { if (!types.includes('ipv6')) types.push('ipv6'); }
  if (d.includes('mac address') || d.includes('hardware address')) { if (!types.includes('mac')) types.push('mac'); }
  if (d.includes('inet_pton(3)')) { if (!types.includes('ip')) types.push('ip'); }

  // "prefix length" -> typically number.
  if (d.includes('prefix length') && !d.includes('followed by')) {
    if (!types.includes('number')) types.push('number');
  }
  // "subnet mask" -> usually address or prefix?
  // User wants 'prefix' to be IP/Length. 
  if (d.includes('ipv6 address with a prefix length') || d.includes('subnet mask') || d.includes('destination prefix') || d.includes('source prefix')) { if (!types.includes('prefix')) types.push('prefix'); }

  if (
    d.includes('number') ||
    d.includes('integer')
  ) {
    if (!types.includes('number')) types.push('number');
  }

  // Fallback
  if (types.length === 0) {
    types.push('string');
  }

  // Deduplicate
  const uniqueTypes = [...new Set(types)];

  return {
    types: uniqueTypes,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
    multiple,
    default: defVal
  };
}

function extractDefault(description: string): string | undefined {
  const match = description.match(/Defaults to "([^"]+)"/i) || description.match(/Defaults to ([^.,\s]+)/i);
  if (match) {
    let val = match[1];

    // Cleanup dots if captured at end (though regex excludes . inside [])
    if (val.endsWith('.')) val = val.slice(0, -1);

    if (val === 'unset') return undefined;
    if (val === 'empty') return undefined;

    // Normalize boolean defaults
    if (val.toLowerCase() === 'true') return 'yes';
    if (val.toLowerCase() === 'false') return 'no';
    if (val.toLowerCase() === 'yes') return 'yes';
    if (val.toLowerCase() === 'no') return 'no';

    return val;
  }
  return undefined;
}
