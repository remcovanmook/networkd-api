import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { type ConfigOption } from '../pages/schema';

// Improved validation with OR logic
const validateInput = (value: string, types: string[]): string | null => {
    if (!value) return null;

    // Filter out 'list' as it's a container type
    const valueTypes = types.filter(t => t !== 'list');
    if (valueTypes.length === 0) return null; // No specific type constraints

    let isValid = false;

    for (const type of valueTypes) {
        if (type === 'string') {
            isValid = true;
            break;
        }
        if (type === 'boolean') {
            if (['yes', 'no', 'true', 'false', '1', '0', 'on', 'off'].includes(value.toLowerCase())) {
                isValid = true;
                break;
            }
        }
        if (type === 'ipv4') {
            // Basic IPv4 (including optional CIDR)
            if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value)) {
                isValid = true;
                break;
            }
        }
        if (type === 'ipv6') {
            // Loose IPv6 regex to catch common errors but allow standard formats
            if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/.test(value)) {
                isValid = true;
                break;
            }
        }
        if (type === 'mac') {
            if (/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value)) {
                isValid = true;
                break;
            }
        }
        if (type === 'number' || type === 'integer' || type === 'bytes' || type === 'seconds' || type === 'duration') {
            const num = Number(value);
            if (!isNaN(num)) {
                // Check range if specified in type (e.g. "0-65535")
                isValid = true;
                break;
            }
            // For bytes/seconds, allow suffixes if we want to be linient, but strict schema usually implies number
            // If type is specifically 'bytes' or 'duration', we might accept strings like '1G' or '5s' which validation above might fail if purely number check
            if (type === 'bytes' && /^\d+[KMGT]?$/.test(value)) { isValid = true; break; }
            if (type === 'seconds' || type === 'duration') { isValid = true; break; } // Allow strings for duration
        }

        // Range check support (e.g. type="0-100")
        const rangeMatch = type.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const min = parseInt(rangeMatch[1]);
            const max = parseInt(rangeMatch[2]);
            const num = Number(value);
            if (!isNaN(num) && num >= min && num <= max) {
                isValid = true;
                break;
            }
        }
    }

    if (isValid) return null;
    return `Expected: ${valueTypes.map(getTypeLabel).join(' or ')}`;
};

const getTypeLabel = (type: string) => {
    if (type === 'string') return 'Text';
    if (type === 'boolean') return 'Y/N';
    if (type === 'integer' || type === 'number') return 'Num';
    if (type === 'ipv4') return 'IPv4';
    if (type === 'ipv6') return 'IPv6';
    if (type === 'mac') return 'MAC';
    if (type === 'seconds' || type === 'duration') return 'Time';
    if (type === 'bytes') return 'Bytes';
    if (type === 'list') return 'List';
    return type;
};

const getBadgeColor = (type: string) => {
    if (type === 'boolean') return '#e8f5e9'; // Green-ish
    if (type === 'integer' || type === 'number') return '#e3f2fd'; // Blue-ish
    if (type.startsWith('ipv')) return '#fff3e0'; // Orange-ish
    if (type === 'mac') return '#f3e5f5'; // Purple-ish
    return '#f5f5f5'; // Grey
};

const getBadgeTextColor = (type: string) => {
    if (type === 'boolean') return '#2e7d32';
    if (type === 'integer' || type === 'number') return '#1565c0';
    if (type.startsWith('ipv')) return '#ef6c00';
    if (type === 'mac') return '#7b1fa2';
    return '#616161';
};


interface ConfigFieldProps {
    option: ConfigOption;
    sectionName: string;
    value: any;
    onChange: (val: any) => void;
    interfaceFiles?: { type: string, netdev_kind?: string, netdev_name?: string, filename: string }[];
}

const COMMON_INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    padding: '0.6rem',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    height: '42px', // Enforce consistent height
    boxSizing: 'border-box'
};

