import React, { useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import styles from './ThemedNumberInput.module.css';

/**
 * Input numérico con flechas +/− tematizadas (mismas variables CSS que el resto).
 *
 * Props compatibles con <input type="number">:
 *   value, onChange(newValue: string), min, max, step, placeholder, disabled, name,
 *   width (px, default 90), suffix (texto opcional a la derecha, p.ej. "%")
 */
const ThemedNumberInput = ({
    value,
    onChange,
    min,
    max,
    step = 1,
    placeholder,
    disabled = false,
    name,
    width = 90,
    suffix,
    ariaLabel,
    className = '',
}) => {
    const inputRef = useRef(null);

    const clamp = (n) => {
        if (typeof min === 'number' && n < min) return min;
        if (typeof max === 'number' && n > max) return max;
        return n;
    };

    const bump = (dir) => {
        if (disabled) return;
        const current = parseFloat(value);
        const base = isNaN(current) ? (min ?? 0) : current;
        const next = clamp(Math.round((base + dir * step) * 1e6) / 1e6);
        onChange(String(next));
        inputRef.current?.focus();
    };

    return (
        <div className={`${styles.wrap} ${disabled ? styles.disabled : ''} ${className}`} style={{ width }}>
            <input
                ref={inputRef}
                type="number"
                className={styles.input}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                disabled={disabled}
                name={name}
                aria-label={ariaLabel}
            />
            {suffix && <span className={styles.suffix}>{suffix}</span>}
            <div className={styles.spinner}>
                <button
                    type="button"
                    className={styles.spinBtn}
                    onClick={() => bump(+1)}
                    disabled={disabled || (typeof max === 'number' && parseFloat(value) >= max)}
                    tabIndex={-1}
                    aria-label="Incrementar"
                >
                    <ChevronUp size={12} />
                </button>
                <button
                    type="button"
                    className={styles.spinBtn}
                    onClick={() => bump(-1)}
                    disabled={disabled || (typeof min === 'number' && parseFloat(value) <= min)}
                    tabIndex={-1}
                    aria-label="Decrementar"
                >
                    <ChevronDown size={12} />
                </button>
            </div>
        </div>
    );
};

export default ThemedNumberInput;
