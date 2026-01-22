import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Save, RefreshCw, Terminal, Activity, FileText, Router as RouterIcon } from 'lucide-react';
import { useToast } from '../components/ToastContext';

import { useHost } from '../contexts/HostContext';
import { useSchema } from '../contexts/SchemaContext';

type Tab = 'config' | 'routes' | 'logs';

const SystemPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const [configContent, setConfigContent] = useState('');
    const { showToast } = useToast();
    const { currentHost } = useHost();
    const { systemdVersion, realSystemdVersion } = useSchema();

    // --- Queries ---

    useQuery({
        queryKey: ['systemConfig', currentHost],
        queryFn: async () => {
            const res = await apiClient.getGlobalConfig();
            setConfigContent(res.content);
            return res;
        },
        refetchOnWindowFocus: false
    });

    const { data: routesData, refetch: refetchRoutes } = useQuery({
        queryKey: ['systemRoutes', currentHost],
        queryFn: apiClient.getRoutes,
        enabled: activeTab === 'routes'
    });

    const { data: logsData } = useQuery({
        queryKey: ['systemLogs', currentHost],
        queryFn: apiClient.getLogs,
        enabled: activeTab === 'logs',
        refetchInterval: activeTab === 'logs' ? 5000 : false // Auto-refresh logs every 5s
    });

    // --- Mutations ---

    const saveMutation = useMutation({
        mutationFn: apiClient.saveGlobalConfig,
        onSuccess: () => showToast('Global configuration saved.', 'success'),
        onError: (err: any) => showToast('Failed to save: ' + err.message, 'error')
    });

    const reloadMutation = useMutation({
        mutationFn: apiClient.reloadNetworkd,
        onSuccess: () => showToast('Reload Successful', 'success'),
        onError: (err: any) => showToast('Reload Failed: ' + err.message, 'error')
    });

    return (
        <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ marginBottom: '0.2rem' }}>System Management</h1>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Systemd: <span style={{ color: 'var(--text-primary)' }}>{realSystemdVersion}</span>
                        {realSystemdVersion !== systemdVersion && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--accent-primary)' }}>
                                (Schema: {systemdVersion})
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => reloadMutation.mutate()}
                    disabled={reloadMutation.isPending}
                    style={{
                        background: 'var(--accent-secondary)', color: 'white',
                        padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <RefreshCw size={18} className={reloadMutation.isPending ? 'spin' : ''} />
                    {reloadMutation.isPending ? 'Reloading...' : 'Reload networkd'}
                </button>
            </header>

            <div style={{ display: 'flex', gap: '2rem' }}>
                {/* Sidebar Tabs */}
                <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                        onClick={() => setActiveTab('config')}
                        style={tabStyle(activeTab === 'config')}
                    >
                        <FileText size={18} /> Global Config
                    </button>
                    <button
                        onClick={() => setActiveTab('routes')}
                        style={tabStyle(activeTab === 'routes')}
                    >
                        <RouterIcon size={18} /> Routing Tables
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        style={tabStyle(activeTab === 'logs')}
                    >
                        <Terminal size={18} /> System Logs
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px', minHeight: '600px' }}>

                    {activeTab === 'config' && (
                        <div>
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                <h2 style={{ margin: 0 }}>networkd.conf</h2>
                                <button
                                    onClick={() => saveMutation.mutate(configContent)}
                                    style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Save size={16} /> Save Changes
                                </button>
                            </div>
                            <textarea
                                value={configContent}
                                onChange={(e) => setConfigContent(e.target.value)}
                                style={{
                                    width: '100%', height: '500px',
                                    background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)', borderRadius: '4px',
                                    padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical'
                                }}
                            />
                            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                Edit the global /etc/systemd/networkd.conf. Reload networkd to apply changes.
                            </p>
                        </div>
                    )}

                    {activeTab === 'routes' && (
                        <div>
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0 }}>Routing Tables & Rules</h2>
                                <button onClick={() => refetchRoutes()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}><RefreshCw size={16} /></button>
                            </div>

                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>IP Routes (Table All)</h3>
                            <pre style={codeBlockStyle}>
                                {routesData?.routes || 'Loading...'}
                            </pre>

                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>IP Rules (Policy Routing)</h3>
                            <pre style={codeBlockStyle}>
                                {routesData?.rules || 'Loading...'}
                            </pre>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div>
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0 }}>Network Logs</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--success)' }}>
                                    <Activity size={14} /> Live (5s poll)
                                </div>
                            </div>
                            <pre style={{ ...codeBlockStyle, height: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
                                {logsData?.logs || 'Loading logs...'}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const tabStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.8rem',
    padding: '1rem', borderRadius: '6px',
    background: isActive ? 'var(--bg-secondary)' : 'transparent',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none', cursor: 'pointer',
    textAlign: 'left', fontWeight: isActive ? 600 : 400
});

const codeBlockStyle: React.CSSProperties = {
    background: '#1a1a1a', color: '#ddd',
    padding: '1rem', borderRadius: '4px',
    fontFamily: 'monospace', fontSize: '0.85rem',
    whiteSpace: 'pre-wrap', overflowX: 'auto'
};

export default SystemPage;
