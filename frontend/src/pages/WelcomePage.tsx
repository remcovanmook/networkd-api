import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Server, Activity, Router, Info } from 'lucide-react';

const WelcomePage: React.FC = () => {
    // We can reuse getRoutes and generic config for some status
    // But we might need a specific 'system status' endpoint.
    // For now we'll use what we have and maybe infer some things.

    // Using getRoutes to show routing table summary?
    // Using getInterfaces for operational state summary?

    const { data: systemStatus } = useQuery({
        queryKey: ['systemStatus'],
        queryFn: apiClient.getSystemStatus
    });
    const links = systemStatus?.interfaces;

    const { data: routes } = useQuery({
        queryKey: ['routes'],
        queryFn: apiClient.getRoutes
    });

    // Mocking some version info if not available in API yet
    // Or we could add a `getSystemInfo` to client if backend supported it.
    // For now, hardcode frontend version, maybe show backend version if we knew it.
    const systemInfo = {
        frontendVersion: '0.1.0',
        backendVersion: '0.1.0', // Placeholder
        systemdVersion: systemStatus?.systemd_version || 'Loading...'
    };

    const activeLinks = links?.filter(l => l.operational_state === 'routable' || l.operational_state === 'degraded').length || 0;
    const totalLinks = links?.length || 0;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <Server size={48} color="var(--accent-primary)" />
                    Networkd Manager
                </h1>
                <p style={{ fontSize: '1.2rem' }} className="text-secondary">
                    Systemd-networkd configuration and management interface.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>

                {/* System Status Card */}
                <div className="card-elevated">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: 0 }}>
                        <Activity color="var(--success)" />
                        System Status
                    </h2>
                    <div className="flex-col" style={{ gap: '0.8rem', marginTop: '1rem' }}>
                        <div className="flex-row-between">
                            <span className="text-secondary">Active Interfaces</span>
                            <span style={{ fontWeight: 'bold' }}>{activeLinks} <span className="text-secondary" style={{ fontWeight: 'normal' }}>/ {totalLinks}</span></span>
                        </div>
                        <div className="flex-row-between">
                            <span className="text-secondary">Systemd Version</span>
                            <span className="text-mono">v{systemInfo.systemdVersion}</span>
                        </div>
                        <div className="flex-row-between">
                            <span className="text-secondary">Backend API</span>
                            <span className="text-mono">v{systemInfo.backendVersion}</span>
                        </div>
                    </div>
                </div>

                {/* Routing Summary Card */}
                <div className="card-elevated">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: 0 }}>
                        <Router color="var(--accent-secondary)" />
                        Routing & Addressing
                    </h2>
                    <div style={{ fontSize: '0.9rem', marginTop: '1rem', lineHeight: '1.5' }} className="text-secondary">
                        <p>
                            Managed by <strong>systemd-networkd</strong>.
                        </p>
                        {routes && (
                            <div style={{ marginTop: '1rem', background: 'var(--bg-tertiary)', padding: '0.8rem', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {routes.routes}
                            </div>
                        )}
                        {!routes && <p>Loading route table...</p>}
                    </div>
                </div>
            </div>

            <div className="card-elevated" style={{ padding: '2rem', textAlign: 'center' }}>
                <Info size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3>About This Interface</h3>
                <p className="text-secondary" style={{ maxWidth: '600px', margin: '0.5rem auto 0', lineHeight: '1.6' }}>
                    This frontend allows you to manage physical and virtual network interfaces, configure network profiles (`.network`),
                    and define virtual devices (`.netdev`). Changes are applied to `/etc/systemd/network`.
                </p>
                <div className="text-secondary" style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
                    Frontend Version: {systemInfo.frontendVersion}
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;
