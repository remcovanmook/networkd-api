"use strict";
// tools/schema-generator/infer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferOption = inferOption;
function inferOption(key, description) {
    const d = description.toLowerCase();
    if (d.includes('takes a boolean') || d.includes('boolean value')) {
        return { type: 'boolean' };
    }
    const enumMatch = description.match(/one of ([^.\n]+)/i);
    if (enumMatch) {
        const values = enumMatch[1]
            .replace(/"/g, '')
            .split(/,\s*/)
            .map(v => v.trim())
            .filter(Boolean);
        if (values.length > 0) {
            return { type: 'enum', enumValues: values };
        }
    }
    if (d.includes('space-separated') ||
        d.includes('list of') ||
        d.includes('may be specified more than once')) {
        return { type: 'list', multiple: true };
    }
    if (d.includes('number') ||
        d.includes('seconds') ||
        d.includes('bytes') ||
        d.includes('milliseconds')) {
        return { type: 'number' };
    }
    return { type: 'string' };
}
