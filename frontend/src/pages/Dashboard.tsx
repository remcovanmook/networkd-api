import React, { useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

import { Activity, ArrowRight, Network as NetworkIcon, Sliders, Trash2, RefreshCw, Zap, Plus, TrainFrontTunnel } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const { showToast } = useToast();
    // 1. Virtual Devices (.netdev) - Definitions
    const { data: netdevs } = useQuery({
        queryKey: ['netdevs'],
        queryFn: apiClient.getNetDevs
    });

    // 2. System Interfaces (Runtime Links) - Active State
    const { data: systemStatus } = useQuery({
        queryKey: ['systemStatus'],
        queryFn: apiClient.getSystemStatus
    });
    const links = systemStatus?.interfaces;

    // 3. Network Profiles (.network) - Configurations
    const { data: configs } = useQuery({
        queryKey: ['networks'],
        queryFn: apiClient.getNetworks
    });

    // 4. Link Configurations (.link)
    const { data: linkConfigs } = useQuery({
        queryKey: ['links'],
        queryFn: apiClient.getLinkConfigs
    });

    const queryClient = useQueryClient();

    const deleteNetDev = useMutation({
        mutationFn: apiClient.deleteNetDev,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['netdevs'] })
    });

    const deleteNetwork = useMutation({
        mutationFn: apiClient.deleteNetwork,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['networks'] })
    });

    const deleteLink = useMutation({
        mutationFn: apiClient.deleteLink,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['links'] });
            queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
        }
    });



    const reloadMutation = useMutation({
        mutationFn: apiClient.reloadNetworkd,
        onSuccess: () => {
            showToast('Networkd reloaded successfully', 'success');
            queryClient.invalidateQueries();
        }
    });

    const reconfigureMutation = useMutation({
        mutationFn: (interfaces: string[] = []) => apiClient.reconfigure(interfaces),
        onSuccess: (_, variables) => {
            const msg = variables && variables.length > 0
                ? `Reconfigured ${variables.join(', ')} successfully`
                : 'Networkd reconfigured successfully';
            showToast(msg, 'success');
            queryClient.invalidateQueries();
        }
    });

    const [deleteTarget, setDeleteTarget] = useState<{ type: 'netdev' | 'network' | 'link'; filename: string } | null>(null);

    const handleDeleteClick = (type: 'netdev' | 'network' | 'link', filename: string) => {
        setDeleteTarget({ type, filename });
    };

    const handleConfirmDelete = () => {
        if (!deleteTarget) return;

        const { type, filename } = deleteTarget;
        if (type === 'netdev') deleteNetDev.mutate(filename);
        if (type === 'network') deleteNetwork.mutate(filename);
        if (type === 'link') deleteLink.mutate(filename);

        setDeleteTarget(null);
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="flex-row">
                    Configuration
                </h1>
                <div className="flex-row" style={{ gap: '1rem' }}>
                    <button
                        onClick={() => reconfigureMutation.mutate([])}
                        title="Is applies the configuration without restarting networkd, but acts on all interfaces."
                        className="btn-control">
                        <Zap size={18} />
                        Reconfigure
                    </button>
                    <button
                        onClick={() => reloadMutation.mutate()}
                        title="Reloads .network and .netdev files. Does not apply changes to existing links."
                        className="btn-control">
                        <RefreshCw size={18} />
                        Reload
                    </button>
                </div>
            </header>

            <div className="grid-3col">

                {/* Column 1: System Devices & Links */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.5rem' }}>
                        <Activity color="var(--success)" />
                        System Devices
                    </h2>
                    <p className="text-hint" style={{ marginBottom: '1rem' }}>
                        Physical interfaces and .link configurations.
                    </p>

                    <div className="flex-col">
                        {/* Runtime Links */}
                        {links?.map(link => {
                            // Find matching config (heuristic: filename contains interface name)
                            // Ideally backend should provide this association
                            const activeConfig = linkConfigs?.find(c => c.filename.includes(`-${link.name}.link`) || c.filename === `${link.name}.link`);

                            return (
                                <div key={link.index} className="card" style={{
                                    borderLeft: `4px solid ${link.operational_state === 'routable' ? 'var(--success)' : 'var(--border-color)'}`
                                }}>
                                    <div className="flex-row-between">
                                        <h3 style={{ margin: 0 }}>{link.name}</h3>
                                        <div className="flex-row">
                                            <Link
                                                to={activeConfig
                                                    ? `/link/${activeConfig.filename}`
                                                    : `/link/new?match=${link.name}`
                                                }
                                                title={activeConfig ? "Edit Configuration" : "Create Configuration"}
                                            >
                                                <button style={{
                                                    padding: '0.4rem',
                                                    background: activeConfig ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    color: activeConfig ? 'var(--text-primary)' : 'white',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Sliders size={16} />
                                                </button>
                                            </Link>
                                            <button
                                                onClick={() => reconfigureMutation.mutate([link.name])}
                                                title={`Reconfigure ${link.name} only`}
                                                style={{
                                                    padding: '0.4rem',
                                                    background: 'transparent',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                <Zap size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span className="badge">#{link.index}</span>
                                        {link.addresses?.map(addr => <span key={addr} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{addr}</span>)}
                                    </div>
                                    {activeConfig && (
                                        <div style={{ marginTop: '0.8rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Configured by <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{activeConfig.filename}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Unmatched .link Files */}
                        {(linkConfigs ?? []).filter(f => !links?.some(l => f.filename.includes(`-${l.name}.link`) || f.filename === `${l.name}.link`)).length > 0 &&
                            <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Other Link Configurations</h4>}

                        {(linkConfigs ?? []).filter(f => !links?.some(l => f.filename.includes(`-${l.name}.link`) || f.filename === `${l.name}.link`)).map(file => (
                            <div key={file.filename} className="card-dashed flex-row-between">
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{file.filename}</div>
                                    <div className="text-hint">.link config</div>
                                </div>
                                <div className="flex-row">
                                    <button
                                        onClick={() => handleDeleteClick('link', file.filename)}
                                        className="btn-icon"
                                        style={{ opacity: 0.6 }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <Link to={`/link/${file.filename}`}>
                                        <button className="btn-icon-bordered">
                                            <ArrowRight size={14} />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        ))}

                        <Link to="/link/new" style={{ textDecoration: 'none' }}>
                            <button className="btn-add-dashed">
                                <Plus size={16} /> Add .link Configuration
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Column 2: Virtual Devices */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--accent-secondary)', paddingBottom: '0.5rem' }}>
                        <TrainFrontTunnel color="var(--accent-secondary)" />
                        Virtual Devices
                    </h2>
                    <p className="text-hint" style={{ marginBottom: '1rem' }}>
                        Definitions for virtual interfaces (.netdev).
                    </p>
                    <div className="flex-col">
                        {netdevs?.map(file => (
                            <div key={file.filename} className="card" style={{
                                borderLeft: '4px solid var(--accent-secondary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{file.netdev_name || file.filename}</div>
                                    <div className="text-hint">
                                        {file.netdev_kind && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{file.netdev_kind}</span>}
                                        <span style={{ marginLeft: '0.5rem' }}>{file.filename}</span>
                                    </div>
                                </div>
                                <div className="flex-row">
                                    <button
                                        onClick={() => handleDeleteClick('netdev', file.filename)}
                                        className="btn-icon"
                                        style={{ opacity: 0.6 }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <Link to={`/netdev/${file.filename}`}>
                                        <button className="btn-icon-bordered">
                                            <ArrowRight size={14} />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        ))}

                        <Link to="/netdev/new" style={{ textDecoration: 'none' }}>
                            <button className="btn-add-dashed" style={{
                                border: '1px dashed var(--accent-secondary)',
                                background: 'rgba(59, 130, 246, 0.05)',
                                color: 'var(--accent-secondary)'
                            }}>
                                <Plus size={16} /> Add Virtual Device
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Column 3: Networks */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.5rem' }}>
                        <NetworkIcon color="var(--accent-primary)" />
                        Networks
                    </h2>
                    <p className="text-hint" style={{ marginBottom: '1rem' }}>
                        Network connection profiles (.network).
                    </p>
                    <div className="flex-col">
                        {configs?.map(file => (
                            <div key={file.filename} className="card" style={{
                                borderLeft: '4px solid var(--accent-primary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {file.network_match_name ? `Match: ${file.network_match_name}` : file.filename}
                                    </div>
                                    <div className="text-hint">{file.filename}</div>
                                </div>
                                <div className="flex-row">
                                    <button
                                        onClick={() => handleDeleteClick('network', file.filename)}
                                        className="btn-icon"
                                        style={{ opacity: 0.6 }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <Link to={`/network/${file.filename}`}>
                                        <button className="btn-icon-bordered">
                                            <ArrowRight size={14} />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        ))}

                        <Link to="/network/new" style={{ textDecoration: 'none' }}>
                            <button className="btn-add-dashed" style={{
                                border: '1px dashed var(--accent-primary)',
                                background: 'rgba(16, 185, 129, 0.05)',
                                color: 'var(--accent-primary)'
                            }}>
                                <Plus size={16} /> Add Network
                            </button>
                        </Link>
                    </div>
                </div>

            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Delete Configuration"
                message={`Are you sure you want to delete ${deleteTarget?.filename}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default Dashboard;