const LABEL_STYLE: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: 500,
    fontSize: '0.9rem',
    color: 'var(--text-primary)'
};

export const ConfigField: React.FC<ConfigFieldProps> = ({ option, sectionName, value, onChange, interfaceFiles }) => {

    const localValue = value === undefined || value === null ? '' : value;
    const [inputValue, setInputValue] = useState(''); // Local state for list input
    const [listError, setListError] = useState<string | null>(null);

    // Helper to get dynamic options
    const getDynamicOptions = () => {
        if (!option.dynamic_options || !interfaceFiles) return [];
        return interfaceFiles
            .filter(f => f.type === 'netdev' && f.netdev_kind === option.dynamic_options)
            .map(f => f.netdev_name || f.filename.replace('.netdev', ''))
            .filter(Boolean);
    };

    if (option.type === 'select') {
        return (
            <div key={option.name} style={{ marginBottom: '1.2rem' }}>
                <label style={LABEL_STYLE} title={option.description}>
                    {option.label} {option.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </label>
                <select
                    value={localValue}
                    onChange={e => onChange(e.target.value)}
                    style={COMMON_INPUT_STYLE}
                >
                    <option value="">(Unset)</option>
                    {option.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (option.type === 'list') {
        const listVal: string[] = Array.isArray(localValue) ? localValue : [];
        const dynamicOpts = getDynamicOptions();
        const validTypes = option.types || ['string'];
        const displayTypes = validTypes.filter(t => t !== 'list');

        const handleAdd = (val: string) => {
            const error = validateInput(val, validTypes);
            if (error) {
                setListError(error);
                return;
            }
            if (val && !listVal.includes(val)) {
                onChange([...listVal, val]);
                setInputValue('');
                setListError(null);
            }
        };

        const badgeLabel = displayTypes.map(getTypeLabel).join('/');

        return (
            <div key={option.name} style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={LABEL_STYLE} title={option.description}>{option.label}</label>
                    <span style={{
                        fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                        background: getBadgeColor(displayTypes[0] || 'string'), color: getBadgeTextColor(displayTypes[0] || 'string')
                    }}>
                        {badgeLabel}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    {(option.dynamic_options || option.options) ? (
                        <select
                            style={{ ...COMMON_INPUT_STYLE, flex: 1 }}
                            value=""
                            onChange={(e) => handleAdd(e.target.value)}
                        >
                            <option value="">
                                {option.dynamic_options
                                    ? `Select configured ${option.dynamic_options}...`
                                    : `Select ${option.label}...`}
                            </option>
                            {(option.options || dynamicOpts).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <div style={{ flex: 1, maxWidth: '400px' }}>
                            <input
                                id={`add-${sectionName}-${option.name}`}
                                placeholder={option.placeholder || 'Add item...'}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    if (e.target.value === '') setListError(null);
                                    else {
                                        const err = validateInput(e.target.value, validTypes);
                                        setListError(err);
                                    }
                                }}
                                style={{
                                    ...COMMON_INPUT_STYLE,
                                    maxWidth: '100%', // Override max-width for flex item
                                    border: `1px solid ${listError ? 'var(--error)' : 'var(--border-color)'}`,
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        handleAdd(inputValue);
                                        e.preventDefault();
                                    }
                                }}
                            />
                            {listError && (
                                <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{listError}</div>
                            )}
                        </div>
                    )}
                    <button type="button"
                        onClick={() => handleAdd(inputValue)}
                        disabled={!!listError || !inputValue}
                        style={{
                            height: '42px', width: '42px', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: (listError || !inputValue) ? 'not-allowed' : 'pointer',
                            opacity: (listError || !inputValue) ? 0.5 : 1,
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px'
                        }}
                    >
                        <Plus size={20} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {listVal.map((item, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                            {item}
                            <button onClick={() => onChange(listVal.filter((_, i) => i !== idx))} style={{ padding: 0, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Boolean Handling
    if (option.type === 'boolean') {
        const defLabel = option.default !== undefined ? ` (Default: ${option.default === 'yes' ? 'Yes' : 'No'})` : '';
        return (
            <div key={option.name} style={{ marginBottom: '1.2rem' }}>
                <label style={LABEL_STYLE} title={option.description}>
                    {option.label}
                </label>
                <select
                    value={localValue === true ? 'yes' : localValue === false ? 'no' : (localValue || '')}
                    onChange={e => {
                        const val = e.target.value;
                        onChange(val);
                    }}
                    style={COMMON_INPUT_STYLE}
                >
                    <option value="">(Unset{defLabel})</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            </div>
        );
    }

    // Enum / Select Handling (Explicit select type)
    if ((option.type as string) === 'select' && option.options) {
        const defLabel = option.default !== undefined ? ` (Default: ${option.default})` : '';
        return (
            <div key={option.name} style={{ marginBottom: '1.2rem' }}>
                <label style={LABEL_STYLE} title={option.description}>
                    {option.label}
                </label>
                <select
                    value={localValue || ''}
                    onChange={e => onChange(e.target.value)}
                    style={COMMON_INPUT_STYLE}
                >
                    <option value="">(Unset{defLabel})</option>
                    {option.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    // Text with possible Dynamic Options
    if (option.type === 'string' && option.dynamic_options) {
        const dynamicOpts = getDynamicOptions();
        return (
            <div key={option.name} style={{ marginBottom: '1.2rem' }}>
                <label style={LABEL_STYLE} title={option.description}>{option.label}</label>
                <select
                    value={localValue}
                    onChange={e => onChange(e.target.value)}
                    style={COMMON_INPUT_STYLE}
                >
                    <option value="">(Select or Type custom...)</option>
                    <option value="">(Unset)</option>
                    {dynamicOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        )
    }

    // Specialized Text Inputs (IP, MAC, Duration, Bytes)
    let placeholder = option.placeholder;
    if (!placeholder) {
        if (option.type === 'mac') placeholder = 'e.g. 00:11:22:33:44:55';
        if (option.type === 'ipv4') placeholder = 'e.g. 192.168.1.10';
        if (option.type === 'ipv6') placeholder = 'e.g. 2001:db8::1';
        if (option.type === 'duration') placeholder = 'e.g. 5s, 100ms';
        if (option.type === 'bytes') placeholder = 'e.g. 1G, 1024';
    }

    if (option.default !== undefined) {
        const defStr = `Default: ${option.default}`;
        placeholder = placeholder ? `${placeholder} (${defStr})` : defStr;
    }

    const validTypes = option.types || [option.type as string];
    const displayTypes = validTypes.filter(t => t !== 'list');
    const typeLabel = displayTypes.map(t => getTypeLabel(t)).join('/');
    // For single inputs, we validate strictly
    const error = validateInput(String(localValue), validTypes);
    const badgeBg = displayTypes.length > 1 ? '#e0f7fa' : getBadgeColor(displayTypes[0]);
    const badgeText = displayTypes.length > 1 ? '#006064' : getBadgeTextColor(displayTypes[0]);

    return (
        <div key={option.name} style={{ marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={LABEL_STYLE} title={option.description}>
                    {option.label} {option.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </label>
            </div>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                <input
                    type={option.type === 'number' ? 'number' : 'text'}
                    value={localValue}
                    onChange={e => onChange(option.type === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={placeholder}
                    required={option.required}
                    style={{
                        ...COMMON_INPUT_STYLE,
                        paddingRight: '60px' // Make room for the badge
                    }}
                />
                {/* Inline Type Badge */}
                <div style={{
                    position: 'absolute',
                    right: '0.6rem', /* Fixed distance from right */
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: badgeBg,
                    color: badgeText,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    whiteSpace: 'nowrap'
                }}>
                    {typeLabel}
                </div>
            </div>
            {error && localValue && (
                <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    {error}
                </div>
            )}
        </div>
    );
};
