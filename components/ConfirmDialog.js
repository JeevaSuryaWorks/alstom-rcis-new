'use client';

import { useState, useCallback } from 'react';

/**
 * Custom Confirm Dialog — replaces browser's native confirm().
 *
 * Usage with the useConfirm hook:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const ok = await confirm({ title: 'Delete?', message: 'This cannot be undone', type: 'danger' });
 *   if (!ok) return;
 *   // ... in JSX: <ConfirmDialog />
 */

export function ConfirmDialog({ state, onConfirm, onCancel }) {
    if (!state) return null;

    const typeStyles = {
        danger: { icon: '🗑️', accent: '#ef4444', btnClass: 'confirm-btn-danger' },
        warning: { icon: '⚠️', accent: '#f59e0b', btnClass: 'confirm-btn-warning' },
        info: { icon: 'ℹ️', accent: '#3b82f6', btnClass: 'confirm-btn-info' },
    };

    const t = typeStyles[state.type] || typeStyles.info;

    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-icon" style={{ background: `${t.accent}18`, color: t.accent }}>
                    {t.icon}
                </div>
                <h4 className="confirm-title">{state.title || 'Confirm'}</h4>
                <p className="confirm-message">{state.message || 'Are you sure?'}</p>
                <div className="confirm-actions">
                    <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className={`confirm-btn ${t.btnClass}`} onClick={onConfirm} autoFocus>
                        {state.confirmText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Hook: useConfirm()
 *
 * Returns { confirm, ConfirmDialogEl }
 * - confirm(opts) => Promise<boolean>
 * - ConfirmDialogEl: JSX element to render in your component
 */
export function useConfirm() {
    const [state, setState] = useState(null);
    const [resolver, setResolver] = useState(null);

    const confirm = useCallback((opts = {}) => {
        return new Promise((resolve) => {
            setState(opts);
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        resolver?.(true);
        setState(null);
        setResolver(null);
    }, [resolver]);

    const handleCancel = useCallback(() => {
        resolver?.(false);
        setState(null);
        setResolver(null);
    }, [resolver]);

    const ConfirmDialogEl = (
        <ConfirmDialog state={state} onConfirm={handleConfirm} onCancel={handleCancel} />
    );

    return { confirm, ConfirmDialog: ConfirmDialogEl };
}
