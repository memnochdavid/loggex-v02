import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2 } from 'lucide-react';
import styles from './AsyncSearchSelect.module.css';

/**
 * Select con búsqueda en servidor para listas potencialmente grandes.
 *
 * Pensado para sustituir <select> nativos en modales CRUD cuando la
 * colección puede crecer sin límite (alumnos, profesores, grupos…).
 * Va siempre acompañado del filtro backend `?q=` (SearchAnyFilter).
 *
 * Props:
 *   value            valor actual (string|number) — id o IRI del elemento seleccionado
 *   onChange         (newValue) => void
 *   endpoint         URL relativa o absoluta del recurso (p. ej. '/api/users')
 *   extraParams      objeto con query params fijos (p. ej. { rol_app: 'alumno' })
 *   getOptionLabel   (item) => string — cómo mostrar cada opción
 *   getOptionValue   (item) => string — cómo extraer el value de cada opción
 *                                       (default: item.id)
 *   placeholder      texto cuando no hay valor seleccionado
 *   minQueryLength   nº de caracteres antes de buscar (default 0 → busca también
 *                    al abrir, mostrando los primeros itemsPerPage resultados)
 *   itemsPerPage     tamaño de página devuelto por la API (default 20)
 *   disabled         deshabilita el control
 *   required         marca el input como required (para validación de form)
 *   name             atributo name (para validación nativa de formularios)
 */
