import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ArrowLeft, Trash2, ExternalLink, ChevronDown, ChevronRight, Save, Layers, Check, ArrowRight, Plus, Monitor, Wifi, Edit3 } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { ConfigField } from '../components/ConfigField';
import { LivePreview } from '../components/LivePreview';
import { useSchema } from '../contexts/SchemaContext';
import type { SchemaMap, CategoryTier } from '../utils/schemaProcessor';
import type { ConfigType } from '../utils/defaultConfigGenerator';
import { getDefaultConfig, generateFilename, getConfigLabel, getFirstTab, getFilenameTab } from '../utils/defaultConfigGenerator';
import { coerceConfigTypes } from '../utils/configGenerator';

interface ConfigEditorProps {
    configType: ConfigType;
    inline?: boolean;
}

const API_MAP: Record<string, {
    create: (filename: string, config: any) => Promise<any>;
    update: (filename: string, config: any) => Promise<any>;
    delete?: (filename: string) => Promise<any>;
    get: (filename: string) => Promise<any>;
    queryKey: string;
    invalidateKeys: string[];
}> = {
    network: {
        create: (f, c) => apiClient.createNetwork(f, c),
        update: (f, c) => apiClient.updateNetwork(f, c),
        delete: (f) => apiClient.deleteNetwork(f),
        get: (f) => apiClient.getNetwork(f, 'network'),
        queryKey: 'network',
        invalidateKeys: ['networks', 'configs'],
    },
    netdev: {
        create: (f, c) => apiClient.createNetDev(f, c),
        update: (f, c) => apiClient.updateNetDev(f, c),
        delete: (f) => apiClient.deleteNetDev(f),
        get: (f) => apiClient.getNetwork(f, 'netdev'),
        queryKey: 'netdev',
        invalidateKeys: ['netdevs'],
    },
    link: {
        create: (f, c) => apiClient.createLink(f, c),
        update: (f, c) => apiClient.updateLink(f, c),
        delete: (f) => apiClient.deleteLink(f),
        get: (f) => apiClient.getNetwork(f, 'link'),
        queryKey: 'link',
        invalidateKeys: ['links'],
    },
    'networkd-conf': {
        create: (_f, c) => apiClient.saveGlobalConfig(c),
        update: (_f, c) => apiClient.saveGlobalConfig(c),
        get: () => apiClient.getGlobalConfig(),
        queryKey: 'networkd-conf',
        invalidateKeys: ['systemConfig'],
    },
};

type WizardStep = 'kind-selection' | 'match-selection' | 'essential-config' | 'full-editor';

interface DeviceOption {
    name: string;
    source: 'system' | 'netdev' | 'link';
    mac?: string;
    type?: string;
    driver?: string;
    state?: string;
    addresses?: string[];
    netdevKind?: string;
}

const STATE_COLORS: Record<string, string> = {
    routable: '#10b981',
    carrier: '#f59e0b',
    degraded: '#f59e0b',
    dormant: '#6b7280',
    off: '#6b7280',
    'no-carrier': '#ef4444',
};

const TYPE_BADGE_COLORS: Record<string, { bg: string, text: string }> = {
    ether: { bg: '#e3f2fd', text: '#1565c0' },
    loopback: { bg: '#f5f5f5', text: '#616161' },
    wlan: { bg: '#fff3e0', text: '#ef6c00' },
    bridge: { bg: '#e8f5e9', text: '#2e7d32' },
    bond: { bg: '#fce4ec', text: '#c62828' },
    vlan: { bg: '#f3e5f5', text: '#7b1fa2' },
    vxlan: { bg: '#e0f7fa', text: '#006064' },
    wireguard: { bg: '#ede7f6', text: '#4527a0' },
    tun: { bg: '#fff8e1', text: '#f57f17' },
    tap: { bg: '#fff8e1', text: '#f57f17' },
};

