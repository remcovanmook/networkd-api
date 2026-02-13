import React from 'react';
import { useHost } from '../contexts/HostContext';
import { useLocation } from 'react-router-dom';

export const HostSelector: React.FC = () => {
    const { currentHost, hosts, switchHost } = useHost();
    const location = useLocation();

    const isEditPage = /^\/(network|link|netdev)\/.+/.test(location.pathname);

    return (
        <select
            className="form-input"
            style={{
                width: '100%',
                fontSize: '0.85rem',
                padding: '0.5rem',
                opacity: isEditPage ? 0.5 : 1,
                cursor: isEditPage ? 'not-allowed' : 'pointer',
            }}
            value={currentHost}
            onChange={(e) => switchHost(e.target.value)}
            disabled={isEditPage}
            title={isEditPage ? "Finish editing before switching hosts" : "Switch active host"}
        >
            <option value="">Local System</option>
            {hosts.map(h => (
                <option key={h.name} value={h.name}>{h.name}</option>
            ))}
        </select>
    );
};
