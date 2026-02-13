import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Settings, FileCode, Server, Monitor } from 'lucide-react';
import { HostSelector } from './HostSelector';
import { useHost } from '../contexts/HostContext';

const Layout: React.FC = () => {
    const location = useLocation();
    const { currentHost } = useHost();

    const navItems = [
        { label: 'Overview', path: '/', icon: LayoutDashboard },
        { label: 'Configuration', path: '/configuration', icon: Network },
        { label: 'System', path: '/system', icon: Settings },
        { label: 'Hosts', path: '/hosts', icon: Server },
        { label: 'API Specs', path: '/api-docs', icon: FileCode },
    ];

    const hostDisplayName = currentHost || 'Local System';
    const isRemote = !!currentHost;

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
            <aside style={{
                width: '250px',
                backgroundColor: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Network color="var(--accent-primary)" />
                    <span>NetConfig</span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'block' }}>
                        Target Host
                    </label>
                    <HostSelector />
                </div>
                <nav className="flex-col-sm" style={{ marginTop: '1rem' }}>
                    {navItems.map((item) => {
                        const isActive = item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                }}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {/* Prominent host banner */}
                <div style={{
                    padding: '0.6rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: isRemote ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isRemote ? 'white' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexShrink: 0,
                }}>
                    <Monitor size={16} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {hostDisplayName}
                    </span>
                    {isRemote && (
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            fontWeight: 500,
                        }}>
                            remote
                        </span>
                    )}
                </div>
                <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
