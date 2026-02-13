import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { RefreshCw, Terminal, Activity, FileText, Router as RouterIcon } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { useHost } from '../contexts/HostContext';
import { useSchema } from '../contexts/SchemaContext';
import ConfigEditor from './ConfigEditor';

type Tab = 'config' | 'routes' | 'logs';

const SystemPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const { showToast } = useToast();
    const { currentHost } = useHost();
    const { systemdVersion, realSystemdVersion } = useSchema();

    const { data: routesData, refetch: refetchRoutes } = useQuery({
        queryKey: ['systemRoutes', currentHost],
        queryFn: apiClient.getRoutes,
        enabled: activeTab === 'routes'
    });

    const { data: logsData } = useQuery({
        queryKey: ['systemLogs', currentHost],
        queryFn: apiClient.getLogs,
        enabled: activeTab === 'logs',
        refetchInterval: activeTab === 'logs' ? 5000 : false
    });

    const reloadMutation = useMutation({
        mutationFn: apiClient.reloadNetworkd,
        onSuccess: () => showToast('Reload Successful', 'success'),
        onError: (err: any) => showToast('Reload Failed: ' + err.message, 'error')
    });

    return (
        <div>
            <header className="page-header">
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
                    className="btn-primary"
                    style={{ background: 'var(--accent-secondary)' }}
                >
                    <RefreshCw size={18} className={reloadMutation.isPending ? 'spin' : ''} />
                    {reloadMutation.isPending ? 'Reloading...' : 'Reload networkd'}
                </button>
            </header>

            <div className="flex-row" style={{ gap: '2rem', alignItems: 'flex-start' }}>
                <div className="sidebar" style={{ width: '200px' }}>
                    <button onClick={() => setActiveTab('config')} style={tabStyle(activeTab === 'config')}>
                        <FileText size={18} /> Global Config
                    </button>
                    <button onClick={() => setActiveTab('routes')} style={tabStyle(activeTab === 'routes')}>
                        <RouterIcon size={18} /> Routing Tables
                    </button>
                    <button onClick={() => setActiveTab('logs')} style={tabStyle(activeTab === 'logs')}>
                        <Terminal size={18} /> System Logs
                    </button>
                </div>

                <div className="form-section" style={{ minHeight: '600px' }}>
                    {activeTab === 'config' && (
                        <ConfigEditor configType="networkd-conf" inline />
                    )}

                    {activeTab === 'routes' && (
                        <div>
                            <div className="flex-row-between" style={{ marginBottom: '1rem' }}>
                                <h2 style={{ margin: 0 }}>Routing Tables & Rules</h2>
                                <button onClick={() => refetchRoutes()} className="btn-icon" style={{ color: 'var(--accent-primary)' }}><RefreshCw size={16} /></button>
                            </div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>IP Routes (Table All)</h3>
                            <pre style={codeBlockStyle}>{routesData?.routes || 'Loading...'}</pre>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>IP Rules (Policy Routing)</h3>
                            <pre style={codeBlockStyle}>{routesData?.rules || 'Loading...'}</pre>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div>
                            <div className="flex-row-between" style={{ marginBottom: '1rem' }}>
                                <h2 style={{ margin: 0 }}>Network Logs</h2>
                                <div className="flex-row" style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
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
