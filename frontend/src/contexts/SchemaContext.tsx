import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { processSchema, type SchemaMap, COMMON_NETDEV_KINDS, NETDEV_KINDS } from '../utils/schemaProcessor';
import { useHost } from './HostContext';

interface SchemaContextType {
    networkSections: SchemaMap | null;
    netdevSections: SchemaMap | null;
    linkSections: SchemaMap | null;
    systemdVersion: string;
    loading: boolean;
    error: string | null;
    commonNetDevKinds: string[];
    netdevKinds: Record<string, string[]>;
}

const SchemaContext = createContext<SchemaContextType>({
    networkSections: null,
    netdevSections: null,
    linkSections: null,
    systemdVersion: '',
    loading: true,
    error: null,
    commonNetDevKinds: COMMON_NETDEV_KINDS,
    netdevKinds: NETDEV_KINDS,
});

export const SchemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [networkSections, setNetworkSections] = useState<SchemaMap | null>(null);
    const [netdevSections, setNetDevSections] = useState<SchemaMap | null>(null);
    const [linkSections, setLinkSections] = useState<SchemaMap | null>(null);
    const [systemdVersion, setSystemdVersion] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { currentHost } = useHost(); // Added useHost call

    useEffect(() => {
        const fetchSchemas = async () => {
            setLoading(true); // Set loading to true at the start of fetch
            try {
                // Get Version
                const infoRes = await axios.get('/api/system/status');
                setSystemdVersion(infoRes.data.systemd_version || 'unknown');

                // Get Schemas
                const schemaRes = await axios.get('/api/schemas');
                const rawSchemas = schemaRes.data; // Expects { network: {}, netdev: {}, link: {} }

                if (rawSchemas.network) {
                    setNetworkSections(processSchema(rawSchemas.network));
                }
                if (rawSchemas.netdev) {
                    setNetDevSections(processSchema(rawSchemas.netdev));
                }
                if (rawSchemas.link) {
                    setLinkSections(processSchema(rawSchemas.link));
                }
                setError(null); // Clear any previous errors on successful fetch
            } catch (err: any) {
                console.error("Failed to load schemas", err);
                setError(err.message || 'Failed to load configuration schemas');
                // Keep networkSections, netdevSections, linkSections as null or previous state on error
            } finally {
                setLoading(false); // Set loading to false in finally block
            }
        };

        fetchSchemas();
    }, [currentHost]); // Added currentHost to dependency array

    return (
        <SchemaContext.Provider value={{
            networkSections,
            netdevSections,
            linkSections,
            systemdVersion,
            loading,
            error,
            commonNetDevKinds: COMMON_NETDEV_KINDS,
            netdevKinds: NETDEV_KINDS
        }}>
            {children}
        </SchemaContext.Provider>
    );
};

export const useSchema = () => useContext(SchemaContext);
