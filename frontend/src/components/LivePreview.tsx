import React, { useMemo } from 'react';
import { generateINI } from '../utils/configGenerator';
import { FileText } from 'lucide-react';
import type { ConfigOption } from '../utils/schemaProcessor';

interface LivePreviewProps {
    type: 'network' | 'netdev' | 'link';
    config: any;
    sections: Record<string, { options: ConfigOption[], name?: string }>;
    visible?: boolean;
    style?: React.CSSProperties;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ type, config, sections, visible = true, style }) => {

    const content = useMemo(() => {
        try {
            return generateINI(config, sections);
        } catch (e) {
            console.error("Preview Generation Error", e);
            return "Error generating preview";
        }
    }, [config, sections]);

    if (!visible) return null;

    return (
        <div style={{
            background: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border-color)', // Changed to borderTop as it's likely a footer
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...style
        }}>
            <div style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-secondary)', // Slightly darker header
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <FileText size={14} /> Live Preview ({type})
                </div>
            </div>

            <div style={{
                flex: 1,
                overflow: 'auto', // Enable scrolling for content
                position: 'relative',
                background: 'var(--bg-primary)' // Contrast for code background
            }}>
                <pre style={{
                    margin: 0,
                    padding: '1rem', // Reduced padding
                    overflowX: 'hidden', // Wrap text usually better for previews unless very wide
                    whiteSpace: 'pre-wrap', // Wrap long lines
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)'
                }}>
                    {content}
                </pre>
            </div>
        </div>
    );
};
