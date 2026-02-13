import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    isDangerous = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            backgroundColor: isDangerous ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
                            padding: '0.5rem',
                            borderRadius: '50%',
                            display: 'flex',
                            color: isDangerous ? 'var(--error, #ef4444)' : 'var(--text-primary)'
                        }}>
                            <AlertTriangle size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="btn-icon"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-secondary" style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    {message}
                </p>

                <div className="modal-footer">
                    <button
                        onClick={onCancel}
                        className="btn-secondary"
                        style={{ borderRadius: '6px', fontSize: '0.9rem', fontWeight: 500 }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={isDangerous ? "btn-danger" : "btn-primary"}
                        style={{ borderRadius: '6px', fontSize: '0.9rem', fontWeight: 500 }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
