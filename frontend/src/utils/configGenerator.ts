
import { type ConfigOption } from './schemaProcessor';

// Helper to check if a value is "empty"
const isEmpty = (value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
};

// Generate INI content from config object and schema
export const generateINI = (
    config: any,
    sections: Record<string, { options: ConfigOption[], name?: string }>
): string => {
    let output = '';

    // Iterate through schema sections to maintain order
    Object.keys(sections).forEach(key => {
        const sectionDef = sections[key];
        const sectionName = sectionDef.name || key;
        const sectionData = config[sectionName];

        if (!sectionData) return;

        // Check if section has any data
        const hasData = Object.values(sectionData).some(val => !isEmpty(val));
        if (!hasData) return;

        output += `[${sectionName}]\n`;

        // Iterate through options in schema order
        sectionDef.options.forEach(opt => {
            const val = sectionData[opt.name];
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
    });

    return output.trim();
};
