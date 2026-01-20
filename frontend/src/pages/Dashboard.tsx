import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

import { FileText, Activity, ArrowRight, Network as NetworkIcon, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    // 1. Virtual Devices (.netdev) - Definitions
    const { data: netdevs } = useQuery({
        queryKey: ['netdevs'],
        queryFn: apiClient.getNetDevs
    });

    // 2. System Interfaces (Runtime Links) - Active State
    const { data: links } = useQuery({
        queryKey: ['interfaces'],
        queryFn: apiClient.getInterfaces
    });

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

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: "0.5rem" }}>
                    Configuration
                </h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/link/new">
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>
                            <FileText size={18} />
                            Add .link
                        </button>
                    </Link>
                    <Link to="/netdev/new">
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-secondary)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                            <Activity size={18} />
                            Add NetDev
                        </button>
                    </Link>
                    <Link to="/network/new">
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                            <NetworkIcon size={18} />
                            Add Network
                        </button>
                    </Link>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>

                {/* Column 1: System Devices & Links */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.5rem' }}>
                        <Activity color="var(--success)" />
                        System Devices
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Physical interfaces and .link configurations.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Runtime Links */}
                        {links?.map(link => {
                            // Find matching config (heuristic: filename contains interface name)
                            // Ideally backend should provide this association
                            const activeConfig = linkConfigs?.find(c => c.filename.includes(`-${link.name}.link`) || c.filename === `${link.name}.link`);

                            return (
                                <div key={link.index} style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    borderLeft: `4px solid ${link.operational_state === 'routable' ? 'var(--success)' : 'var(--border-color)'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0 }}>{link.name}</h3>
                                        <Link
                                            to={activeConfig
                                                ? `/link/${activeConfig.filename}`
                                                : `/link/new?match=${link.name}`
                                            }
                                            title={activeConfig ? "Edit Configuration" : "Create Configuration"}
                                        >
                                            <button style={{
                                                padding: '0.4rem 0.8rem',
                                                background: activeConfig ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                color: activeConfig ? 'var(--text-primary)' : 'white',
                                                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'
                                            }}>
                                                <Sliders size={16} /> {activeConfig ? 'Configure' : 'Configure'}
                                            </button>
                                        </Link>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            opacity: 0.7,
                                            background: 'var(--bg-tertiary)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                        }}>#{link.index}</span>
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
                            <div key={file.filename} style={{
                                background: 'var(--bg-secondary)',
                                padding: '0.8rem 1rem',
                                borderRadius: '8px',
                                border: '1px dashed var(--border-color)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{file.filename}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>.link config</div>
                                </div>
                                <Link to={`/link/${file.filename}`}>
                                    <button style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
                                        <ArrowRight size={14} />
                                    </button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 2: Virtual Devices */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--accent-secondary)', paddingBottom: '0.5rem' }}>
                        <Activity color="var(--accent-secondary)" />
                        Virtual Devices
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Definitions for virtual interfaces (.netdev).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {netdevs?.map(file => (
                            <div key={file.filename} style={{
                                background: 'var(--bg-secondary)',
                                padding: '1rem',
                                borderRadius: '8px',
                                borderLeft: '4px solid var(--accent-secondary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{file.netdev_name || file.filename}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {file.netdev_kind && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{file.netdev_kind}</span>}
                                        <span style={{ marginLeft: '0.5rem' }}>{file.filename}</span>
                                    </div>
                                </div>
                                <Link to={`/netdev/${file.filename}`}>
                                    <button style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
                                        <ArrowRight size={14} />
                                    </button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 3: Networks */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.5rem' }}>
                        <NetworkIcon color="var(--accent-primary)" />
                        Networks
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Network connection profiles (.network).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {configs?.map(file => (
                            <div key={file.filename} style={{
                                background: 'var(--bg-secondary)',
                                padding: '1rem',
                                borderRadius: '8px',
                                borderLeft: '4px solid var(--accent-primary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {file.network_match_name ? `Match: ${file.network_match_name}` : file.filename}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{file.filename}</div>
                                </div>
                                <Link to={`/network/${file.filename}`}>
                                    <button style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
                                        <ArrowRight size={14} />
                                    </button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
