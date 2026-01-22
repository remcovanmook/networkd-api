import React, { useState, useEffect } from 'react';
import { useHost } from '../contexts/HostContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { HostConfig } from '../api/client';
import { Copy, Plus, Edit2, Trash2, Check, Server as ServerIcon } from 'lucide-react';
import { AddHostWizard } from '../components/AddHostWizard';
import './HostManagementPage.css';

const HostStatusIndicator: React.FC<{ host: HostConfig }> = ({ host }) => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['systemStatus', host.name],
        queryFn: async () => {
            const { default: axios } = await import('axios');
            const res = await axios.get('/api/system/status', {
                headers: { 'X-Target-Host': host.name },
                timeout: 5000
            });
            return res.data;
        },
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: 30000
    });

    if (isLoading) return (
        <span className="status-badge connecting">
            <span className="status-dot connecting" />
            Connecting...
        </span>
    );

    if (isError) return (
        <span className="status-badge offline">
            <span className="status-dot offline" />
            Offline
        </span>
    );

    return (
        <span className="status-badge online">
            <span className="status-dot online" />
            Online
            <span className="host-version">
                {data?.systemd_version || ''}
            </span>
        </span>
    );
};

const HostManagementPage: React.FC = () => {
    const { hosts, addHost, removeHost, getSSHKey } = useHost();
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingHost, setEditingHost] = useState<HostConfig | undefined>(undefined);
    const [sshKey, setSshKey] = useState<string>('');
    const [keyCopied, setKeyCopied] = useState(false);

    const queryClient = useQueryClient();

    useEffect(() => {
        getSSHKey().then(setSshKey).catch(console.error);
    }, [getSSHKey]);

    const copyKey = () => {
        navigator.clipboard.writeText(sshKey);
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
    };

    const handleAdd = () => {
        setEditingHost(undefined);
        setWizardOpen(true);
    };

    const handleEdit = (host: HostConfig) => {
        setEditingHost(host);
        setWizardOpen(true);
    };

    const handleDelete = async (name: string) => {
        if (confirm(`Are you sure you want to remove host "${name}"?`)) {
            await removeHost(name);
        }
    };

    const handleSave = async (host: HostConfig) => {
        if (editingHost && editingHost.name !== host.name) {
            await removeHost(editingHost.name);
        }
        await addHost(host);
        queryClient.invalidateQueries({ queryKey: ['systemStatus', host.name] });
    };

    return (
        <div className="host-management-container">
            <header className="host-header">
                <div>
                    <h1>Host Management</h1>
                    <p>Manage connections to your remote infrastructure</p>
                </div>
                <div className="header-actions">
                    <div
                        className="ssh-key-display"
                        onClick={copyKey}
                        title="Click to copy public key"
                    >
                        <span className="truncate" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sshKey || 'Loading key...'}
                        </span>
                        {keyCopied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                    </div>

                    <button onClick={handleAdd} className="btn-add-host">
                        <Plus size={18} /> Add Host
                    </button>
                </div>
            </header>

            <div className="host-table-container">
                {hosts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <ServerIcon size={40} />
                        </div>
                        <h3>No Remote Hosts Configured</h3>
                        <p>
                            Connect to your remote Linux systems to manage their networks centrally.
                            Ensure you have added the SSH key to the remote host.
                        </p>
                        <button onClick={handleAdd} className="btn-link">
                            Configure new host
                        </button>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="host-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '180px' }}>Status</th>
                                    <th>Name</th>
                                    <th>Connection Details</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hosts.map((host) => (
                                    <tr key={host.name}>
                                        <td>
                                            <HostStatusIndicator host={host} />
                                        </td>
                                        <td>
                                            <div className="host-name">{host.name}</div>
                                        </td>
                                        <td>
                                            <div className="host-connection-host">{host.host}</div>
                                            <div className="host-connection-details">
                                                {host.user} : {host.port}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleEdit(host)}
                                                className="action-btn"
                                                title="Edit configuration"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(host.name)}
                                                className="action-btn delete"
                                                title="Remove host"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AddHostWizard
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
                onSave={handleSave}
                initialData={editingHost}
            />
        </div>
    );
};

export default HostManagementPage;
