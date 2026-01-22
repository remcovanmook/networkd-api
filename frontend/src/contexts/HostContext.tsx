import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient, type HostConfig } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

interface HostContextType {
    currentHost: string;
    hosts: HostConfig[];
    isLoading: boolean;
    error: string | null;
    refreshHosts: () => Promise<void>;
    switchHost: (hostName: string) => void;
    addHost: (host: HostConfig) => Promise<void>;
    removeHost: (name: string) => Promise<void>;
    getSSHKey: () => Promise<string>;
}

const HostContext = createContext<HostContextType | undefined>(undefined);

export const HostProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentHost, setCurrentHost] = useState<string>('');
    const [hosts, setHosts] = useState<HostConfig[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const refreshHosts = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.getHosts();
            // Ensure data is array (backend returns null if empty?)
            setHosts(data || []);
            setError(null);
        } catch (err: any) {
            console.error("Failed to fetch hosts", err);
            setError(err.message || 'Failed to fetch hosts');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshHosts();
    }, []);

    const queryClient = useQueryClient();

    const switchHost = async (hostName: string) => {
        // Validation: check if host exists in list or is empty (local)
        setCurrentHost(hostName);
        apiClient.setHost(hostName);

        // Force a refresh of all data for the new host
        await queryClient.invalidateQueries();
        // Also reset queries to ensure no stale data lingers if keys overlap strangely (though they shouldn't with standard keys)
        // invalidate is usually enough to trigger refetch.
        await queryClient.resetQueries();
    };

    const addHost = async (host: HostConfig) => {
        await apiClient.addHost(host);
        await refreshHosts();
    };

    const removeHost = async (name: string) => {
        await apiClient.removeHost(name);
        if (currentHost === name) {
            switchHost(''); // Revert to local
        }
        await refreshHosts();
    };

    const getSSHKey = async () => {
        return apiClient.getPublicSSHKey();
    };

    return (
        <HostContext.Provider value={{
            currentHost,
            hosts,
            isLoading,
            error,
            refreshHosts,
            switchHost,
            addHost,
            removeHost,
            getSSHKey
        }}>
            {children}
        </HostContext.Provider>
    );
};

export const useHost = () => {
    const context = useContext(HostContext);
    if (!context) {
        throw new Error('useHost must be used within a HostProvider');
    }
    return context;
};
