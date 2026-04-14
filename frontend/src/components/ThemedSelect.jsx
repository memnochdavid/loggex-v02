import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ThemedSelect.module.css';

/**
 * Select estilizado con el mismo patrón visual que el LanguageSelector del header
 * pero con colores del tema del centro. Reutilizable.
 *
 * Props:
 *   value:    valor actual (string)
 *   onChange: (newValue) => void
 *   options:  [{ value, label, icon? }, ...]
 *   placeholder: texto cuando no hay valor
 *   minWidth: ancho mínimo del botón (px, default 200)
 */
const ThemedSelect = ({ value, onChange, options = [], placeholder, minWidth = 200, ariaLabel, disabled = false }) => {
    const { t } = useTranslation();
    const finalPlaceholder = placeholder ?? t('themedSelect.placeholder');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const current = options.find(o => String(o.value) === String(value));

    return (
        <div className={styles.container} ref={ref}>
            <button
                type="button"
                className={`${styles.triggerExtras} ${open ? styles.open : ''}`}
                onClick={() => !disabled && setOpen(v => !v)}
                disabled={disabled}
                style={{ minWidth }}
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                {current?.icon}
                <span className={styles.label}>{current?.label ?? finalPlaceholder}</span>
            </button>

            {open && (
                <div className={styles.dropdown} style={{ minWidth }}>
                    {options.map(o => (
                        <button
                            key={o.value}
                            type="button"
                            className={`${styles.item} ${String(o.value) === String(value) ? styles.active : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.icon}
                            <span>{o.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ThemedSelect;
