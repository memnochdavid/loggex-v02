import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './ThemedSelect.module.css';

/**
 * Select estilizado. El dropdown se renderiza vía portal al document.body
 * para escapar de stacking contexts y overflow:hidden de ancestros.
 *
 * Props:
 *   value:       valor actual (string)
 *   onChange:    (newValue) => void
 *   options:     [{ value, label, icon? }, ...]
 *   placeholder: texto cuando no hay valor
 *   minWidth:    ancho mínimo del botón (px, default 200)
 *   placement:   'auto' | 'top' | 'bottom' — controla dirección de apertura (default 'auto')
 */
const ThemedSelect = ({
    value,
    onChange,
    options = [],
    placeholder,
    minWidth = 200,
    ariaLabel,
    disabled = false,
    placement = 'auto',
}) => {
    const { t } = useTranslation();
    const finalPlaceholder = placeholder ?? t('themedSelect.placeholder');
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    const updatePos = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        // Altura estimada del dropdown (máx 360, aprox 38px por opción + padding)
        const estimated = Math.min(360, options.length * 38 + 16);

        let openUp;
        if (placement === 'top') openUp = true;
        else if (placement === 'bottom') openUp = false;
        else openUp = spaceBelow < estimated + 8 && spaceAbove > spaceBelow;

        setPos({
            left: rect.left,
            top: rect.bottom + 4,
            bottom: vh - rect.top + 4,
            width: Math.max(rect.width, minWidth),
            openUp,
            maxHeight: openUp ? Math.max(120, spaceAbove - 16) : Math.max(120, spaceBelow - 16),
        });
    };

    useLayoutEffect(() => {
        if (open) updatePos();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onScroll = (e) => {
            // No cerrar si el scroll ocurre dentro del propio dropdown
            if (dropdownRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onResize = () => updatePos();
        // Usamos capture para detectar scroll de cualquier ancestor
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open]);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (dropdownRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const current = options.find(o => String(o.value) === String(value));

    return (
        <div className={styles.container} style={{ minWidth }}>
            <button
                ref={triggerRef}
                type="button"
                className={`${styles.triggerExtras} ${open ? styles.open : ''}`}
                onClick={() => !disabled && setOpen(v => !v)}
                disabled={disabled}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
            >
                {current?.icon}
                <span className={styles.label}>{current?.label ?? finalPlaceholder}</span>
            </button>

            {open && pos && createPortal(
                <div
                    ref={dropdownRef}
                    className={`${styles.dropdown} ${pos.openUp ? styles.openUp : ''}`}
                    role="listbox"
                    style={{
                        position: 'fixed',
                        left: `${pos.left}px`,
                        top: pos.openUp ? 'auto' : `${pos.top}px`,
                        bottom: pos.openUp ? `${pos.bottom}px` : 'auto',
                        minWidth: `${pos.width}px`,
                        maxHeight: `${pos.maxHeight}px`,
                    }}
                >
                    {options.map(o => {
                        const selected = String(o.value) === String(value);
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`${styles.item} ${selected ? styles.active : ''}`}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                            >
                                {o.icon}
                                <span>{o.label}</span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export default ThemedSelect;
