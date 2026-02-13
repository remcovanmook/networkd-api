import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { type ConfigOption } from '../utils/schemaProcessor';

// Schema-aware validation
const validateInput = (value: string, option: ConfigOption): string | null => {
    if (!value) return null;

    const types = (option.types || [option.type]).filter(t => t !== 'list');
    if (types.length === 0) return null;

    const v = option.validation;

    // For number types, check range from schema
    if (types.includes('number')) {
        const num = Number(value);
        if (!isNaN(num)) {
            if (v?.minimum !== undefined && num < v.minimum) {
                return `Minimum: ${v.minimum}`;
            }
            if (v?.maximum !== undefined && num > v.maximum) {
                return `Maximum: ${v.maximum}`;
            }
            return null;
        }
    }

    // For types that also accept strings (bytes, duration), be lenient
    if (types.includes('bytes')) {
        if (/^\d+(\s*[KMGTPE]i?)?$/.test(value)) return null;
    }
    if (types.includes('duration')) {
        if (/^\d+(\.\d+)?(us|ms|s|min|h|d|w|M|y)?$/.test(value)) return null;
    }

    // Schema pattern validation (from the actual JSON schema)
    if (v?.pattern) {
        try {
            if (new RegExp(v.pattern).test(value)) return null;
        } catch { /* invalid regex, skip */ }
    }

    // Type-specific format checks (fallback when no schema pattern)
    let isValid = false;
    for (const type of types) {
        if (type === 'string') { isValid = true; break; }
        if (type === 'boolean') {
            if (['yes', 'no', 'true', 'false', '1', '0', 'on', 'off'].includes(value.toLowerCase())) {
                isValid = true; break;
            }
        }
        if (type === 'number') {
            if (!isNaN(Number(value))) { isValid = true; break; }
        }
        if (type === 'ipv4' || type === 'ip' || type === 'prefix') {
            if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value)) { isValid = true; break; }
        }
        if (type === 'ipv6' || type === 'ip' || type === 'prefix') {
            if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/.test(value)) { isValid = true; break; }
        }
        if (type === 'mac') {
            if (/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value) ||
                /^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/.test(value)) {
                isValid = true; break;
            }
        }
    }

    if (isValid) {
        // Even if type-valid, check length constraints
        if (v?.minLength !== undefined && value.length < v.minLength) {
            return `Minimum length: ${v.minLength}`;
        }
        if (v?.maxLength !== undefined && value.length > v.maxLength) {
            return `Maximum length: ${v.maxLength}`;
        }
        return null;
    }

    return `Expected: ${types.map(getTypeLabel).join(' or ')}`;
};

const getTypeLabel = (type: string) => {
    if (type === 'string') return 'Text';
    if (type === 'boolean') return 'Y/N';
    if (type === 'integer' || type === 'number') return 'Num';
    if (type === 'ipv4') return 'IPv4';
    if (type === 'ipv6') return 'IPv6';
    if (type === 'ip') return 'IP';
    if (type === 'prefix') return 'CIDR';
    if (type === 'mac') return 'MAC';
    if (type === 'seconds' || type === 'duration') return 'Time';
    if (type === 'bytes') return 'Bytes';
    if (type === 'list') return 'List';
    return type;
};

const getBadgeColor = (type: string) => {
    if (type === 'boolean') return '#e8f5e9';
    if (type === 'integer' || type === 'number') return '#e3f2fd';
    if (type.startsWith('ipv') || type === 'ip' || type === 'prefix') return '#fff3e0';
    if (type === 'mac') return '#f3e5f5';
    return '#f5f5f5';
};

const getBadgeTextColor = (type: string) => {
    if (type === 'boolean') return '#2e7d32';
    if (type === 'integer' || type === 'number') return '#1565c0';
    if (type.startsWith('ipv') || type === 'ip' || type === 'prefix') return '#ef6c00';
    if (type === 'mac') return '#7b1fa2';
    return '#616161';
};

// Build a smart placeholder from schema metadata
const buildPlaceholder = (option: ConfigOption): string => {
    const v = option.validation;
    const parts: string[] = [];

    // Use examples first if available
    if (v?.examples?.length) {
        parts.push(`e.g. ${v.examples.slice(0, 2).join(', ')}`);
    } else {
        // Type-based defaults
        if (option.type === 'mac') parts.push('e.g. 00:11:22:33:44:55');
        else if (option.type === 'ipv4' || option.type === 'ip') parts.push('e.g. 192.168.1.10');
        else if (option.type === 'ipv6') parts.push('e.g. 2001:db8::1');
        else if (option.type === 'prefix') parts.push('e.g. 192.168.1.0/24');
        else if (option.type === 'duration') parts.push('e.g. 5s, 100ms');
        else if (option.type === 'bytes') parts.push('e.g. 1500, 9000');
    }

    // Range hint for numbers
    if (v?.minimum !== undefined && v?.maximum !== undefined) {
        parts.push(`${v.minimum}–${v.maximum}`);
    } else if (v?.minimum !== undefined) {
        parts.push(`min: ${v.minimum}`);
    } else if (v?.maximum !== undefined) {
        parts.push(`max: ${v.maximum}`);
    }

    // Length hint for strings
    if (v?.maxLength !== undefined) {
        parts.push(`max ${v.maxLength} chars`);
    }

    if (option.default !== undefined) {
        parts.push(`Default: ${option.default}`);
    }

    return parts.join(' · ');
};

