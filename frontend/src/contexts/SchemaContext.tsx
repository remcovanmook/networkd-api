import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { processSchema, type SchemaMap, COMMON_NETDEV_KINDS, NETDEV_KINDS } from '../utils/schemaProcessor';
import { useHost } from './HostContext';

interface SchemaContextType {
    networkSections: SchemaMap | null;
    netdevSections: SchemaMap | null;
    linkSections: SchemaMap | null;
    systemdVersion: string; // Internal Logic Version (Schema Version)
    realSystemdVersion: string; // Display Version (Actual Host Version)
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
    realSystemdVersion: '',
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
    const [realSystemdVersion, setRealSystemdVersion] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { currentHost } = useHost();

    useEffect(() => {
        const fetchSchemas = async () => {
            setLoading(true);
            try {
                // Get Version
                const infoRes = await axios.get('/api/system/status');
                const realVer = infoRes.data.systemd_version || 'unknown';
                const schemaVer = infoRes.data.schema_version || realVer; // Fallback to real if missing

                setRealSystemdVersion(realVer);
                setSystemdVersion(schemaVer); // Logic uses schema version

                // Get Schemas
                const schemaRes = await axios.get('/api/schemas');
                const rawSchemas = schemaRes.data;

                if (rawSchemas.network) {
                    setNetworkSections(processSchema(rawSchemas.network));
                }
                if (rawSchemas.netdev) {
                    setNetDevSections(processSchema(rawSchemas.netdev));
                }
                if (rawSchemas.link) {
                    setLinkSections(processSchema(rawSchemas.link));
                }
                setError(null);
            } catch (err: any) {
                console.error("Failed to load schemas", err);
                setError(err.message || 'Failed to load configuration schemas');
            } finally {
                setLoading(false);
            }
        };

        fetchSchemas();
    }, [currentHost]);

    return (
        <SchemaContext.Provider value={{
            networkSections,
            netdevSections,
            linkSections,
            systemdVersion,
            realSystemdVersion,
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
