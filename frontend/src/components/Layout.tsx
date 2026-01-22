import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Settings, FileCode, Sliders } from 'lucide-react';
import { HostSelector } from './HostSelector';

const Layout: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { label: 'Overview', path: '/', icon: LayoutDashboard },
        { label: 'Configuration', path: '/configuration', icon: Network },
        { label: 'System', path: '/system', icon: Settings },
        { label: 'Preferences', path: '/preferences', icon: Sliders },
        { label: 'API Specs', path: '/api-docs', icon: FileCode },
    ];

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
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Network color="var(--accent-primary)" />
                    <span>NetConfig</span>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <HostSelector />
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
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
            <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