const AsyncSearchSelect = ({
    value,
    onChange,
    endpoint,
    extraParams = {},
    getOptionLabel = (item) => item.label ?? String(item.id),
    getOptionValue = (item) => item.id,
    placeholder,
    minQueryLength = 0,
    itemsPerPage = 20,
    disabled = false,
    required = false,
    name,
    ariaLabel,
    minWidth = 200,
    placement = 'auto',
}) => {
    const { t } = useTranslation();
    const finalPlaceholder = placeholder ?? t('asyncSelect.placeholder', { defaultValue: 'Buscar…' });

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [selectedItem, setSelectedItem] = useState(null);

    const triggerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    // Construye la URL completa con extraParams + q + itemsPerPage
    const buildUrl = useCallback((q) => {
        const url = new URL(endpoint, window.location.origin);
        Object.entries(extraParams).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') return;
            // Soporte para arrays (?etapa[]=a&etapa[]=b) — útil para filtros con
            // múltiples valores válidos como "etapa de FP, cualquier nivel".
            if (Array.isArray(v)) {
                v.forEach(val => {
                    if (val !== null && val !== undefined && val !== '') {
                        url.searchParams.append(`${k}[]`, String(val));
                    }
                });
            } else {
                url.searchParams.set(k, v);
            }
        });
        if (q) url.searchParams.set('q', q);
        url.searchParams.set('itemsPerPage', String(itemsPerPage));
        return url.toString();
    }, [endpoint, extraParams, itemsPerPage]);

    // Hidrata la etiqueta del valor inicial: si recibimos value pero no tenemos
    // selectedItem, hacemos un fetch puntual para mostrar su label.
    useEffect(() => {
        if (!value) {
            setSelectedItem(null);
            return;
        }
        // Si ya tenemos el item sincronizado con el value, no hacer nada
        if (selectedItem && String(getOptionValue(selectedItem)) === String(value)) return;

        // Si el value es una IRI tipo "/api/users/78", hacer GET directo
        const isIri = typeof value === 'string' && value.startsWith('/api/');
        const idOnly = isIri ? value.split('/').pop() : value;
        const baseUrl = isIri ? value : `${endpoint}/${idOnly}`;

        let cancelled = false;
        fetch(new URL(baseUrl, window.location.origin).toString(), {
            credentials: 'include',
            headers: { Accept: 'application/ld+json' },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!cancelled && data) setSelectedItem(data);
            })
            .catch(() => { /* silencioso: el label seguirá vacío hasta que el user busque */ });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, endpoint]);

    // Fetch con debounce cada vez que cambia la query (o al abrir)
    useEffect(() => {
        if (!open) return;
        if (query.length < minQueryLength) {
            setResults([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (abortRef.current) abortRef.current.abort();
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            setLoading(true);
            fetch(buildUrl(query.trim()), {
                credentials: 'include',
                headers: { Accept: 'application/ld+json' },
                signal: ctrl.signal,
            })
                .then(r => r.json())
                .then(data => {
                    const items = data['hydra:member'] || data.member || [];
                    setResults(items);
                    setHighlightIdx(0);
                })
                .catch((e) => {
                    if (e.name !== 'AbortError') console.error('AsyncSearchSelect fetch error:', e);
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query, open, minQueryLength, buildUrl]);

    // ----- posicionamiento del dropdown -----
    const updatePos = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        const estimated = Math.min(360, results.length * 38 + 60);

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
            maxHeight: openUp ? Math.max(160, spaceAbove - 16) : Math.max(160, spaceBelow - 16),
        });
    };

    useLayoutEffect(() => {
        if (open) updatePos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, results.length]);

    useEffect(() => {
        if (!open) return;
        const onScroll = (e) => {
            if (dropdownRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onResize = () => updatePos();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Foco al input cuando el dropdown está realmente montado (open + pos calculados).
    // Hacerlo en handleOpen falla porque pos lo calcula useLayoutEffect después,
    // así que el input aún no existe en el primer render con open=true.
    useEffect(() => {
        if (open && pos) {
            const t = setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(t);
        }
    }, [open, pos]);

    // ----- handlers -----
    const handleOpen = () => {
        if (disabled) return;
        setOpen(true);
        setQuery('');
    };

    const handleSelect = (item) => {
        setSelectedItem(item);
        // Segundo argumento: el item completo. Útil cuando el caller necesita
        // derivar otros campos del item seleccionado (p. ej. el ciclo de un grupo
        // para luego filtrar módulos). El caller puede ignorarlo si solo le interesa el id.
        onChange(getOptionValue(item), item);
        setOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSelectedItem(null);
        onChange('', null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (!results.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[highlightIdx]) handleSelect(results[highlightIdx]);
        }
    };

    const displayLabel = selectedItem ? getOptionLabel(selectedItem) : '';

    return (
        <div className={styles.container} style={{ minWidth }}>
            {/* Input oculto para validación nativa del form (required, name) */}
            {name && (
                <input
                    type="text"
                    name={name}
                    value={value ?? ''}
                    onChange={() => {}}
                    required={required}
                    tabIndex={-1}
                    aria-hidden="true"
                    className={styles.hiddenInput}
                />
            )}

            <button
                ref={triggerRef}
                type="button"
                className={`${styles.trigger} ${open ? styles.open : ''}`}
                onClick={handleOpen}
                disabled={disabled}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
            >
                <span className={styles.label}>
                    {displayLabel || <span className={styles.placeholder}>{finalPlaceholder}</span>}
                </span>
                {selectedItem && !disabled && (
                    <span
                        className={styles.clearBtn}
                        onClick={handleClear}
                        role="button"
                        aria-label={t('asyncSelect.clear', { defaultValue: 'Limpiar' })}
                    >
                        <X size={14} />
                    </span>
                )}
            </button>

            {open && pos && createPortal(
                <div
                    ref={dropdownRef}
                    data-modal-allow-focus=""
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
                    <div className={styles.searchBar}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('asyncSelect.searchPlaceholder', { defaultValue: 'Escribe para buscar…' })}
                            className={styles.searchInput}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {loading && <Loader2 size={16} className={styles.spinner} />}
                    </div>

                    <div className={styles.results}>
                        {!loading && results.length === 0 && (
                            <div className={styles.emptyState}>
                                {query.length < minQueryLength
                                    ? t('asyncSelect.typeToSearch', { defaultValue: `Escribe al menos ${minQueryLength} caracteres` })
                                    : t('asyncSelect.noResults', { defaultValue: 'Sin resultados' })}
                            </div>
                        )}
                        {results.map((item, idx) => {
                            const itemValue = getOptionValue(item);
                            const isSelected = String(itemValue) === String(value);
                            const isHighlighted = idx === highlightIdx;
                            return (
                                <button
                                    key={itemValue ?? idx}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`${styles.item} ${isSelected ? styles.active : ''} ${isHighlighted ? styles.highlighted : ''}`}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setHighlightIdx(idx)}
                                >
                                    {getOptionLabel(item)}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AsyncSearchSelect;
