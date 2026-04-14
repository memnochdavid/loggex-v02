import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
const ThemedSelect = ({ value, onChange, options = [], placeholder = 'Seleccionar…', minWidth = 200, ariaLabel }) => {
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
                className={`${styles.button} ${open ? styles.open : ''}`}
                onClick={() => setOpen(v => !v)}
                style={{ minWidth }}
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span className={styles.currentSelection}>
                    {current?.icon}
                    <span className={styles.label}>{current?.label ?? placeholder}</span>
                </span>
                <ChevronDown size={14} className={styles.chevron} />
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
