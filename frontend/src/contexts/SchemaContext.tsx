import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { processSchema, extractNetdevKinds, type SchemaMap, type NetDevKindInfo } from '../utils/schemaProcessor';
import { useHost } from './HostContext';

interface SchemaContextType {
    networkSections: SchemaMap | null;
    netdevSections: SchemaMap | null;
    linkSections: SchemaMap | null;
    networkdConfSections: SchemaMap | null;
    systemdVersion: string;
    realSystemdVersion: string;
    loading: boolean;
    error: string | null;
    commonNetDevKinds: string[];
    netdevKinds: Record<string, string[]>;
}

const SchemaContext = createContext<SchemaContextType>({
    networkSections: null,
    netdevSections: null,
    linkSections: null,
    networkdConfSections: null,
    systemdVersion: '',
    realSystemdVersion: '',
    loading: true,
    error: null,
    commonNetDevKinds: [],
    netdevKinds: {},
});

export const SchemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [networkSections, setNetworkSections] = useState<SchemaMap | null>(null);
    const [netdevSections, setNetDevSections] = useState<SchemaMap | null>(null);
    const [linkSections, setLinkSections] = useState<SchemaMap | null>(null);
    const [networkdConfSections, setNetworkdConfSections] = useState<SchemaMap | null>(null);
    const [systemdVersion, setSystemdVersion] = useState<string>('');
    const [realSystemdVersion, setRealSystemdVersion] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [kindInfo, setKindInfo] = useState<NetDevKindInfo>({ kindSections: {}, commonKinds: [] });

    const { currentHost } = useHost();

    useEffect(() => {
        const fetchSchemas = async () => {
            setLoading(true);
            try {
                const infoRes = await axios.get('/api/system/status');
                const realVer = infoRes.data.systemd_version || 'unknown';
                const schemaVer = infoRes.data.schema_version || realVer;

                setRealSystemdVersion(realVer);
                setSystemdVersion(schemaVer);

                const schemaRes = await axios.get('/api/schemas');
                const rawSchemas = schemaRes.data;
                const ver = parseVersion(realVer);

                if (rawSchemas.network) {
                    setNetworkSections(processSchema(rawSchemas.network, ver));
                }
                if (rawSchemas.netdev) {
                    setNetDevSections(processSchema(rawSchemas.netdev, ver));
                    setKindInfo(extractNetdevKinds(rawSchemas.netdev));
                }
                if (rawSchemas.link) {
                    setLinkSections(processSchema(rawSchemas.link, ver));
                }
                if (rawSchemas['networkd-conf']) {
                    setNetworkdConfSections(processSchema(rawSchemas['networkd-conf'], ver));
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
            networkdConfSections,
            systemdVersion,
            realSystemdVersion,
            loading,
            error,
            commonNetDevKinds: kindInfo.commonKinds,
            netdevKinds: kindInfo.kindSections
        }}>
            {children}
        </SchemaContext.Provider>
    );
};

export const useSchema = () => useContext(SchemaContext);

function parseVersion(versionStr: string): number | null {
    if (!versionStr) return null;
    const match = versionStr.match(/(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}
