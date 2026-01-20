import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                zIndex: 9999
            }}>
                {toasts.map(toast => (
                    <div key={toast.id} style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        padding: '1rem 1.5rem',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        borderLeft: `4px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--error)' : 'var(--accent-primary)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: '300px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        {toast.type === 'success' && <CheckCircle size={20} color="var(--success)" />}
                        {toast.type === 'error' && <AlertCircle size={20} color="var(--error)" />}
                        {toast.type === 'info' && <Info size={20} color="var(--accent-primary)" />}
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
