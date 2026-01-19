import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InterfaceFile, Link as LinkInterface } from '../api/client';
import { FileText, Activity, ArrowRight, Network as NetworkIcon } from 'lucide-react';
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

    const summaryGroups = useMemo(() => {
        const groups: Record<string, { netdev?: InterfaceFile, network?: InterfaceFile, link?: LinkInterface }> = {};

        // Index NetDevs
        netdevs?.forEach(f => {
            const name = f.netdev_name || f.filename.replace('.netdev', '');
            if (!groups[name]) groups[name] = {};
            groups[name].netdev = f;
        });

        // Index Network Configs
        configs?.forEach(f => {
            let name = f.network_match_name;
            if (!name) {
                name = f.filename.replace(/^\d+-/, '').replace('.network', '');
            }
            if (!groups[name]) groups[name] = {};
            groups[name].network = f;
        });

        // Index Runtime Links
        links?.forEach(l => {
            if (!groups[l.name]) groups[l.name] = {};
            groups[l.name].link = l;
        });

        return groups;
    }, [netdevs, configs, links]);

    return (
        <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Network Overview</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/interfaces/new?mode=virtual">
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-secondary)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                            <Activity size={18} />
                            Add Virtual Device
                        </button>
                    </Link>
                    <Link to="/interfaces/new?mode=physical">
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                            <FileText size={18} />
                            Add Network Config
                        </button>
                    </Link>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Left Column: System Interfaces (Runtime Links) */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <NetworkIcon color="var(--success)" />
                        System Interfaces
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Live operating system interfaces and status.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {links?.map(link => (
                            <div key={link.index} style={{
                                background: 'var(--bg-secondary)',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: link.network_file ? '1px solid var(--success)' : '1px solid var(--border-color)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>{link.name}</h3>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Index: {link.index}</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    State: <span style={{ color: link.operational_state === 'routable' ? 'var(--success)' : 'var(--text-primary)' }}>{link.operational_state}</span>
                                </div>
                                {link.addresses && link.addresses.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>IP Addresses:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {link.addresses.map(addr => (
                                                <span key={addr} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                                    {addr}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {link.network_file ? (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        Managed by: <Link to={`/interfaces/${link.network_file}`} style={{ color: 'var(--accent-primary)' }}>{link.network_file}</Link>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '1rem' }}>
                                        <Link to={`/interfaces/new?mode=physical&match=${link.name}`}>
                                            <button style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '4px', cursor: 'pointer' }}>
                                                Configure Network
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Configuration Definitions */}
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText color="var(--accent-primary)" />
                        Configuration
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Virtual device definitions and network profiles.</p>

                    {/* Section: Virtual NetDevs */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Virtual Devices (NetDevs)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            {netdevs?.map(file => (
                                <div key={file.filename} style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    borderLeft: '4px solid var(--accent-secondary)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{file.netdev_name || file.filename}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {file.filename}
                                            {file.netdev_kind && <span style={{ marginLeft: '0.5rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{file.netdev_kind}</span>}
                                        </div>
                                    </div>
                                    <Link to={`/interfaces/${file.filename}`}>
                                        <button style={{ padding: '0.4rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
                                            <ArrowRight size={16} />
                                        </button>
                                    </Link>
                                </div>
                            ))}
                            {(!netdevs || netdevs.length === 0) && <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No virtual devices defined.</div>}
                        </div>
                    </div>

                    {/* Section: Network Profiles */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Network Profiles</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            {configs?.map(file => (
                                <div key={file.filename} style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <FileText size={20} color="var(--text-secondary)" />
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                {file.network_match_name ? `Match: ${file.network_match_name}` : file.filename}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {file.filename}
                                            </div>
                                        </div>
                                    </div>
                                    <Link to={`/networks/${file.filename}`}>
                                        <button style={{ padding: '0.4rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
                                            <ArrowRight size={16} />
                                        </button>
                                    </Link>
                                </div>
                            ))}
                            {(!configs || configs.length === 0) && <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No network profiles found.</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Summary - Unchanged logic essentially */}
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                <h2>Configuration Summary</h2>
                <div style={{ display: 'grid', gap: '1rem', color: 'var(--text-secondary)' }}>
                    {Object.entries(summaryGroups).map(([name, group]) => {
                        const sentences: string[] = [];
                        const { netdev, network, link } = group;

                        if (link) {
                            if (netdev) {
                                sentences.push(`${name} is a active ${netdev.netdev_kind || 'virtual'} device.`);
                            } else {
                                sentences.push(`${name} is a system interface.`);
                            }
                            if (link.operational_state) sentences.push(`Status: ${link.operational_state}.`);
                        } else if (netdev) {
                            sentences.push(`${name} is a ${netdev.netdev_kind || 'virtual'} device definition (inactive).`);
                        }

                        if (netdev && netdev.summary?.vlan_id) sentences.push(`VLAN ID: ${netdev.summary.vlan_id}.`);

                        if (network && network.summary) {
                            const s = network.summary;
                            if (s.dhcp === 'yes') sentences.push(`Configured via DHCP.`);
                            if (s.address?.length) sentences.push(`Static IP(s): ${s.address.join(', ')}.`);
                            if (s.vlan?.length) sentences.push(`Attached VLANs: ${s.vlan.join(', ')}.`);
                        } else if (link && !network) {
                            sentences.push(`Unmanaged or manual configuration.`);
                        }
                        if (sentences.length === 0) return null;
                        return (
                            <div key={`summary-${name}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', minWidth: '120px' }}>{name}:</span>
                                <span>{sentences.join(' ')}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
