import React from 'react';
import { useHost } from '../contexts/HostContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';

export const HostSelector: React.FC = () => {
    const { currentHost, hosts, switchHost } = useHost();
    const navigate = useNavigate();
    const location = useLocation();

    // Disable on edit pages to prevent state mix-ups
    // Matches /network/..., /link/..., /netdev/... but not if it's just the list (though list is usually covered by dashboard)
    // Actually lists are at /network, /link etc. Edit is /network/:id or /network/new
    // Simple check: if path starts with /network/ etc and has more segments
    const isEditPage = /^\/(network|link|netdev)\/.+/.test(location.pathname);

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${isEditPage ? 'text-gray-400' : 'text-gray-600'}`}>Host:</span>
                <select
                    className={`border rounded p-1 text-sm min-w-[120px] flex-1 ${isEditPage ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'}`}
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
                <button
                    onClick={() => !isEditPage && navigate('/hosts')}
                    className={`p-1 ${isEditPage ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600'}`}
                    title="Manage Hosts"
                    disabled={isEditPage}
                >
                    <Settings size={16} />
                </button>
            </div>
        </div>
    );
};
