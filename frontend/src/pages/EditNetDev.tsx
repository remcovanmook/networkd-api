
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ArrowLeft, Trash2, ExternalLink, ChevronDown, ChevronRight, Save, Layers, Check, ArrowRight, Plus } from 'lucide-react';
import { NETDEV_SECTIONS, NETDEV_KINDS, COMMON_NETDEV_KINDS, type ConfigOption } from './schema';
import { useViewConfig } from '../hooks/useViewConfig';
import { useToast } from '../components/ToastContext';
import { ConfigField } from '../components/ConfigField';
import { LivePreview } from '../components/LivePreview';

interface SectionDef {
    name: string;
    label?: string;
    description?: string;
    docUrl?: string;
    multiple?: boolean;
    options: ConfigOption[];
}
const typedNetdevSections = NETDEV_SECTIONS as unknown as Record<string, SectionDef>;

type WizardStep = 'kind-selection' | 'essential-config' | 'full-editor';

const EditNetDev: React.FC = () => {
    const navigate = useNavigate();
    const { filename: paramFilename } = useParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // Load View Config
    const { data: viewConfig } = useViewConfig();

    // UI State
    const [wizardStep, setWizardStep] = useState<WizardStep>(paramFilename ? 'full-editor' : 'kind-selection');
    const [showAdvancedKinds, setShowAdvancedKinds] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('NetDev');
    const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({ 'Basic': true });
    const [advancedFieldToggles, setAdvancedFieldToggles] = useState<Record<string, boolean>>({});

    // Config State
    const [filename, setFilename] = useState(paramFilename || '');
    const [config, setConfig] = useState<any>({ NetDev: { Kind: 'bridge' } });
    const [netdevKind, setNetdevKind] = useState('bridge');
    const [manualNameOverride, setManualNameOverride] = useState('');

    // Determine config to use (NETDEV only)
    const viewConfigLookup = useMemo(() => {
        const lookup: Record<string, string[]> = {};
        if (viewConfig && viewConfig.netdev) {
            viewConfig.netdev.forEach(cat => {
                cat.sections.forEach(sec => {
                    lookup[sec.name] = sec.visible || [];
                });
            });
        }
        return lookup;
    }, [viewConfig]);

    // Fetch existing configuration
    const { data: existingConfig, isSuccess: isLoaded } = useQuery({
        queryKey: ['netdev', paramFilename],
        queryFn: () => apiClient.getNetwork(paramFilename!, 'netdev'),
        enabled: !!paramFilename,
        retry: false
    });

    // Initialize Form Data
    useEffect(() => {
        if (paramFilename && isLoaded && existingConfig) {
            setFilename(paramFilename);
            setConfig(existingConfig);
            if (existingConfig.NetDev?.Kind) setNetdevKind(existingConfig.NetDev.Kind);
            else if (existingConfig.netdev?.kind) setNetdevKind(existingConfig.netdev.kind);

            setWizardStep('full-editor');

            // Auto-Expand Advanced
            const newFieldToggles: Record<string, boolean> = {};
            Object.keys(typedNetdevSections).forEach(key => {
                const def = typedNetdevSections[key];
                const sectionName = def.name || key;
                const sectionData = existingConfig[sectionName];
                if (sectionData) {
                    const visibleOpts = viewConfigLookup[sectionName];
                    const hasAdvanced = def.options.some(opt => {
                        const isAdvanced = visibleOpts ? !visibleOpts.includes(opt.key) : true;
                        if (!isAdvanced) return false;
                        const val = sectionData[opt.name];
                        return Array.isArray(val) ? val.length > 0 : (val !== '' && val !== undefined);
                    });
                    if (hasAdvanced) newFieldToggles[sectionName] = true;
                }
            });
            setAdvancedFieldToggles(newFieldToggles);
        }
    }, [isLoaded, existingConfig, paramFilename, viewConfigLookup]);

    // Smart Naming Logic
    useEffect(() => {
        if (!paramFilename) {
            let name = config.NetDev?.Name || '';

            // Auto-generate name based on kind if not set
            if (!name && wizardStep !== 'full-editor') {
                switch (netdevKind) {
                    case 'vlan': name = config.VLAN?.Id ? `vlan${config.VLAN.Id} ` : ''; break;
                    case 'vxlan': name = config.VXLAN?.VNI ? `vxlan${config.VXLAN.VNI} ` : ''; break;
                    case 'bond': name = 'bond0'; break;
                    case 'bridge': name = 'br0'; break;
                    default: name = `${netdevKind} 0`;
                }
                if (manualNameOverride) name = manualNameOverride;
            }

            if (name) {
                // Update Name in Config if changed
                if (config.NetDev?.Name !== name) {
                    setConfig((prev: any) => ({ ...prev, NetDev: { ...prev.NetDev, Name: name } }));
                }
                setFilename(`25 - ${name}.netdev`);
            }
        }
    }, [config, netdevKind, manualNameOverride, paramFilename, wizardStep]);

    // Tabs Logic
    const groupedTabs = useMemo(() => {
        if (!viewConfig || !viewConfig.netdev) return [];
        const result: { category: string, tabs: string[] }[] = [];
        const usedTabs = new Set<string>();

        // Filter available tabs based on Kind (NetDev + KindSpecific)
        const kindSpecific = NETDEV_KINDS[netdevKind] || [];
        const availableTabs = Object.keys(typedNetdevSections).filter(t => t === 'NetDev' || kindSpecific.includes(t));

        viewConfig.netdev.forEach(cat => {
            const catTabs: string[] = [];
            cat.sections.forEach(sec => {
                const foundTab = availableTabs.find(t => t === sec.name);
                if (foundTab) {
                    catTabs.push(foundTab);
                    usedTabs.add(foundTab);
                }
            });
            if (catTabs.length > 0) result.push({ category: cat.name, tabs: catTabs });
        });

        const orphanTabs = availableTabs.filter(t => !usedTabs.has(t));
        if (orphanTabs.length > 0) result.push({ category: 'Advanced', tabs: orphanTabs });

        return result;
    }, [viewConfig, netdevKind]);


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

    const mutationLocal = useMutation({
        mutationFn: async (data: { filename: string, config: any }) => {
            // NetDev payload is just the config, but backend expects 'netdev' key wrapper if strictly following previous logic?
            // Wait, previous updateNetDevConfig just set 'config' state. 
            // `apiClient.createNetDev` might expect just the struct. 
            // In EditNetwork, payloadNetDev was `{ ...netdevConfig } `.
            return apiClient.createNetDev(data.filename, data.config);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['netdevs'] });
            showToast('Device configuration saved', 'success');
            navigate('/interfaces');
        },
        onError: (err: any) => showToast(`Failed: ${err.message} `, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async (fname: string) => apiClient.deleteNetDev(fname),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['netdevs'] });
            showToast('Device configuration deleted', 'success');
            navigate('/interfaces');
        }
    });

    // Helper to add list item (for multiple sections)
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


    // WIZARD VIEW
    if (!paramFilename && wizardStep !== 'full-editor') {
        const kindsToShow = showAdvancedKinds ? Object.keys(NETDEV_KINDS) : COMMON_NETDEV_KINDS;

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
                                    setConfig({ NetDev: { Kind: k } });
                                    setManualNameOverride('');
                                }}
                                style={{
                                    padding: '2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                                    opacity: (NETDEV_KINDS[k].includes('NetDev') && !COMMON_NETDEV_KINDS.includes(k)) ? 0.8 : 1
                                }}
                            >
                                <Layers size={32} />
                                {k}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <button onClick={() => setShowAdvancedKinds(!showAdvancedKinds)} style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                            {showAdvancedKinds ? 'Hide Advanced Devices' : 'Show Advanced Devices'}
                        </button>
                    </div>
                </div>
            );
        }

        if (wizardStep === 'essential-config') {
            const kindDef = NETDEV_KINDS[netdevKind];
            const specificSectionKey = kindDef?.find(k => k !== 'NetDev');

            return (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                        <button onClick={() => setWizardStep('kind-selection')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}><ArrowLeft /></button>
                        <h1>Configure {netdevKind.toUpperCase()}</h1>
                    </header>
                    <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px' }}>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Configure essential properties.</p>

                        {specificSectionKey && typedNetdevSections[specificSectionKey] &&
                            typedNetdevSections[specificSectionKey].options.filter(o => !o.advanced).map(opt => (
                                <ConfigField
                                    key={opt.key}
                                    option={opt}
                                    sectionName={typedNetdevSections[specificSectionKey].name}
                                    value={(config[typedNetdevSections[specificSectionKey].name] || {})[opt.name]}
                                    onChange={(val) => updateConfig(typedNetdevSections[specificSectionKey].name, opt.name, val)}
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
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button onClick={() => mutationLocal.mutate({ filename, config })} style={{ flex: 2, background: 'var(--accent-primary)', color: 'white', padding: '0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                <Check size={20} /> Create Device
                            </button>
                            <button onClick={() => setWizardStep('full-editor')} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', padding: '0.8rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                Advanced <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }


    // FULL EDITOR
    const currentSectionSchema = typedNetdevSections[activeTab];
    const visibleOptions = viewConfigLookup[activeTab];
    const hasAdvancedFields = currentSectionSchema?.options.some(o => visibleOptions ? !visibleOptions.includes(o.key) : false);
    const isSectionAdvancedToggleOn = advancedFieldToggles[currentSectionSchema?.name || ''];

    return (
        <div style={{
            height: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Scrollable Editor Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                width: '100%',
                maxWidth: '1200px',
                margin: '0 auto',
                boxSizing: 'border-box'
            }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Link to="/interfaces"><button style={{ padding: '0.5rem', display: 'flex', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}><ArrowLeft /></button></Link>
                        <h1>{paramFilename ? 'Edit Virtual Device' : `Create ${netdevKind.toUpperCase()} `}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {paramFilename && (
                            <button
                                onClick={() => { if (confirm('Delete this device config?')) deleteMutation.mutate(paramFilename); }}
                                style={{ backgroundColor: 'var(--error)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button
                            onClick={() => mutationLocal.mutate({ filename, config })}
                            style={{ backgroundColor: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Save size={16} /> Save Device
                        </button>
                    </div>
                </header>

                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', minHeight: 'min-content' }}>
                    {/* Sidebar */}
                    <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>

                        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>DEVICE KIND</label>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.2rem' }}>{netdevKind.toUpperCase()}</div>
                        </div>

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
                                                    {typedNetdevSections[tab]?.label || tab}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                {currentSectionSchema?.label}
                                {currentSectionSchema?.docUrl && (
                                    <a href={currentSectionSchema.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}><ExternalLink size={18} /></a>
                                )}
                            </h2>
                        </div>

                        {activeTab === 'NetDev' && (
                            <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>TARGET FILENAME (AUTO-GENERATED)</label>
                                <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename || '(Pending Name...)'}</div>
                            </div>
                        )}

                        {currentSectionSchema && (
                            currentSectionSchema.multiple ? (
                                <div>
                                    {(config[currentSectionSchema.name] || []).map((_: any, idx: number) => (
                                        <div key={idx} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', position: 'relative' }}>
                                            <button onClick={() => removeSectionItem(currentSectionSchema.name, idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            {currentSectionSchema.options.map(opt => (
                                                <ConfigField
                                                    key={opt.key}
                                                    option={opt}
                                                    sectionName={currentSectionSchema.name}
                                                    value={((config[currentSectionSchema.name] || [])[idx] || {})[opt.name]}
                                                    onChange={(val) => updateConfig(currentSectionSchema.name, opt.name, val, idx)}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <button onClick={() => addSectionItem(currentSectionSchema.name)} style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', width: '100%', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <Plus size={16} /> Add {currentSectionSchema.label}
                                    </button>
                                </div>
                            ) : (
                                currentSectionSchema.options.map(opt => {
                                    const isAdvanced = visibleOptions ? !visibleOptions.includes(opt.key) : true;
                                    if (isAdvanced && !isSectionAdvancedToggleOn) return null;

                                    return (
                                        <ConfigField
                                            key={opt.key}
                                            option={opt}
                                            sectionName={currentSectionSchema.name}
                                            value={(config[currentSectionSchema.name] || {})[opt.name]}
                                            onChange={(val) => updateConfig(currentSectionSchema.name, opt.name, val)}
                                        />
                                    );
                                })
                            )
                        )}

                        {hasAdvancedFields && !currentSectionSchema?.multiple && (
                            <button
                                onClick={() => setAdvancedFieldToggles(prev => ({ ...prev, [currentSectionSchema.name]: !isSectionAdvancedToggleOn }))}
                                style={{
                                    marginTop: '1rem', background: 'transparent',
                                    border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                    padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                {isSectionAdvancedToggleOn ? 'Hide Advanced Options' : 'Show Advanced Options'}
                            </button>
                        )}

                    </div>
                </div>
            </div>

            {/* Fixed Live Preview Pane (Lower Third) */}
            <LivePreview
                type="netdev"
                config={config}
                sections={typedNetdevSections}
                style={{ height: '18vh', width: '100%', zIndex: 10 }}
            />
        </div>
    );
};

export default EditNetDev;
