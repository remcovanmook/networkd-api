import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { NetworkConfig, NetDevConfig } from '../api/client';
import { Save, ArrowLeft, Trash2, Plus, Monitor, Layers, ArrowRight, Check, ChevronDown, ChevronRight, Sliders } from 'lucide-react';
import { NETWORK_SECTIONS, NETDEV_SECTIONS, NETDEV_KINDS, COMMON_NETDEV_KINDS, type ConfigOption, CATEGORY_ORDER } from './schema';

interface SectionDef {
    name: string;
    label: string;
    category: string;
    options: ConfigOption[];
    advanced?: boolean;
}

const typedNetworkSections = NETWORK_SECTIONS as unknown as Record<string, SectionDef>;
const typedNetdevSections = NETDEV_SECTIONS as unknown as Record<string, SectionDef>;

type Mode = 'physical' | 'virtual';
type WizardStep = 'kind-selection' | 'essential-config' | 'full-editor';

const EditNetwork: React.FC = () => {
    const navigate = useNavigate();
    const { filename: paramFilename } = useParams(); // For edit mode
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    // UI State
    const initialMode = (searchParams.get('mode') as Mode) || 'physical';
    const [mode, setMode] = useState<Mode>(initialMode);
    const [wizardStep, setWizardStep] = useState<WizardStep>('kind-selection');
    const [showAdvancedKinds, setShowAdvancedKinds] = useState(false);
    const [advancedFieldToggles, setAdvancedFieldToggles] = useState<Record<string, boolean>>({});
    // Category Toggle State
    const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({
        'Basic': true // Always open Basic by default
    });

    // Config State
    const [filename, setFilename] = useState(paramFilename || '');
    const [config, setConfig] = useState<any>({
        match: { name: searchParams.get('match') || '' },
        network: { dhcp: 'yes' }
    });
    const [netdevConfig, setNetdevConfig] = useState<any>({
        netdev: { kind: 'bridge' }
    });

    // Virtual Device State
    const [netdevKind, setNetdevKind] = useState('bridge');
    // Manual override for name in wizard
    const [manualNameOverride, setManualNameOverride] = useState<string>('');

    // Determine active tab based on mode after config defaults set
    const [activeTab, setActiveTab] = useState<string>('Match');

    // Fetch Interfaces (for chain logic)
    const { data: interfaceFiles } = useQuery({
        queryKey: ['netdevs'],
        queryFn: apiClient.getNetDevs
    });

    // Fetch existing configuration
    const { data: existingConfig, isSuccess: isLoaded, isError } = useQuery({
        queryKey: ['network', paramFilename],
        queryFn: () => {
            const type = paramFilename!.endsWith('.netdev') ? 'netdev' : 'network';
            return apiClient.getNetwork(paramFilename!, type);
        },
        enabled: !!paramFilename,
        retry: false
    });

    // Initialize Form Data
    useEffect(() => {
        // If loaded successfully (EDIT Mode)
        if (paramFilename && isLoaded && existingConfig) {
            setFilename(paramFilename);
            setConfig(existingConfig);
            setWizardStep('full-editor'); // Skip wizard for edits

            if (existingConfig.netdev) {
                setMode('virtual');
                const kind = existingConfig.netdev.kind || 'bridge';
                setNetdevKind(kind);
                setNetdevConfig(existingConfig);
            } else {
                setMode('physical');
            }

            // --- Auto-Expand Logic ---

            const newFieldToggles: Record<string, boolean> = {};

            // Helper to check sections
            const checkSections = (schema: Record<string, SectionDef>, data: any) => {
                Object.keys(schema).forEach(key => {
                    const def = schema[key];
                    const sectionData = data[def.name];

                    if (sectionData) {
                        // Check if the section itself is advanced and has content




                        // Check for advanced fields within this section
                        const hasAdvancedFieldsPopulated = def.options.some(opt => {
                            if (!opt.advanced) return false;
                            const val = sectionData[opt.name];
                            return Array.isArray(val) ? val.length > 0 : (val !== '' && val !== undefined);
                        });

                        if (hasAdvancedFieldsPopulated) {
                            newFieldToggles[def.name] = true;
                        }
                    }
                });
            };

            checkSections(typedNetworkSections, existingConfig);
            if (existingConfig.netdev) {
                checkSections(typedNetdevSections, existingConfig);
            }


            setAdvancedFieldToggles(newFieldToggles);
            // -------------------------

        }

        // Handle Phantom File / Create Mode
        if (paramFilename && (isError || (!isLoaded && !existingConfig))) {
            setFilename(paramFilename);
            setWizardStep('full-editor');
            const match = paramFilename.match(/^\d+-(.*)\.network$/);
            if (match && match[1]) {
                setConfig((prev: any) => ({
                    ...prev,
                    match: { ...prev.match, name: match[1] },
                    network: { dhcp: 'yes' }
                }));
            }
        }

        // "New" Physical Mode
        if (!paramFilename && searchParams.get('match')) {
            setWizardStep('full-editor');
            const m = searchParams.get('match');
            setConfig((prev: any) => ({
                ...prev,
                match: { ...prev.match, name: m }
            }));
            // Initial Filename set by Effect below
        }

    }, [isLoaded, existingConfig, paramFilename, searchParams, isError, mode]);


    // Smart Naming Logic & Config Sync
    useEffect(() => {
        if (!paramFilename) {
            let name = '';
            let newFilename = '';

            if (mode === 'virtual') {
                // Virtual Logic
                // Base logic: prefix + identifier
                switch (netdevKind) {
                    case 'vlan':
                        const vlanId = netdevConfig.vlan?.id;
                        name = vlanId ? `vlan${vlanId}` : '';
                        break;
                    case 'vxlan':
                        const vni = netdevConfig.vxlan?.vni;
                        name = vni ? `vxlan${vni}` : '';
                        break;
                    case 'bond':
                        name = 'bond0';
                        break;
                    case 'bridge':
                        name = 'br0';
                        break;
                    case 'wireguard':
                        name = 'wg0';
                        break;
                    default:
                        name = `${netdevKind}0`;
                }

                // Apply Manual Override (from Wizard)
                if (manualNameOverride) {
                    name = manualNameOverride;
                } else if (netdevConfig.netdev?.name && wizardStep === 'full-editor') {
                    // Keep name if already set in full editor
                    name = netdevConfig.netdev.name;
                }

                if (name) {
                    setNetdevConfig((prev: any) => ({
                        ...prev,
                        netdev: { ...(prev.netdev || {}), kind: netdevKind, name: name }
                    }));
                    // Sync Match Name
                    setConfig((prev: any) => ({
                        ...prev,
                        match: { ...(prev.match || {}), name: name }
                    }));
                    newFilename = `25-${name}.network`;
                }

            } else {
                // Physical Logic
                name = config.match?.name || '';
                if (name) {
                    newFilename = `10-${name}.network`;
                }
            }

            if (newFilename) {
                setFilename(newFilename);
            }
        }
    }, [mode, netdevKind, paramFilename, netdevConfig.vlan?.id, netdevConfig.vxlan?.vni, manualNameOverride, config.match?.name]);


    const updateNetworkConfig = (section: string, field: string, value: any) => {
        setConfig((prev: any) => ({
            ...prev,
            [section]: {
                ...(prev[section] || {}),
                [field]: value
            }
        }));
    };

    const updateNetDevConfig = (section: string, field: string, value: any) => {
        setNetdevConfig((prev: any) => ({
            ...prev,
            [section]: {
                ...(prev[section] || {}),
                [field]: value
            }
        }));
    };


    const renderField = (option: ConfigOption, sectionName: string, isNetDev: boolean) => {
        // Advanced Toggle Logic
        // If option is advanced and not enabled, skip it.
        if (option.advanced && !advancedFieldToggles[sectionName]) {
            return null;
        }

        const source = isNetDev ? netdevConfig : config;
        const sectionData = source[sectionName] || {};
        const value = sectionData[option.name] || '';

        const handleChange = (val: any) => {
            if (isNetDev) updateNetDevConfig(sectionName, option.name, val);
            else updateNetworkConfig(sectionName, option.name, val);
        };

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
                <div key={option.name} style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>
                        {option.label} {option.required && <span style={{ color: 'red' }}>*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={e => handleChange(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
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
            const listVal: string[] = Array.isArray(value) ? value : [];
            const dynamicOpts = getDynamicOptions();

            return (
                <div key={option.name} style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>{option.label}</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {option.dynamic_options ? (
                            <select
                                style={{ flex: 1, padding: '0.5rem' }}
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val && !listVal.includes(val)) {
                                        handleChange([...listVal, val]);
                                    }
                                }}
                            >
                                <option value="">Select configured {option.dynamic_options}...</option>
                                {dynamicOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        ) : (
                            <input
                                id={`add-${sectionName}-${option.name}`}
                                placeholder={option.placeholder}
                                style={{ flex: 1, padding: '0.5rem' }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const target = e.target as HTMLInputElement;
                                        if (target.value) {
                                            handleChange([...listVal, target.value]);
                                            target.value = '';
                                        }
                                        e.preventDefault();
                                    }
                                }}
                            />
                        )}
                        <button type="button" onClick={() => {
                            const el = document.getElementById(`add-${sectionName}-${option.name}`) as HTMLInputElement | HTMLSelectElement;
                            if (el && el.value) {
                                // Prevent duplicates
                                if (!listVal.includes(el.value)) {
                                    handleChange([...listVal, el.value]);
                                }
                                el.value = '';
                            }
                        }} style={{ padding: '0.5rem' }}><Plus size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {listVal.map((item, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                {item}
                                <button onClick={() => handleChange(listVal.filter((_, i) => i !== idx))} style={{ padding: 0, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Text with possible Dynamic Options
        if (option.type === 'text' && option.dynamic_options) {
            const dynamicOpts = getDynamicOptions();
            return (
                <div key={option.name} style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>{option.label}</label>
                    <select
                        value={value}
                        onChange={e => handleChange(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    >
                        <option value="">(Select or Type custom...)</option>
                        <option value="">(Unset)</option>
                        {dynamicOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            )
        }

        return (
            <div key={option.name} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>
                    {option.label} {option.required && <span style={{ color: 'red' }}>*</span>}
                </label>
                <input
                    type={option.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={e => handleChange(option.type === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={option.placeholder}
                    required={option.required}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
            </div>
        );
    };

    // Calculate Available Tabs (Basic vs Advanced)
    const availableTabs = mode === 'physical'
        ? Object.keys(typedNetworkSections)
        : [...(NETDEV_KINDS[netdevKind] || ['NetDev']), ...Object.keys(typedNetworkSections)];

    // Group Tabs by Category (excluding Basic which is special, but for now treat consistent)
    const groupedTabs = useMemo(() => {
        const groups: Record<string, string[]> = {};
        availableTabs.forEach(tab => {
            const schema = typedNetdevSections[tab] || typedNetworkSections[tab];
            const cat = schema?.category || 'Advanced';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(tab);
        });

        // Ensure strictly ordered Categories
        const orderedCategories = CATEGORY_ORDER;
        const result: { category: string, tabs: string[] }[] = [];

        orderedCategories.forEach(cat => {
            if (groups[cat] && groups[cat].length > 0) {
                result.push({ category: cat, tabs: groups[cat] });
                delete groups[cat];
            }
        });

        // Add any remaining
        Object.keys(groups).forEach(cat => {
            result.push({ category: cat, tabs: groups[cat] });
        });

        return result;
    }, [availableTabs, mode, netdevKind]);

    // Ensure active tab is valid
    useEffect(() => {
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [availableTabs, activeTab, mode, netdevKind, wizardStep]);

    const mutationLocal = useMutation({
        mutationFn: async (data: { filename: string, config: NetworkConfig, netdev?: NetDevConfig }) => {
            if (mode === 'virtual' && data.netdev) {
                const netdevFilename = data.filename.replace(/\.network$/, '.netdev');
                // Ensure .netdev suffix
                const finalNetDevName = netdevFilename.endsWith('.netdev') ? netdevFilename : netdevFilename + '.netdev';
                await apiClient.createNetDev(finalNetDevName, data.netdev);
            }
            return apiClient.createNetwork(data.filename, data.config);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['netdevs'] });
            await queryClient.invalidateQueries({ queryKey: ['networks'] });
            await queryClient.invalidateQueries({ queryKey: ['configs'] });
            navigate('/');
        },
        onError: (error: any) => alert(`Failed: ${error.message}`)
    });

    const deleteMutation = useMutation({
        mutationFn: async (filename: string) => {
            if (filename.endsWith('.netdev')) {
                return apiClient.deleteNetDev(filename);
            } else {
                return apiClient.deleteNetwork(filename);
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['netdevs'] });
            await queryClient.invalidateQueries({ queryKey: ['networks'] });
            await queryClient.invalidateQueries({ queryKey: ['configs'] });
            navigate('/');
        }
    });

    const handleSave = () => {
        const payloadConfig = { ...config };
        const payloadNetDev = mode === 'virtual' ? { ...netdevConfig } : undefined;

        mutationLocal.mutate({
            filename,
            config: payloadConfig,
            netdev: payloadNetDev
        });
    };

    // Helper to generate INI preview
    const generatePreview = (isNetDevFile: boolean) => {
        const sectionsData = isNetDevFile ? netdevConfig : config;
        const schema = isNetDevFile ? typedNetdevSections : typedNetworkSections;
        let ini = '';
        Object.keys(schema).forEach(sectionKey => {
            const sectionDef = schema[sectionKey];
            const data = sectionsData[sectionDef.name];
            if (!data || Object.keys(data).length === 0) return;
            const hasContent = Object.values(data).some(v => Array.isArray(v) ? v.length > 0 : v !== '');
            if (!hasContent) return;
            ini += `[${sectionKey}]\n`;
            sectionDef.options.forEach(opt => {
                const val = data[opt.name];
                if (val !== undefined && val !== '' && val !== null) {
                    // Use explicit INI name or PascalCase heuristic
                    const key = opt.ini_name || opt.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

                    if (Array.isArray(val)) {
                        val.forEach(v => ini += `${key}=${v}\n`);
                    } else {
                        ini += `${key}=${val}\n`;
                    }
                }
            });
            ini += '\n';
        });
        return ini;
    };

    // WIZARD RENDERER
    if (mode === 'virtual' && !paramFilename && wizardStep !== 'full-editor') {
        const kindsToShow = showAdvancedKinds ? Object.keys(NETDEV_KINDS) : COMMON_NETDEV_KINDS;

        // Step 1: Kind Selection
        if (wizardStep === 'kind-selection') {
            return (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                        <button onClick={() => navigate('/interfaces')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}><ArrowLeft /></button>
                        <h1>Create Virtual Device: Step 1</h1>
                    </header>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                        {kindsToShow.map((k: string) => (
                            <button
                                key={k}
                                onClick={() => {
                                    setNetdevKind(k);
                                    setWizardStep('essential-config');
                                    setNetdevConfig({ netdev: { kind: k } });
                                    setManualNameOverride('');
                                }}
                                style={{
                                    padding: '2rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                                    transition: 'all 0.2s',
                                    opacity: (NETDEV_KINDS[k].includes('NetDev') && !COMMON_NETDEV_KINDS.includes(k)) ? 0.8 : 1
                                }}
                            >
                                <Layers size={32} />
                                {k}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <button onClick={() => setShowAdvancedKinds(!showAdvancedKinds)} style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            {showAdvancedKinds ? 'Hide Advanced Devices' : 'Show Advanced Devices'}
                        </button>
                    </div>
                </div>
            )
        }

        // Step 2: Essential Specs
        if (wizardStep === 'essential-config') {
            const kindDef = NETDEV_KINDS[netdevKind];
            const specificSectionKey = kindDef?.find(k => k !== 'NetDev'); // e.g. 'VLAN'

            return (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                        <button onClick={() => setWizardStep('kind-selection')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}><ArrowLeft /></button>
                        <h1>Configure {netdevKind.toUpperCase()}</h1>
                    </header>

                    <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px' }}>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                            Configure the essential properties for this {netdevKind} device.
                        </p>

                        {/* Render Specific Fields (Only non-advanced ones typically in Wizard) */}
                        {specificSectionKey && typedNetdevSections[specificSectionKey] &&
                            typedNetdevSections[specificSectionKey].options.filter(o => !o.advanced).map(opt => renderField(opt, typedNetdevSections[specificSectionKey].name, true))
                        }

                        {/* Manual Name Override */}
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Device Name</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    value={manualNameOverride || netdevConfig.netdev?.name || ''}
                                    onChange={e => setManualNameOverride(e.target.value)}
                                    placeholder={netdevConfig.netdev?.name}
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                />
                            </div>
                            <small style={{ color: 'var(--text-secondary)' }}>
                                Auto-generated: {netdevConfig.netdev?.name}. Edit to override.
                            </small>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleSave}
                                style={{
                                    flex: 2,
                                    background: 'var(--accent-primary)',
                                    color: 'white',
                                    padding: '0.8rem',
                                    borderRadius: '6px',
                                    border: 'none', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                                }}
                            >
                                <Check size={20} /> Create Device
                            </button>
                            <button
                                onClick={() => setWizardStep('full-editor')}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    padding: '0.8rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                                }}
                            >
                                Advanced <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
    }

    // DEFAULT: Full Editor (Standard Tabbed Interface)
    const currentSectionSchema = typedNetdevSections[activeTab] || typedNetworkSections[activeTab];
    const hasAdvancedFields = currentSectionSchema?.options.some(o => o.advanced);
    const isSectionAdvancedToggleOn = advancedFieldToggles[currentSectionSchema?.name || ''];

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', color: 'var(--text-primary)', paddingBottom: '300px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link to="/interfaces"><button style={{ padding: '0.5rem', display: 'flex', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}><ArrowLeft /></button></Link>
                    <h1>{paramFilename ? 'Edit Interface' : (mode === 'virtual' ? 'Create Virtual Device' : 'Configure Network')}</h1>
                </div>
                {paramFilename && (
                    <button
                        onClick={() => { if (confirm('Delete this configuration?')) deleteMutation.mutate(paramFilename); }}
                        style={{ backgroundColor: 'var(--error)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Trash2 size={16} /> Delete
                    </button>
                )}
            </header>

            {!paramFilename && wizardStep === 'full-editor' && mode !== 'virtual' && (
                <div style={{ display: 'flex', marginBottom: '2rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px' }}>
                    <button onClick={() => setMode('physical')} style={{ flex: 1, padding: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Monitor size={16} /> Physical Link
                    </button>
                    <button onClick={() => { setMode('virtual'); setWizardStep('kind-selection'); }} style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Layers size={16} /> Virtual Device
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                {/* Sidebar */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {mode === 'virtual' && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>DEVICE KIND</label>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.2rem' }}>{netdevKind.toUpperCase()}</div>
                        </div>
                    )}

                    {/* Grouped Sidebar with Accordions */}
                    {groupedTabs.map(group => {
                        const isBasic = group.category === 'Basic';
                        const isExpanded = isBasic || categoryToggles[group.category] || group.tabs.includes(activeTab);

                        return (
                            <div key={group.category} style={{ marginBottom: '0.5rem' }}>
                                <button
                                    onClick={() => !isBasic && setCategoryToggles(prev => ({ ...prev, [group.category]: !isExpanded }))}
                                    style={{
                                        width: '100%',
                                        marginTop: '0.5rem', marginBottom: '0.2rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        color: isBasic ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontSize: '0.8rem', fontWeight: 'bold',
                                        padding: '0.5rem 1rem', background: 'var(--bg-tertiary)',
                                        border: 'none', borderRadius: '4px', cursor: isBasic ? 'default' : 'pointer',
                                        opacity: isBasic ? 1 : 0.9
                                    }}
                                >
                                    {group.category.toUpperCase()}
                                    {!isBasic && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                </button>

                                {isExpanded && (
                                    <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                                        {group.tabs.map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '0.6rem 1rem',
                                                    background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                                                    borderLeft: activeTab === tab ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                {typedNetdevSections[tab]?.label || typedNetworkSections[tab]?.label || tab}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Main Form */}
                <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h2 style={{ margin: 0 }}>
                            {currentSectionSchema?.label}
                        </h2>
                    </div>

                    {/* Filename Display (Read-Only) */}
                    {activeTab === 'Match' && (
                        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>TARGET FILENAME (AUTO-GENERATED)</label>
                            <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename || '(Pending Name...)'}</div>
                            {mode === 'virtual' && <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename.replace('.network', '.netdev')}</div>}
                        </div>
                    )}

                    {/* Render Fields */}
                    {currentSectionSchema && currentSectionSchema.options.map(opt =>
                        renderField(opt, currentSectionSchema.name, !!typedNetdevSections[activeTab])
                    )}

                    {/* Advanced Toggle inside Section */}
                    {hasAdvancedFields && (
                        <div style={{ marginTop: '2rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                            <button
                                onClick={() => setAdvancedFieldToggles(prev => ({ ...prev, [currentSectionSchema.name]: !isSectionAdvancedToggleOn }))}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.9rem' }}
                            >
                                <Sliders size={16} />
                                {isSectionAdvancedToggleOn ? 'Hide Advanced Options' : 'Show Advanced Options'}
                            </button>
                        </div>
                    )}

                    <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                background: 'var(--accent-primary)',
                                color: 'white',
                                padding: '0.8rem 2rem',
                                borderRadius: '6px',
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '1rem', border: 'none', cursor: 'pointer'
                            }}
                        >
                            <Save size={20} /> Save Configuration
                        </button>
                    </div>
                </div>
            </div>

            {/* Live Preview Panel */}
            <div style={{
                position: 'fixed', bottom: 0, left: '290px', right: 0,
                height: '250px',
                background: '#1a1a1a',
                borderTop: '2px solid var(--accent-primary)',
                padding: '1rem',
                display: 'flex', gap: '1rem',
                zIndex: 100,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                color: '#ddd',
                fontFamily: 'monospace'
            }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
                        PREVIEW: {filename}
                    </label>
                    <textarea
                        readOnly
                        value={generatePreview(false)}
                        style={{ flex: 1, background: '#000', border: 'none', color: '#0f0', padding: '1rem', resize: 'none', fontSize: '0.9rem' }}
                    />
                </div>
                {mode === 'virtual' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontWeight: 'bold', color: 'var(--accent-secondary)', marginBottom: '0.5rem' }}>
                            PREVIEW: {filename.replace('.network', '.netdev')}
                        </label>
                        <textarea
                            readOnly
                            value={generatePreview(true)}
                            style={{ flex: 1, background: '#000', border: 'none', color: '#0ff', padding: '1rem', resize: 'none', fontSize: '0.9rem' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditNetwork;
