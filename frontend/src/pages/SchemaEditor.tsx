import React, { useState, useEffect, useMemo } from 'react';
import { useViewConfig, useSaveViewConfig, type CategoryViewConfig, type SectionViewConfig, type RootViewConfig } from '../hooks/useViewConfig';
import { NETWORK_SECTIONS, NETDEV_SECTIONS, LINK_SECTIONS } from './schema';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ToastContext';

// --- Helper to get all options for a section ---
const getAllOptions = (sectionName: string): string[] => {
    const opts = new Set<string>();
    [NETWORK_SECTIONS, NETDEV_SECTIONS, LINK_SECTIONS].forEach(schema => {
        const section = (schema as any)[sectionName];
        if (section && section.options) {
            section.options.forEach((opt: any) => opts.add(opt.key));
        }
    });
    return Array.from(opts).sort();
};

// --- Section Editor Component ---
function SectionEditor({ section, onUpdate, onDelete }: {
    section: SectionViewConfig,
    onUpdate: (sec: SectionViewConfig) => void,
    onDelete: () => void
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const visibleFields = section.visible || [];
    const allAvailable = useMemo(() => getAllOptions(section.name), [section.name]);
    const unusedFields = useMemo(() => allAvailable.filter(f => !visibleFields.includes(f)), [allAvailable, visibleFields]);

    const handleMoveField = (idx: number, direction: 'up' | 'down') => {
        const newFields = [...visibleFields];
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
        onUpdate({ ...section, visible: newFields });
    };

    const handleRemoveField = (idx: number) => {
        const newFields = visibleFields.filter((_, i) => i !== idx);
        onUpdate({ ...section, visible: newFields });
    };

    const handleAddField = (field: string) => {
        onUpdate({ ...section, visible: [...visibleFields, field] });
    };

    return (
        <div style={{
            padding: '0.5rem',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            marginBottom: '0.5rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <span style={{ fontWeight: 500 }}>{section.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ({visibleFields.length} visible, {unusedFields.length} advanced)
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Pass-through Delete for Section */}
                    <button onClick={onDelete} style={{ color: 'var(--error)', cursor: 'pointer', background: 'none', border: 'none' }}>×</button>
                </div>
            </div>

            {isExpanded && (
                <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '1rem' }}>
                    {/* Visible Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>VISIBLE FIELDS</div>
                        {visibleFields.map((field, idx) => (
                            <div key={field} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'var(--bg-primary)', padding: '0.25rem 0.5rem', borderRadius: '3px', fontSize: '0.9rem'
                            }}>
                                <span>{field}</span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button
                                        disabled={idx === 0}
                                        onClick={() => handleMoveField(idx, 'up')}
                                        style={{ cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                                    >↑</button>
                                    <button
                                        disabled={idx === visibleFields.length - 1}
                                        onClick={() => handleMoveField(idx, 'down')}
                                        style={{ cursor: idx === visibleFields.length - 1 ? 'default' : 'pointer', opacity: idx === visibleFields.length - 1 ? 0.3 : 1 }}
                                    >↓</button>
                                    <button onClick={() => handleRemoveField(idx)} style={{ color: 'var(--error)' }}>×</button>
                                </div>
                            </div>
                        ))}
                        {visibleFields.length === 0 && <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No fields explicitly visible (all advanced)</div>}
                    </div>

                    {/* Unused (Advanced) Fields */}
                    {unusedFields.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>ADVANCED (HIDDEN) FIELDS</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {unusedFields.map(field => (
                                    <button
                                        key={field}
                                        onClick={() => handleAddField(field)}
                                        style={{
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '0.25rem'
                                        }}
                                    >
                                        <Plus size={12} /> {field}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


// --- Sortable Item Component ---
function SortableCategory({ category, isActive, onToggle, onDelete, onUpdate }: {
    category: CategoryViewConfig,
    isActive: boolean,
    onToggle: () => void,
    onDelete: () => void,
    onUpdate: (cat: CategoryViewConfig) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.name });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: '0.5rem',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        background: 'var(--bg-secondary)',
    };

    const moveSection = (idx: number, direction: 'up' | 'down') => {
        const newSections = [...category.sections];
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newSections[idx], newSections[newIdx]] = [newSections[newIdx], newSections[idx]];
        onUpdate({ ...category, sections: newSections });
    };

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-secondary)' }}>
                    <GripVertical size={20} />
                </div>
                <div style={{ flex: 1, fontWeight: 'bold' }}>{category.name}</div>
                <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {isActive ? <ChevronDown /> : <ChevronRight />}
                </button>
                <button onClick={onDelete} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                </button>
            </div>

            {isActive && (
                <div style={{ padding: '0.5rem 1rem 1rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                    {/* Sections List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {category.sections.map((sec, idx) => (
                            <div key={sec.name} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.5rem' }}>
                                    <button
                                        onClick={() => moveSection(idx, 'up')} disabled={idx === 0}
                                        style={{ cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, border: 'none', background: 'none', padding: 0 }}
                                    >↑</button>
                                    <button
                                        onClick={() => moveSection(idx, 'down')} disabled={idx === category.sections.length - 1}
                                        style={{ cursor: idx === category.sections.length - 1 ? 'default' : 'pointer', opacity: idx === category.sections.length - 1 ? 0.3 : 1, border: 'none', background: 'none', padding: 0 }}
                                    >↓</button>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <SectionEditor
                                        section={sec}
                                        onDelete={() => {
                                            const newSections = category.sections.filter((_, i) => i !== idx);
                                            onUpdate({ ...category, sections: newSections });
                                        }}
                                        onUpdate={(updatedSection) => {
                                            const newSections = [...category.sections];
                                            newSections[idx] = updatedSection;
                                            onUpdate({ ...category, sections: newSections });
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {category.sections.length === 0 && <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No sections</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

const SchemaEditor: React.FC = () => {
    const { data: viewConfig, refetch } = useViewConfig();
    const saveMutation = useSaveViewConfig();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // Local State
    const [localConfig, setLocalConfig] = useState<RootViewConfig | null>(null);
    const [activeType, setActiveType] = useState<keyof RootViewConfig>('network');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Initial Load
    useEffect(() => {
        if (viewConfig) {
            setLocalConfig(viewConfig);
        }
    }, [viewConfig]);

    // Gather all available sections based on Active Type
    const allSections = useMemo(() => {
        const sections = new Set<string>();
        let schemas: any[] = [];
        if (activeType === 'network') schemas = [NETWORK_SECTIONS];
        else if (activeType === 'netdev') schemas = [NETDEV_SECTIONS];
        else if (activeType === 'link') schemas = [LINK_SECTIONS];

        schemas.forEach(schema => {
            Object.keys(schema as any).forEach(k => sections.add(k));
        });
        return Array.from(sections).sort();
    }, [activeType]);

    // Calculate Unused Sections
    const unusedSections = useMemo(() => {
        if (!localConfig) return [];
        const currentCats = localConfig[activeType] || [];
        const used = new Set<string>();
        currentCats.forEach(cat => cat.sections.forEach(s => used.add(s.name)));
        return allSections.filter(s => !used.has(s));
    }, [localConfig, activeType, allSections]);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!localConfig || active.id === over?.id) return;

        setLocalConfig((prev) => {
            if (!prev) return null;
            const items = prev[activeType];
            const oldIndex = items.findIndex(i => i.name === active.id);
            const newIndex = items.findIndex(i => i.name === over?.id);
            return {
                ...prev,
                [activeType]: arrayMove(items, oldIndex, newIndex)
            };
        });
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!localConfig) return;
        try {
            await saveMutation.mutateAsync(localConfig);
            setIsDirty(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['view-config'] });
            showToast('Configuration Saved!', 'success');
        } catch (e: any) {
            showToast('Error saving: ' + e.message, 'error');
        }
    };

    const confirmAddCategory = () => {
        if (newCategoryName && localConfig) {
            setLocalConfig(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    [activeType]: [...prev[activeType], { name: newCategoryName, sections: [] }]
                };
            });
            setIsDirty(true);
            setIsAddingCategory(false);
            setNewCategoryName('');
        }
    };

    const handleAddSectionToCategory = (catIdx: number, sectionName: string) => {
        setLocalConfig(prev => {
            if (!prev) return null;
            const newCats = [...prev[activeType]];
            newCats[catIdx] = {
                ...newCats[catIdx],
                sections: [...newCats[catIdx].sections, { name: sectionName, visible: [] }]
            };
            return { ...prev, [activeType]: newCats };
        });
        setIsDirty(true);
    };

    if (!localConfig) return <div>Loading...</div>;

    const currentCategories = localConfig[activeType];

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', position: 'relative' }}>
            {/* Modal Overlay */}
            {isAddingCategory && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--bg-primary)', padding: '2rem', borderRadius: '8px', minWidth: '300px',
                        boxShadow: '0 44px 6px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginTop: 0 }}>New Category</h3>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Category Name"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmAddCategory(); if (e.key === 'Escape') setIsAddingCategory(false); }}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button onClick={() => setIsAddingCategory(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={confirmAddCategory} disabled={!newCategoryName} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Interface Editor</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setIsAddingCategory(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem' }}>
                            <Plus size={18} /> New Category
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', background: isDirty ? 'var(--primary)' : 'gray', color: 'white', border: 'none', borderRadius: '4px' }}
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    {(['network', 'netdev', 'link'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => { setActiveType(type); setActiveCategory(null); }}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeType === type ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                fontWeight: activeType === type ? 'bold' : 'normal',
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                            }}
                        >
                            {type} Config
                        </button>
                    ))}
                </div>
            </header>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Main Editor */}
                <div style={{ flex: 1 }}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={currentCategories.map(c => c.name)} strategy={verticalListSortingStrategy}>
                            {currentCategories.map((cat, idx) => (
                                <SortableCategory
                                    key={cat.name}
                                    category={cat}
                                    isActive={activeCategory === cat.name}
                                    onToggle={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                                    onDelete={() => {
                                        if (confirm(`Delete category "${cat.name}"? Sections will be unassigned.`)) {
                                            setLocalConfig(prev => {
                                                if (!prev) return null;
                                                return {
                                                    ...prev,
                                                    [activeType]: prev[activeType].filter((_, i) => i !== idx)
                                                };
                                            });
                                            setIsDirty(true);
                                        }
                                    }}
                                    onUpdate={(updatedCat) => {
                                        setLocalConfig(prev => {
                                            if (!prev) return null;
                                            const newCats = [...prev[activeType]];
                                            newCats[idx] = updatedCat;
                                            return { ...prev, [activeType]: newCats };
                                        });
                                        setIsDirty(true);
                                    }}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                    {currentCategories.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'gray' }}>No categories defined for {activeType}. Add one to start.</div>}
                </div>

                {/* Unused Sections Pool */}
                <div style={{ width: '250px', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginTop: 0 }}>Unassigned Sections</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {unusedSections.map(sec => (
                            <div key={sec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                                <span>{sec}</span>
                                <button
                                    disabled={!activeCategory}
                                    onClick={() => {
                                        if (activeCategory) {
                                            const catIdx = currentCategories.findIndex(c => c.name === activeCategory);
                                            if (catIdx !== -1) {
                                                handleAddSectionToCategory(catIdx, sec);
                                            }
                                        }
                                    }}
                                    style={{ cursor: activeCategory ? 'pointer' : 'not-allowed', color: activeCategory ? 'var(--primary)' : 'gray', fontSize: '1.2rem', lineHeight: 1, padding: 0, border: 'none', background: 'none' }}
                                >
                                    +
                                </button>
                            </div>
                        ))}
                        {unusedSections.length === 0 && <div style={{ color: 'gray', fontStyle: 'italic' }}>All sections assigned!</div>}
                        {!activeCategory && currentCategories.length > 0 && <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'orange' }}>Select/Expand a category to add sections</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchemaEditor;
