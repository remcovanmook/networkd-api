import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ArrowLeft, Trash2, ExternalLink, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { useViewConfig } from '../hooks/useViewConfig';
import { useToast } from '../components/ToastContext';
import { ConfigField } from '../components/ConfigField';
import { LivePreview } from '../components/LivePreview';
import { useSchema } from '../contexts/SchemaContext';

const EditLink: React.FC = () => {
    const navigate = useNavigate();
    const { filename: paramFilename } = useParams();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { linkSections, loading: schemaLoading } = useSchema();

    // Load View Config
    const { data: viewConfig } = useViewConfig();

    // UI State
    const [activeTab, setActiveTab] = useState<string>('Match');
    const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({
        'Basic': true
    });
    const [advancedFieldToggles, setAdvancedFieldToggles] = useState<Record<string, boolean>>({});

    // Config State
    const [filename, setFilename] = useState(paramFilename || '');
    const [config, setConfig] = useState<any>({
        Match: { OriginalName: searchParams.get('match') || '' }
    });

    // Ensure schema is loaded
    if (schemaLoading || !linkSections) {
        return <div style={{ padding: '2rem' }}>Loading schema configuration...</div>;
    }
    const typedLinkSections = linkSections;

    // Determine config to use (LINK only)
    const viewConfigLookup = useMemo(() => {
        const lookup: Record<string, string[]> = {};
        if (viewConfig && viewConfig.link) {
            viewConfig.link.forEach(cat => {
                cat.sections.forEach(sec => {
                    lookup[sec.name] = sec.visible || [];
                });
            });
        }
        return lookup;
    }, [viewConfig]);

    // Fetch existing configuration
    const { data: existingConfig, isSuccess: isLoaded } = useQuery({
        queryKey: ['link', paramFilename],
        queryFn: () => apiClient.getNetwork(paramFilename!, 'link'),
        enabled: !!paramFilename,
        retry: false
    });

    // Initialize Form Data
    useEffect(() => {
        if (paramFilename && isLoaded && existingConfig) {
            setFilename(paramFilename);
            setConfig(existingConfig);

            // Auto-Expand Advanced Fields
            const newFieldToggles: Record<string, boolean> = {};
            Object.keys(typedLinkSections).forEach(key => {
                const def = typedLinkSections[key];
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
        } else if (!paramFilename) {
            // New File Initialization
            const match = searchParams.get('match');
            if (match) {
                setConfig((prev: any) => ({
                    ...prev,
                    Match: { ...prev.Match, OriginalName: match }
                }));
            }
        }
    }, [isLoaded, existingConfig, paramFilename, searchParams, viewConfigLookup]);

    // Smart Naming Logic
    useEffect(() => {
        if (!paramFilename) {
            const name = config.Match?.OriginalName || config.Match?.Name || '';
            if (name) {
                setFilename(`99-${name}.link`);
            }
        }
    }, [config.Match?.OriginalName, config.Match?.Name, paramFilename]);


    // Tabs Logic
    const groupedTabs = useMemo(() => {
        if (!viewConfig || !viewConfig.link) return [];
        const result: { category: string, tabs: string[] }[] = [];
        const usedTabs = new Set<string>();
        const availableTabs = Object.keys(typedLinkSections);

        viewConfig.link.forEach(cat => {
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
    }, [viewConfig]);


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
            return apiClient.createLink(data.filename, data.config);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['links'] });
            await queryClient.invalidateQueries({ queryKey: ['interfaces'] }); // refresh list
            showToast('Link configuration saved', 'success');
            navigate('/configuration');
        },
        onError: (err: any) => showToast(`Failed: ${err.message}`, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async (fname: string) => apiClient.deleteLink(fname),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['links'] });
            await queryClient.invalidateQueries({ queryKey: ['interfaces'] });
            showToast('Link deleted', 'success');
            navigate('/configuration');
        }
    });

    const currentSectionSchema = typedLinkSections[activeTab];
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
                        <Link to="/configuration"><button style={{ padding: '0.5rem', display: 'flex', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}><ArrowLeft /></button></Link>
                        <h1>{paramFilename ? 'Edit Link' : 'New Link'}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {paramFilename && (
                            <button
                                onClick={() => { if (paramFilename && confirm('Delete this link config?')) deleteMutation.mutate(paramFilename); }}
                                style={{ backgroundColor: 'var(--error)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button
                            onClick={() => mutationLocal.mutate({ filename, config })}
                            style={{ backgroundColor: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Save size={16} /> Save Link
                        </button>
                    </div>
                </header>

                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', minHeight: 'min-content' }}>
                    {/* Sidebar */}
                    <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
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
                                                    {typedLinkSections[tab]?.label || tab}
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
                        {currentSectionSchema?.description && (
                            <p style={{ marginTop: 0, marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '700px' }}>
                                {currentSectionSchema.description}
                            </p>
                        )}

                        {/* Filename Display in Match */}
                        {activeTab === 'Match' && (
                            <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>TARGET FILENAME (AUTO-GENERATED)</label>
                                <div style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{filename || '(Pending Name...)'}</div>
                            </div>
                        )}

                        {currentSectionSchema && currentSectionSchema.options.map(opt => {
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
                        })}

                        {hasAdvancedFields && (
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
                type="link"
                config={config}
                sections={typedLinkSections}
                style={{ height: '18vh', width: '100%', zIndex: 10 }}
            />
        </div>
    );
};

export default EditLink;
