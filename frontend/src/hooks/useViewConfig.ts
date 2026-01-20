import { useQuery, useMutation } from '@tanstack/react-query';
import defaultConfig from '../default-schema-config.json';

export interface SectionViewConfig {
    name: string;
    visible?: string[]; // List of visible keys
}

export interface CategoryViewConfig {
    name: string;
    sections: SectionViewConfig[];
}

export interface RootViewConfig {
    network: CategoryViewConfig[];
    netdev: CategoryViewConfig[];
    link: CategoryViewConfig[];
}

export type ViewConfig = RootViewConfig;

const DEFAULT_CONFIG = defaultConfig as RootViewConfig;

export const useViewConfig = () => {
    return useQuery<RootViewConfig>({
        queryKey: ['view-config'],
        queryFn: async () => {
            const res = await fetch('/api/system/view-config');
            if (res.status === 404) {
                return DEFAULT_CONFIG;
            }
            if (!res.ok) {
                throw new Error('Failed to fetch view config');
            }
            const serverConfig = await res.json();
            // Merge with default config to ensure all sections exist (e.g. newly added "link")
            return {
                ...DEFAULT_CONFIG,
                ...serverConfig,
                link: serverConfig.link || DEFAULT_CONFIG.link,
                netdev: serverConfig.netdev || DEFAULT_CONFIG.netdev,
                network: serverConfig.network || DEFAULT_CONFIG.network
            };
        },
        staleTime: 0,
    });
};

export const useSaveViewConfig = () => {
    return useMutation({
        mutationFn: async (config: RootViewConfig) => {
            const res = await fetch('/api/system/view-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to save config');
            }
            return res.json();
        }
    });
};
