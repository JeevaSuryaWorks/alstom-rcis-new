'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom Select dropdown — replaces native <select>.
 *
 * Props:
 *   options: string[] | { value: string, label: string }[]
 *   value: string
 *   onChange: (value: string) => void
 *   placeholder?: string
 *   disabled?: boolean
 *   name?: string
 */
export default function CustomSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Select...',
    disabled = false,
    name,
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Normalize options to { value, label }
    const normalizedOptions = options.map((o) =>
        typeof o === 'string' ? { value: o, label: o } : o
    );

    const selectedLabel = normalizedOptions.find((o) => o.value === value)?.label || '';

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const handleSelect = useCallback((val) => {
        onChange(val);
        setOpen(false);
    }, [onChange]);

    return (
        <div className={`cselect ${open ? 'cselect-open' : ''} ${disabled ? 'cselect-disabled' : ''}`} ref={ref}>
            <button
                type="button"
                className="cselect-trigger"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={selectedLabel ? 'cselect-value' : 'cselect-placeholder'}>
                    {selectedLabel || placeholder}
                </span>
                <span className="cselect-arrow">{open ? '▴' : '▾'}</span>
            </button>

            {open && (
                <div className="cselect-dropdown" role="listbox">
                    {/* Empty / reset option */}
                    {placeholder && (
                        <div
                            className={`cselect-option cselect-option-placeholder ${value === '' ? 'cselect-option-active' : ''}`}
                            onClick={() => handleSelect('')}
                            role="option"
                            aria-selected={value === ''}
                        >
                            {placeholder}
                        </div>
                    )}
                    {normalizedOptions.map((o) => (
                        <div
                            key={o.value}
                            className={`cselect-option ${value === o.value ? 'cselect-option-active' : ''}`}
                            onClick={() => handleSelect(o.value)}
                            role="option"
                            aria-selected={value === o.value}
                        >
                            {o.label}
                            {value === o.value && <span className="cselect-check">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
