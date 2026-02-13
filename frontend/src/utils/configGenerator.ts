
import { type ConfigOption } from './schemaProcessor';

// Helper to check if a value is "empty"
const isEmpty = (value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
};

// Coerce config values to match schema types before sending to backend
// This ensures integers are sent as numbers, not strings
export const coerceConfigTypes = (
    config: any,
    sections: Record<string, { options: ConfigOption[], name?: string }>
): any => {
    const result = { ...config };

    for (const key of Object.keys(sections)) {
        const sectionDef = sections[key];
        const sectionName = sectionDef.name || key;
        const sectionData = result[sectionName];
        if (!sectionData) continue;

        const coerceItem = (item: any): any => {
            const coerced = { ...item };
            for (const opt of sectionDef.options) {
                const val = coerced[opt.name];
                if (val === undefined || val === null || val === '') continue;
                if (opt.type === 'number' || opt.types?.includes('number')) {
                    if (typeof val === 'string') {
                        const num = Number(val);
                        if (!isNaN(num)) coerced[opt.name] = num;
                    }
                }
            }
            return coerced;
        };

        if (Array.isArray(sectionData)) {
            result[sectionName] = sectionData.map(coerceItem);
        } else if (typeof sectionData === 'object') {
            result[sectionName] = coerceItem(sectionData);
        }
    }

    return result;
};

// Generate INI content from config object and schema
export const generateINI = (
    config: any,
    sections: Record<string, { options: ConfigOption[], name?: string }>
): string => {
    let output = '';

    const renderSectionBlock = (sectionName: string, sectionDef: { options: ConfigOption[] }, data: any) => {
        const hasData = Object.values(data).some(val => !isEmpty(val));
        if (!hasData) return;

        output += `[${sectionName}]\n`;

        sectionDef.options.forEach(opt => {
            const val = data[opt.name];
            if (isEmpty(val)) return;

            if (Array.isArray(val)) {
                val.forEach(item => {
                    output += `${opt.name}=${item}\n`;
                });
            } else {
                output += `${opt.name}=${val}\n`;
            }
        });

        output += '\n';
    };

    // Iterate through schema sections to maintain order
    Object.keys(sections).forEach(key => {
        const sectionDef = sections[key];
        const sectionName = sectionDef.name || key;
        const sectionData = config[sectionName];

        if (!sectionData) return;

        // Handle repeatable sections stored as arrays
        if (Array.isArray(sectionData)) {
            sectionData.forEach(item => renderSectionBlock(sectionName, sectionDef, item));
        } else {
            renderSectionBlock(sectionName, sectionDef, sectionData);
        }
    });

    return output.trim();
};