// Build badge text with range for number types
const buildBadgeLabel = (option: ConfigOption): string => {
    const types = (option.types || [option.type]).filter(t => t !== 'list');
    const v = option.validation;

    const labels = types.map(t => {
        const base = getTypeLabel(t);
        if (t === 'number' && v?.minimum !== undefined && v?.maximum !== undefined) {
            return `${v.minimum}–${v.maximum}`;
        }
        return base;
    });

    return labels.join('/');
};

interface ConfigFieldProps {
    option: ConfigOption;
    sectionName: string;
    value: any;
    onChange: (val: any) => void;
    interfaceFiles?: { type: string, netdev_kind?: string, netdev_name?: string, filename: string }[];
}

export const ConfigField: React.FC<ConfigFieldProps> = ({ option, sectionName, value, onChange, interfaceFiles }) => {

    const localValue = value === undefined || value === null ? '' : value;
    const [inputValue, setInputValue] = useState('');
    const [listError, setListError] = useState<string | null>(null);

    const getDynamicOptions = () => {
        if (!option.dynamic_options || !interfaceFiles) return [];
        return interfaceFiles
            .filter(f => f.type === 'netdev' && f.netdev_kind === option.dynamic_options)
            .map(f => f.netdev_name || f.filename.replace('.netdev', ''))
            .filter(Boolean);
    };

    if (option.type === 'select') {
        const defLabel = option.default !== undefined ? ` (Default: ${option.default})` : '';
        return (
            <div key={option.name} className="form-field">
                <label className="form-label" title={option.description}>
                    {option.label} {option.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </label>
                <select
                    value={localValue}
                    onChange={e => onChange(e.target.value)}
                    className="form-input"
                >
                    <option value="">(Unset{defLabel})</option>
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

        const handleAdd = (val: string) => {
            const error = validateInput(val, option);
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

        const badgeLabel = buildBadgeLabel(option);
        const displayTypes = (option.types || []).filter(t => t !== 'list');

        return (
            <div key={option.name} className="form-field">
                <div className="form-label-row">
                    <label className="form-label" title={option.description}>{option.label}</label>
                    <span style={{
                        fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                        background: getBadgeColor(displayTypes[0] || 'string'), color: getBadgeTextColor(displayTypes[0] || 'string')
                    }}>
                        {badgeLabel}
                    </span>
                </div>

                <div className="flex-row" style={{ marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    {(option.dynamic_options || option.options) ? (
                        <select
                            className="form-input"
                            style={{ flex: 1 }}
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
                                placeholder={buildPlaceholder(option) || 'Add item...'}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    if (e.target.value === '') setListError(null);
                                    else setListError(validateInput(e.target.value, option));
                                }}
                                className="form-input"
                                style={{
                                    maxWidth: '100%',
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
                <div className="flex-row flex-wrap">
                    {listVal.map((item, idx) => (
                        <div key={idx} className="form-list-item">
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
        const defLabel = option.default !== undefined ? ` (Default: ${option.default === 'yes' || option.default === true ? 'Yes' : 'No'})` : '';
        return (
            <div key={option.name} className="form-field">
                <label className="form-label" title={option.description}>
                    {option.label}
                </label>
                <select
                    value={localValue === true ? 'yes' : localValue === false ? 'no' : (localValue || '')}
                    onChange={e => onChange(e.target.value)}
                    className="form-input"
                >
                    <option value="">(Unset{defLabel})</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            </div>
        );
    }

    // Text with possible Dynamic Options
    if (option.type === 'string' && option.dynamic_options) {
        const dynamicOpts = getDynamicOptions();
        return (
            <div key={option.name} className="form-field">
                <label className="form-label" title={option.description}>{option.label}</label>
                <select
                    value={localValue}
                    onChange={e => onChange(e.target.value)}
                    className="form-input"
                >
                    <option value="">(Select or Type custom...)</option>
                    <option value="">(Unset)</option>
                    {dynamicOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        )
    }

    // Generic input (text, number, ip, mac, duration, bytes, etc.)
    const v = option.validation;
    const placeholder = buildPlaceholder(option);
    const badgeLabel = buildBadgeLabel(option);
    const displayTypes = (option.types || [option.type]).filter(t => t !== 'list');
    const isNumber = option.type === 'number';
    const error = validateInput(String(localValue), option);
    const badgeBg = displayTypes.length > 1 ? '#e0f7fa' : getBadgeColor(displayTypes[0] || 'string');
    const badgeText = displayTypes.length > 1 ? '#006064' : getBadgeTextColor(displayTypes[0] || 'string');

    return (
        <div key={option.name} className="form-field">
            <div className="form-label-row" style={{ marginBottom: '0.3rem' }}>
                <label className="form-label" title={option.description}>
                    {option.label} {option.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </label>
            </div>
            <div className="form-input-wrapper">
                <input
                    type={isNumber ? 'number' : 'text'}
                    value={localValue}
                    onChange={e => {
                        if (isNumber) {
                            onChange(e.target.value === '' ? '' : Number(e.target.value));
                        } else {
                            onChange(e.target.value);
                        }
                    }}
                    placeholder={placeholder}
                    required={option.required}
                    className="form-input"
                    style={{ paddingRight: '60px' }}
                    {...(isNumber && v?.minimum !== undefined ? { min: v.minimum } : {})}
                    {...(isNumber && v?.maximum !== undefined ? { max: v.maximum } : {})}
                    {...(!isNumber && v?.minLength !== undefined ? { minLength: v.minLength } : {})}
                    {...(!isNumber && v?.maxLength !== undefined ? { maxLength: v.maxLength } : {})}
                />
                <div
                    className="form-input-badge"
                    style={{ background: badgeBg, color: badgeText }}
                >
                    {badgeLabel}
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