const ConfigEditor: React.FC<ConfigEditorProps> = ({ configType, inline = false }) => {
    const navigate = useNavigate();
    const { filename: paramFilename } = useParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const {
        networkSections, netdevSections, linkSections, networkdConfSections,
        netdevKinds, commonNetDevKinds, loading: schemaLoading
    } = useSchema();

    const isNetworkdConf = configType === 'networkd-conf';
    const isNetdev = configType === 'netdev';
    const isEditing = !!paramFilename || isNetworkdConf;
    const api = API_MAP[configType];

    // Resolve schema sections for this config type
    const sections: SchemaMap | null = useMemo(() => {
        switch (configType) {
            case 'network': return networkSections;
            case 'netdev': return netdevSections;
            case 'link': return linkSections;
            case 'networkd-conf': return networkdConfSections;
        }
    }, [configType, networkSections, netdevSections, linkSections, networkdConfSections]);

    const isNetwork = configType === 'network';

    // UI State — all hooks must be called unconditionally (Rules of Hooks)
    const [wizardStep, setWizardStep] = useState<WizardStep>(
        isEditing ? 'full-editor'
            : isNetdev ? 'kind-selection'
            : isNetwork ? 'match-selection'
            : 'full-editor'
    );
    const [showAdvancedKinds, setShowAdvancedKinds] = useState(false);
    const [activeTab, setActiveTab] = useState<string>(getFirstTab(configType));
    const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({ basic: true });
    const [advancedFieldToggles, setAdvancedFieldToggles] = useState<Record<string, boolean>>({});
    const [expertFieldToggles, setExpertFieldToggles] = useState<Record<string, boolean>>({});

    // Config State
    const [filename, setFilename] = useState(paramFilename || '');
    const [config, setConfig] = useState<any>(getDefaultConfig(configType));
    const [netdevKind, setNetdevKind] = useState('bridge');
    const [manualNameOverride, setManualNameOverride] = useState('');

    const [customMatchMode, setCustomMatchMode] = useState<'name' | 'mac'>('name');
    const [customMatchValue, setCustomMatchValue] = useState('');

    // Fetch interfaces for dynamic dropdowns (network type only)
    const { data: interfaceFiles } = useQuery({
        queryKey: ['netdevs'],
        queryFn: apiClient.getNetDevs,
        enabled: configType === 'network'
    });

    // Fetch system interfaces for network wizard device picker
    const { data: systemStatus } = useQuery({
        queryKey: ['systemStatus'],
        queryFn: apiClient.getSystemStatus,
        enabled: isNetwork && !paramFilename
    });

    // Build unified device list for network wizard
    const deviceOptions = useMemo<DeviceOption[]>(() => {
        if (!isNetwork) return [];
        const devices: DeviceOption[] = [];
        const seen = new Set<string>();

        // System runtime interfaces
        if (systemStatus?.interfaces) {
            for (const iface of systemStatus.interfaces) {
                seen.add(iface.name);
                devices.push({
                    name: iface.name,
                    source: 'system',
                    mac: iface.hardware_address,
                    type: iface.type,
                    driver: iface.driver,
                    state: iface.operational_state,
                    addresses: iface.addresses,
                    netdevKind: interfaceFiles?.find(f => f.netdev_name === iface.name)?.netdev_kind,
                });
            }
        }

        // Netdev configs not yet seen as system interfaces
        if (interfaceFiles) {
            for (const f of interfaceFiles) {
                const name = f.netdev_name || f.filename.replace('.netdev', '');
                if (name && !seen.has(name)) {
                    seen.add(name);
                    devices.push({
                        name,
                        source: 'netdev',
                        type: f.netdev_kind,
                        netdevKind: f.netdev_kind,
                    });
                }
            }
        }

        return devices;
    }, [isNetwork, systemStatus, interfaceFiles]);

    // Fetch existing configuration
    const { data: existingConfig, isSuccess: isLoaded } = useQuery({
        queryKey: [api.queryKey, paramFilename || 'global'],
        queryFn: () => isNetworkdConf ? api.get('') : api.get(paramFilename!),
        enabled: isEditing,
        retry: false
    });

    // Initialize Form Data from existing config
    useEffect(() => {
        if (isEditing && isLoaded && existingConfig && sections) {
            if (paramFilename) setFilename(paramFilename);
            setConfig(existingConfig);

            if (isNetdev && existingConfig.NetDev?.Kind) {
                setNetdevKind(existingConfig.NetDev.Kind);
            }

            setWizardStep('full-editor');

            // Auto-expand advanced/expert toggles for sections with existing data
            const newAdvanced: Record<string, boolean> = {};
            const newExpert: Record<string, boolean> = {};
            Object.keys(sections).forEach(key => {
                const def = sections[key];
                const sectionData = existingConfig[def.name];
                if (!sectionData) return;

                const hasAdvanced = def.options.some(opt => {
                    if (opt.category !== 'advanced') return false;
                    const val = sectionData[opt.name];
                    return Array.isArray(val) ? val.length > 0 : (val !== '' && val !== undefined);
                });
                if (hasAdvanced) newAdvanced[def.name] = true;

                const hasExpert = def.options.some(opt => {
                    if (opt.category !== 'expert') return false;
                    const val = sectionData[opt.name];
                    return Array.isArray(val) ? val.length > 0 : (val !== '' && val !== undefined);
                });
                if (hasExpert) newExpert[def.name] = true;
            });
            setAdvancedFieldToggles(newAdvanced);
            setExpertFieldToggles(newExpert);
        }
    }, [isLoaded, existingConfig, isEditing, paramFilename, sections]);

    // Helper to get a value from a section that may be an object or array
    const getSectionVal = (section: any, key: string) => {
        if (Array.isArray(section)) return section[0]?.[key];
        return section?.[key];
    };

    // Smart Naming Logic
    useEffect(() => {
        if (!paramFilename && !isNetworkdConf) {
            if (isNetdev) {
                let name = '';

                // During wizard: always derive name from kind-specific fields
                if (wizardStep !== 'full-editor' && !manualNameOverride) {
                    switch (netdevKind) {
                        case 'vlan': { const id = getSectionVal(config.VLAN, 'Id'); name = id !== undefined && id !== '' ? `vlan${id}` : ''; break; }
                        case 'vxlan': { const vni = getSectionVal(config.VXLAN, 'VNI'); name = vni !== undefined && vni !== '' ? `vxlan${vni}` : ''; break; }
                        case 'bond': name = 'bond0'; break;
                        case 'bridge': name = 'br0'; break;
                        default: name = `${netdevKind}0`;
                    }
                } else if (manualNameOverride) {
                    name = manualNameOverride;
                } else {
                    // In full editor, use whatever Name is already set
                    name = config.NetDev?.Name || '';
                }

                if (name !== (config.NetDev?.Name || '')) {
                    setConfig((prev: any) => ({ ...prev, NetDev: { ...prev.NetDev, Name: name } }));
                }
            }
            setFilename(generateFilename(configType, config));
        }
    }, [config, netdevKind, manualNameOverride, paramFilename, wizardStep, configType, isNetworkdConf, isNetdev]);

    // Build grouped tabs from schema categories
    const groupedTabs = useMemo(() => {
        if (!sections) return [];
        const allTabs = Object.keys(sections);

        // For netdev, filter by selected kind
        const availableTabs = isNetdev
            ? allTabs.filter(t => t === 'NetDev' || (netdevKinds[netdevKind] || []).includes(t))
            : allTabs;

        const groups: Record<CategoryTier, string[]> = { basic: [], advanced: [], expert: [] };

        // Kind-specific sections for netdev are always promoted to basic
        const kindSpecificSections = isNetdev ? (netdevKinds[netdevKind] || []) : [];

        for (const tab of availableTabs) {
            const category = (isNetdev && kindSpecificSections.includes(tab))
                ? 'basic'
                : sections[tab].category;
            groups[category].push(tab);
        }

        const result: { category: CategoryTier, label: string, tabs: string[] }[] = [];
        if (groups.basic.length > 0) result.push({ category: 'basic', label: 'Basic', tabs: groups.basic });
        if (groups.advanced.length > 0) result.push({ category: 'advanced', label: 'Advanced', tabs: groups.advanced });
        if (groups.expert.length > 0) result.push({ category: 'expert', label: 'Expert', tabs: groups.expert });

        return result;
    }, [sections, isNetdev, netdevKind, netdevKinds]);

    const updateConfig = (section: string, field: string, value: any, index?: number) => {
        setConfig((prev: any) => {
            if (index !== undefined) {
                const arr = Array.isArray(prev[section]) ? [...prev[section]] : (prev[section] ? [prev[section]] : []);
                if (!arr[index]) arr[index] = {};
                arr[index] = { ...arr[index], [field]: value };
                return { ...prev, [section]: arr };
            }
            return {
                ...prev,
                [section]: { ...(prev[section] || {}), [field]: value }
            };
        });
    };

    const addSectionItem = (section: string) => {
        setConfig((prev: any) => {
            const arr = Array.isArray(prev[section]) ? [...prev[section]] : (prev[section] ? [prev[section]] : []);
            arr.push({});
            return { ...prev, [section]: arr };
        });
    };

    const removeSectionItem = (section: string, index: number) => {
        setConfig((prev: any) => {
            const arr = Array.isArray(prev[section]) ? [...prev[section]] : [];
            return { ...prev, [section]: arr.filter((_: any, i: number) => i !== index) };
        });
    };

    const saveMutation = useMutation({
        mutationFn: async (data: { filename: string, config: any }) => {
            // Coerce string values to numbers where schema expects integers
            const coercedConfig = sections ? coerceConfigTypes(data.config, sections) : data.config;
            if (!isEditing) return api.create(data.filename, coercedConfig);
            try {
                return await api.update(data.filename, coercedConfig);
            } catch (err: any) {
                // File may not exist on target host yet — fall back to create
                if (err?.response?.status === 404) {
                    return api.create(data.filename, coercedConfig);
                }
                throw err;
            }
        },
        onSuccess: async () => {
            for (const key of api.invalidateKeys) {
                await queryClient.invalidateQueries({ queryKey: [key] });
            }
            showToast(`${getConfigLabel(configType)} configuration saved`, 'success');
            if (!inline) navigate('/configuration');
        },
        onError: (err: any) => showToast(`Failed: ${err.message}`, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async (fname: string) => api.delete!(fname),
        onSuccess: async () => {
            for (const key of api.invalidateKeys) {
                await queryClient.invalidateQueries({ queryKey: [key] });
            }
            showToast(`${getConfigLabel(configType)} configuration deleted`, 'success');
            navigate('/configuration');
        }
    });

    // --- Early returns AFTER all hooks ---

    if (schemaLoading || !sections) {
        return <div style={{ padding: '2rem' }}>Loading schema configuration...</div>;
    }

    // ---- WIZARD VIEW (netdev kind selection) ----
    if (isNetdev && !paramFilename && wizardStep !== 'full-editor') {
        const kindsToShow = showAdvancedKinds ? Object.keys(netdevKinds) : commonNetDevKinds;

        if (wizardStep === 'kind-selection') {
            return (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <header className="flex-row" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <button onClick={() => navigate('/configuration')} className="btn-back"><ArrowLeft /></button>
                        <h1>Create Virtual Device: Step 1</h1>
                    </header>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                        {kindsToShow.map((k: string) => (
                            <button
                                key={k}
                                onClick={() => {
                                    setNetdevKind(k);
                                    setWizardStep('essential-config');
                                    setConfig({ NetDev: { Kind: k } });
                                    setManualNameOverride('');
                                }}
                                style={{
                                    padding: '2rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                                    opacity: (!commonNetDevKinds.includes(k)) ? 0.8 : 1
                                }}
                            >
                                <Layers size={32} />
                                {k}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <button onClick={() => setShowAdvancedKinds(!showAdvancedKinds)} className="btn-secondary" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                            {showAdvancedKinds ? 'Hide Advanced Devices' : 'Show Advanced Devices'}
                        </button>
                    </div>
                </div>
            );
        }

        if (wizardStep === 'essential-config') {
            const kindDef = netdevKinds[netdevKind];
            const specificSectionKey = kindDef?.find(k => k !== 'NetDev');

            return (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <header className="flex-row" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <button onClick={() => setWizardStep('kind-selection')} className="btn-back"><ArrowLeft /></button>
                        <h1>Configure {netdevKind.toUpperCase()}</h1>
                    </header>
                    <div className="form-section">
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Configure essential properties.</p>

                        {specificSectionKey && sections[specificSectionKey] &&
                            sections[specificSectionKey].options.filter(o => o.category === 'basic').map(opt => (
                                <ConfigField
                                    key={opt.key}
                                    option={opt}
                                    sectionName={sections[specificSectionKey].name}
                                    value={(config[sections[specificSectionKey].name] || {})[opt.name]}
                                    onChange={(val) => updateConfig(sections[specificSectionKey].name, opt.name, val)}
                                />
                            ))
                        }

                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Device Name</label>
                            <input
                                value={manualNameOverride || config.NetDev?.Name || ''}
                                onChange={e => {
                                    setManualNameOverride(e.target.value);
                                    updateConfig('NetDev', 'Name', e.target.value);
                                }}
                                placeholder={config.NetDev?.Name}
                                className="form-input"
                                style={{ maxWidth: '100%' }}
                            />
                        </div>

                        <div className="flex-row" style={{ gap: '1rem', marginTop: '2rem' }}>
                            <button onClick={() => saveMutation.mutate({ filename, config })} className="btn-primary" style={{ flex: 2, padding: '0.8rem', borderRadius: '6px', justifyContent: 'center' }}>
                                <Check size={20} /> Create Device
                            </button>
                            <button onClick={() => setWizardStep('full-editor')} className="btn-secondary" style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                Advanced <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // ---- NETWORK WIZARD (match selection) ----
    if (isNetwork && !paramFilename && wizardStep !== 'full-editor') {
        const selectDevice = (device: DeviceOption) => {
            const newConfig: any = { Match: { Name: device.name }, Network: { DHCP: 'yes' } };

            // If the device is a netdev, pre-populate relevant Network fields
            if (device.netdevKind) {
                const kind = device.netdevKind;
                if (kind === 'bridge') newConfig.Network.Bridge = device.name;
                else if (kind === 'bond') newConfig.Network.Bond = device.name;
                else if (kind === 'vrf') newConfig.Network.VRF = device.name;
                else if (kind === 'vlan') newConfig.Network.VLAN = [device.name];
            }

            setConfig(newConfig);
            setWizardStep('essential-config');
        };

        const selectCustom = () => {
            const newConfig: any = { Match: {}, Network: { DHCP: 'yes' } };
            if (customMatchMode === 'mac' && customMatchValue) {
                newConfig.Match.MACAddress = customMatchValue;
            } else if (customMatchValue) {
                newConfig.Match.Name = customMatchValue;
            }
            setConfig(newConfig);
            setWizardStep('essential-config');
        };

        if (wizardStep === 'match-selection') {
            return (
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <header className="flex-row" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <button onClick={() => navigate('/configuration')} className="btn-back"><ArrowLeft /></button>
                        <h1>Create Network: Select Device</h1>
                    </header>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                        {deviceOptions.map((device) => {
                            const stateColor = STATE_COLORS[device.state || ''] || '#6b7280';
                            const typeBadge = TYPE_BADGE_COLORS[device.type || ''] || TYPE_BADGE_COLORS[device.netdevKind || ''] || { bg: '#f5f5f5', text: '#616161' };
                            const displayType = device.netdevKind || device.type || '';

                            return (
                                <button
                                    key={device.name}
                                    onClick={() => selectDevice(device)}
                                    style={{
                                        padding: '1.2rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{device.name}</span>
                                        {device.state && (
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stateColor, flexShrink: 0 }}
                                                title={device.state} />
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {displayType && (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                                                background: typeBadge.bg, color: typeBadge.text, fontWeight: 600,
                                            }}>
                                                {displayType}
                                            </span>
                                        )}
                                        {device.driver && (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                                                background: '#f5f5f5', color: '#616161', fontWeight: 500,
                                            }}>
                                                {device.driver}
                                            </span>
                                        )}
                                    </div>
                                    {device.mac && (
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {device.mac}
                                        </div>
                                    )}
                                    {device.addresses && device.addresses.length > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {device.addresses.slice(0, 2).join(', ')}
                                        </div>
                                    )}
                                </button>
                            );
                        })}

                        {/* Custom Match card */}
                        <div style={{
                            padding: '1.2rem', background: 'var(--bg-secondary)',
                            border: '1px dashed var(--border-color)', borderRadius: '8px',
                            display: 'flex', flexDirection: 'column', gap: '0.5rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                <Edit3 size={16} />
                                <span style={{ fontWeight: 'bold' }}>Custom Match</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                <button
                                    onClick={() => setCustomMatchMode('name')}
                                    style={{
                                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                                        background: customMatchMode === 'name' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: customMatchMode === 'name' ? 'white' : 'var(--text-secondary)',
                                        border: 'none',
                                    }}
                                >
                                    Name
                                </button>
                                <button
                                    onClick={() => setCustomMatchMode('mac')}
                                    style={{
                                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                                        background: customMatchMode === 'mac' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: customMatchMode === 'mac' ? 'white' : 'var(--text-secondary)',
                                        border: 'none',
                                    }}
                                >
                                    MAC
                                </button>
                            </div>
                            <input
                                placeholder={customMatchMode === 'mac' ? 'e.g. 00:11:22:33:44:55' : 'e.g. eth* or enp3s0'}
                                value={customMatchValue}
                                onChange={e => setCustomMatchValue(e.target.value)}
                                className="form-input"
                                style={{ fontSize: '0.85rem' }}
                                onKeyDown={e => { if (e.key === 'Enter' && customMatchValue) selectCustom(); }}
                            />
                            <button
                                onClick={selectCustom}
                                disabled={!customMatchValue}
                                className="btn-primary"
                                style={{ padding: '0.5rem', fontSize: '0.85rem', opacity: customMatchValue ? 1 : 0.5 }}
                            >
                                Continue <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (wizardStep === 'essential-config') {
            const networkSection = sections['Network'];
            const matchName = config.Match?.Name || config.Match?.MACAddress || '';

            return (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <header className="flex-row" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <button onClick={() => setWizardStep('match-selection')} className="btn-back"><ArrowLeft /></button>
                        <h1>Configure Network</h1>
                    </header>
                    <div className="form-section">
                        <div className="form-display-box" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ color: 'var(--text-secondary)' }}>
                                {config.Match?.MACAddress ? 'MATCHING MAC ADDRESS' : 'MATCHING DEVICE'}
                            </label>
                            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                {matchName}
                            </div>
                        </div>

                        {networkSection && networkSection.options.filter(o => o.category === 'basic').map(opt => (
                            <ConfigField
                                key={opt.key}
                                option={opt}
                                sectionName="Network"
                                value={(config.Network || {})[opt.name]}
                                onChange={(val) => updateConfig('Network', opt.name, val)}
                                interfaceFiles={interfaceFiles}
                            />
                        ))}

                        <div className="form-display-box" style={{ marginTop: '1.5rem' }}>
                            <label className="form-label" style={{ color: 'var(--text-secondary)' }}>TARGET FILENAME</label>
                            <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename || '(Pending...)'}</div>
                        </div>

                        <div className="flex-row" style={{ gap: '1rem', marginTop: '2rem' }}>
                            <button onClick={() => saveMutation.mutate({ filename, config })} className="btn-primary" style={{ flex: 2, padding: '0.8rem', borderRadius: '6px', justifyContent: 'center' }}>
                                <Check size={20} /> Create Network
                            </button>
                            <button onClick={() => { setWizardStep('full-editor'); setActiveTab('Match'); }} className="btn-secondary" style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                Advanced <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // ---- FULL EDITOR ----
    const currentSectionSchema = sections[activeTab];

    const renderFieldToggle = (tier: CategoryTier, toggleMap: Record<string, boolean>, setToggleMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
        if (!currentSectionSchema || currentSectionSchema.multiple) return null;
        const sectionName = currentSectionSchema.name;
        const hasFields = currentSectionSchema.options.some(o => o.category === tier);
        if (!hasFields) return null;
        const isOn = toggleMap[sectionName];
        const label = tier === 'advanced' ? 'Advanced' : 'Expert';
        return (
            <button
                onClick={() => setToggleMap(prev => ({ ...prev, [sectionName]: !isOn }))}
                className="btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
            >
                {isOn ? `Hide ${label} Options` : `Show ${label} Options`}
            </button>
        );
    };

    const shouldShowField = (opt: { category: CategoryTier }, sectionName: string): boolean => {
        if (opt.category === 'basic') return true;
        if (opt.category === 'advanced') return !!advancedFieldToggles[sectionName];
        if (opt.category === 'expert') return !!expertFieldToggles[sectionName];
        return false;
    };

    const editorContent = (
        <div className="two-col-layout">
            {/* Sidebar */}
            <div className="sidebar">
                {isNetdev && (
                    <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>DEVICE KIND</label>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.2rem' }}>{netdevKind.toUpperCase()}</div>
                    </div>
                )}

                {groupedTabs.map(group => {
                    const isBasic = group.category === 'basic';
                    const isExpanded = isBasic || categoryToggles[group.category] || group.tabs.includes(activeTab);
                    return (
                        <div key={group.category} style={{ marginBottom: '0.5rem' }}>
                            <button
                                onClick={() => !isBasic && setCategoryToggles(prev => ({ ...prev, [group.category]: !isExpanded }))}
                                className={`btn-category${isBasic ? ' active' : ''}`}
                                style={{ cursor: isBasic ? 'default' : 'pointer', opacity: isBasic ? 1 : 0.9 }}
                            >
                                {group.label.toUpperCase()}
                                {!isBasic && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                            </button>
                            {isExpanded && (
                                <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                                    {group.tabs.map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`btn-tab${activeTab === tab ? ' active' : ''}`}
                                        >
                                            {sections[tab]?.label || tab}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Main Form */}
            <div className="form-section">
                <div className="flex-row-between" style={{ marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        {currentSectionSchema?.label}
                        {currentSectionSchema?.docUrl && (
                            <a href={currentSectionSchema.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}><ExternalLink size={18} /></a>
                        )}
                    </h2>
                </div>

                {/* Filename display */}
                {getFilenameTab(configType) === activeTab && (
                    <div className="form-display-box">
                        <label className="form-label" style={{ color: 'var(--text-secondary)' }}>TARGET FILENAME (AUTO-GENERATED)</label>
                        <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename || '(Pending Name...)'}</div>
                    </div>
                )}

                {currentSectionSchema && (
                    currentSectionSchema.multiple ? (() => {
                        const raw = config[currentSectionSchema.name];
                        const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
                        return (<div>
                            {items.map((_: any, idx: number) => (
                                <div key={idx} className="form-item-container">
                                    <button onClick={() => removeSectionItem(currentSectionSchema.name, idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    {currentSectionSchema.options.map(opt => (
                                        <ConfigField
                                            key={opt.key}
                                            option={opt}
                                            sectionName={currentSectionSchema.name}
                                            value={(items[idx] || {})[opt.name]}
                                            onChange={(val) => updateConfig(currentSectionSchema.name, opt.name, val, idx)}
                                            interfaceFiles={interfaceFiles}
                                        />
                                    ))}
                                </div>
                            ))}
                            <button onClick={() => addSectionItem(currentSectionSchema.name)} className="btn-add-dashed">
                                <Plus size={16} /> Add {currentSectionSchema.label}
                            </button>
                        </div>);
                    })() : (
                        <>
                            {currentSectionSchema.options.map(opt => {
                                if (!shouldShowField(opt, currentSectionSchema.name)) return null;
                                return (
                                    <ConfigField
                                        key={opt.key}
                                        option={opt}
                                        sectionName={currentSectionSchema.name}
                                        value={(config[currentSectionSchema.name] || {})[opt.name]}
                                        onChange={(val) => updateConfig(currentSectionSchema.name, opt.name, val)}
                                        interfaceFiles={interfaceFiles}
                                    />
                                );
                            })}
                            {renderFieldToggle('advanced', advancedFieldToggles, setAdvancedFieldToggles)}
                            {renderFieldToggle('expert', expertFieldToggles, setExpertFieldToggles)}
                        </>
                    )
                )}
            </div>
        </div>
    );

    // Inline mode (for SystemPage embedding)
    if (inline) {
        return (
            <div>
                <div className="flex-row-between" style={{ marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>networkd.conf</h2>
                    <button
                        onClick={() => saveMutation.mutate({ filename, config })}
                        className="btn-primary"
                    >
                        <Save size={16} /> Save Changes
                    </button>
                </div>
                {editorContent}
            </div>
        );
    }

    // Full page mode
    return (
        <div className="editor-layout">
            <div className="editor-content">
                <header className="page-header">
                    <div className="flex-row" style={{ gap: '1rem' }}>
                        <Link to="/configuration"><button className="btn-back"><ArrowLeft /></button></Link>
                        <h1>{paramFilename ? `Edit ${getConfigLabel(configType)}` : `New ${getConfigLabel(configType)}`}</h1>
                    </div>
                    <div className="flex-row" style={{ gap: '1rem' }}>
                        {paramFilename && api.delete && (
                            <button
                                onClick={() => { if (confirm(`Delete this ${configType} config?`)) deleteMutation.mutate(paramFilename); }}
                                className="btn-danger"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button
                            onClick={() => saveMutation.mutate({ filename, config })}
                            className="btn-primary"
                        >
                            <Save size={16} /> Save {getConfigLabel(configType)}
                        </button>
                    </div>
                </header>

                {editorContent}
            </div>

            <LivePreview
                type={configType}
                config={config}
                sections={sections}
                style={{ height: '18vh', width: '100%', zIndex: 10 }}
            />
        </div>
    );
};

export default ConfigEditor;
