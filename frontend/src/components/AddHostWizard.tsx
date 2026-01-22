import React, { useState, useEffect } from 'react';
import { Shield, Server, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import type { HostConfig } from '../api/client';
import './AddHostWizard.css';

interface AddHostWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (host: HostConfig) => Promise<void>;
    initialData?: HostConfig;
}

const STEPS = [
    { id: 1, title: 'Identity', icon: Shield },
    { id: 2, title: 'Connection', icon: Server },
    { id: 3, title: 'Verification', icon: CheckCircle },
];

export const AddHostWizard: React.FC<AddHostWizardProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<HostConfig>({ name: '', host: '', user: 'networkd-api', port: 22 });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setData(initialData);
                setStep(1);
            } else {
                setData({ name: '', host: '', user: 'networkd-api', port: 22 });
                setStep(1);
            }
        }
    }, [isOpen, initialData]);

    const handleNext = () => {
        if (step < 3) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleFinish = async () => {
        await onSave(data);
        onClose();
    };


    if (!isOpen) return null;

    return (
        <div className="wizard-overlay">
            <div className="wizard-modal">
                {/* Header */}
                <div className="wizard-header">
                    <h2>{initialData ? 'Edit Host' : 'Add New Host'}</h2>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>

                {/* Progress */}
                <div className="wizard-progress">
                    <div className="progress-line" />
                    {STEPS.map((s) => {
                        const active = step === s.id;
                        const completed = step > s.id;
                        let circleClass = 'step-circle pending';
                        let labelClass = 'step-label';
                        if (active) {
                            circleClass = 'step-circle active';
                            labelClass = 'step-label active';
                        } else if (completed) {
                            circleClass = 'step-circle completed';
                        }

                        return (
                            <div key={s.id} className="step-item">
                                <div className={circleClass}>
                                    {completed ? <CheckCircle size={16} /> : s.id}
                                </div>
                                <span className={labelClass}>{s.title}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="wizard-content">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="form-group">
                                <label>Friendly Name</label>
                                <input
                                    autoFocus
                                    className="form-input"
                                    placeholder="e.g. Production Gateway"
                                    value={data.name}
                                    onChange={e => setData({ ...data, name: e.target.value })}
                                />
                                <p className="form-hint">A unique identifier for this host.</p>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="grid-cols-3">
                                <div className="col-span-2">
                                    <div className="form-group">
                                        <label>Hostname / IP</label>
                                        <input
                                            autoFocus
                                            className="form-input"
                                            placeholder="10.0.0.5"
                                            value={data.host}
                                            onChange={e => setData({ ...data, host: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="form-group">
                                        <label>Port</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={data.port}
                                            onChange={e => setData({ ...data, port: parseInt(e.target.value) || 22 })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>SSH User</label>
                                <input
                                    className="form-input"
                                    placeholder="networkd-api"
                                    value={data.user}
                                    onChange={e => setData({ ...data, user: e.target.value })}
                                />
                            </div>
                            <div className="info-box">
                                <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                                <p style={{ margin: 0 }}>Ensure the backend's public key is added to <code>~/.ssh/authorized_keys</code> on the remote host.</p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="verify-box">
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#111827' }}>{data.name}</h3>
                            <p style={{ margin: 0, color: '#6b7280', fontFamily: 'monospace' }}>{data.user}@{data.host}:{data.port}</p>
                            <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                Ready to save. You can verify the connection in the table after saving.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="wizard-footer">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className="btn-back"
                    >
                        Back
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            disabled={!data.name || (step === 2 && !data.host)}
                            className="btn-next"
                        >
                            Next <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            className="btn-finish"
                        >
                            Finish & Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
