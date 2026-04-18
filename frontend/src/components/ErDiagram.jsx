import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Search, X,
    Key, Link2, Hash, Calendar, ToggleLeft, FileText, Type,
    Boxes, Database, Clock, Trash2,
} from 'lucide-react';
import styles from './ErDiagram.module.css';
import { ER_DOMAINS, ER_ENTITIES, ER_RELATIONS, ER_LAYOUT } from '../data/erModel';

/* ============================================================
   Mapas de utilidades.
   ============================================================ */

const ENTITY_BY_ID = Object.fromEntries(ER_ENTITIES.map(e => [e.id, e]));

/** Devuelve el icono apropiado para cada tipo SQL. */
const typeIcon = (type) => {
    if (type.startsWith('int') || type === 'float' || type === 'decimal') return <Hash size={11} />;
    if (type === 'boolean') return <ToggleLeft size={11} />;
    if (type === 'date' || type === 'datetime' || type === 'time') return <Calendar size={11} />;
    if (type === 'text' || type === 'json') return <FileText size={11} />;
    if (type === 'misc') return <Boxes size={11} />;
    return <Type size={11} />;
};

/** Suaviza un id como `Personalizacion` a `personalizacion`. */
const tableLabel = (entity) => entity.table;

/** Calcula el alto en px de una entidad según sus campos visibles. */
const computeHeight = (entity, showAudit) => {
    const visible = showAudit ? entity.fields : entity.fields.filter(f => !f.audit);
    return ER_LAYOUT.headerHeight + visible.length * ER_LAYOUT.fieldHeight + ER_LAYOUT.footerHeight;
};

/** Devuelve el índice (0-based) del campo FK que materializa la relación. */
const findFkRowIndex = (entity, relation, showAudit) => {
    const fields = showAudit ? entity.fields : entity.fields.filter(f => !f.audit);
    const expectedCol = `${relation.label}_id`;
    return fields.findIndex(f => f.name === expectedCol);
};

/** Y absoluta del centro de un row dentro de la entidad (en coords mundo). */
const rowCenterY = (entity, rowIndex) =>
    entity.position.y + ER_LAYOUT.headerHeight + (rowIndex + 0.5) * ER_LAYOUT.fieldHeight;

/* ============================================================
   Cálculo de anclajes / geometría de las líneas de relación.
   ============================================================ */

/**
 * Para una relación `from → to`, determina:
 *  - el lado de salida (left/right) en `from` (anclado al row del FK)
 *  - el lado de entrada en `to` (anclado al row del PK = id, idx 0)
 *  - la posición exacta de cada extremo en coords mundo
 */
const computeAnchors = (from, to, relation, heights, showAudit) => {
    const fromW = ER_LAYOUT.cardWidth;
    const toW   = ER_LAYOUT.cardWidth;

    const fromCenterX = from.position.x + fromW / 2;
    const toCenterX   = to.position.x   + toW   / 2;

    const fkIdx = findFkRowIndex(from, relation, showAudit);
    const fromY = fkIdx >= 0
        ? rowCenterY(from, fkIdx)
        : from.position.y + heights[from.id] / 2;

    // PK (id) siempre es el primer campo visible (índice 0)
    const toY = rowCenterY(to, 0);

    // Salida por el lado más cercano (el lateral que mira al destino)
    const fromOnLeft = fromCenterX > toCenterX;
    const fromX = fromOnLeft ? from.position.x : from.position.x + fromW;
    const toX   = fromOnLeft ? to.position.x + toW : to.position.x;

    return { fromX, fromY, toX, toY, fromOnLeft };
};

/** Construye una bezier cúbica horizontal entre dos puntos. */
const bezierPath = (x1, y1, x2, y2) => {
    const dx = Math.max(80, Math.abs(x2 - x1) * 0.5);
    const cx1 = x1 + (x2 >= x1 ? dx : -dx);
    const cx2 = x2 + (x2 >= x1 ? -dx : dx);
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
};

/* ============================================================
   ErDiagram — componente principal.
   ============================================================ */

const ErDiagram = () => {
    const [transform, setTransform] = useState({ x: 60, y: 40, scale: 0.55 });
    const [showAudit, setShowAudit] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');

    const containerRef = useRef(null);
    const dragRef = useRef({ active: false });
    const didFitRef = useRef(false);

    /* ---------- Heights por entidad ---------- */
    const heights = useMemo(() => {
        const m = {};
        ER_ENTITIES.forEach(e => { m[e.id] = computeHeight(e, showAudit); });
        return m;
    }, [showAudit]);

    /* ---------- Foco / dim ---------- */
    const focusedId = hoveredId || selectedId;

    const relatedSet = useMemo(() => {
        if (!focusedId) return null;
        const set = new Set([focusedId]);
        ER_RELATIONS.forEach(r => {
            if (r.from === focusedId) set.add(r.to);
            if (r.to === focusedId) set.add(r.from);
        });
        return set;
    }, [focusedId]);

    const matchedSet = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return null;
        const set = new Set();
        ER_ENTITIES.forEach(e => {
            if (e.id.toLowerCase().includes(q)
             || e.table.includes(q)
             || ER_DOMAINS[e.domain]?.label.toLowerCase().includes(q)) {
                set.add(e.id);
            }
        });
        return set;
    }, [search]);

    const isDimmed = useCallback((id) => {
        if (matchedSet && !matchedSet.has(id)) return true;
        if (focusedId && !relatedSet.has(id)) return true;
        return false;
    }, [matchedSet, focusedId, relatedSet]);

    const isRelationDimmed = useCallback((rel) => {
        if (matchedSet && !(matchedSet.has(rel.from) && matchedSet.has(rel.to))) return true;
        if (focusedId && rel.from !== focusedId && rel.to !== focusedId) return true;
        return false;
    }, [matchedSet, focusedId]);

    /* ---------- Pan ---------- */
    const onCanvasMouseDown = (e) => {
        if (e.button !== 0) return;
        dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            ox: transform.x,
            oy: transform.y,
            moved: false,
        };
    };
    const onCanvasMouseMove = (e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
        setTransform(t => ({ ...t, x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }));
    };
    const onCanvasMouseUp = () => {
        // Si fue un click limpio (no arrastrado) sobre el fondo → deseleccionar
        if (dragRef.current.active && !dragRef.current.moved) {
            setSelectedId(null);
        }
        dragRef.current.active = false;
    };

    /* ---------- Zoom (rueda + ctrl/cmd) ---------- */
    /* Listener nativo (no JSX) para garantizar passive=false y poder
       hacer preventDefault sin que el navegador haga scroll. */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.0015;
            setTransform(t => {
                const newScale = Math.min(2, Math.max(0.2, t.scale * (1 + delta)));
                const rect = el.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                const ratio = newScale / t.scale;
                return {
                    scale: newScale,
                    x: mx - (mx - t.x) * ratio,
                    y: my - (my - t.y) * ratio,
                };
            });
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const zoomBy = (factor) => {
        setTransform(t => {
            const newScale = Math.min(2, Math.max(0.2, t.scale * factor));
            const rect = containerRef.current.getBoundingClientRect();
            const mx = rect.width / 2;
            const my = rect.height / 2;
            const ratio = newScale / t.scale;
            return {
                scale: newScale,
                x: mx - (mx - t.x) * ratio,
                y: my - (my - t.y) * ratio,
            };
        });
    };

    const fitToScreen = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 80;
        const scale = Math.min(
            (rect.width  - padding * 2) / ER_LAYOUT.worldWidth,
            (rect.height - padding * 2) / ER_LAYOUT.worldHeight,
        );
        const x = (rect.width  - ER_LAYOUT.worldWidth  * scale) / 2;
        const y = (rect.height - ER_LAYOUT.worldHeight * scale) / 2;
        setTransform({ x, y, scale });
    }, []);

    /* Auto-fit en el primer mount cuando ya tenemos dimensiones reales. */
    useEffect(() => {
        if (didFitRef.current) return;
        const ro = new ResizeObserver(() => {
            if (didFitRef.current) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                fitToScreen();
                didFitRef.current = true;
            }
        });
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [fitToScreen]);

    /* Listeners globales para soltar el drag fuera del canvas. */
    useEffect(() => {
        const up = () => { dragRef.current.active = false; };
        window.addEventListener('mouseup', up);
        return () => window.removeEventListener('mouseup', up);
    }, []);

    /* ---------- Entidad seleccionada ---------- */
    const selectedEntity = selectedId ? ENTITY_BY_ID[selectedId] : null;
    const selectedRelations = useMemo(() => {
        if (!selectedId) return { incoming: [], outgoing: [] };
        return {
            outgoing: ER_RELATIONS.filter(r => r.from === selectedId),
            incoming: ER_RELATIONS.filter(r => r.to === selectedId),
        };
    }, [selectedId]);

    /* ---------- Render ---------- */
    return (
        <div className={styles.shell}>
            {/* ============ TOOLBAR ============ */}
            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar entidad o tabla..."
                        className={styles.searchInput}
                    />
                    {search && (
                        <button className={styles.searchClear} onClick={() => setSearch('')}>
                            <X size={12} />
                        </button>
                    )}
                </div>

                <div className={styles.toolbarGroup}>
                    <button
                        className={`${styles.tbBtn} ${showAudit ? styles.tbBtnActive : ''}`}
                        onClick={() => setShowAudit(s => !s)}
                        title="Mostrar/ocultar campos de auditoría (timestamps, soft-delete)"
                    >
                        {showAudit ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>Auditoría</span>
                    </button>
                </div>

                <div className={styles.toolbarGroup}>
                    <button className={styles.tbBtn} onClick={() => zoomBy(1.2)} title="Acercar">
                        <ZoomIn size={14} />
                    </button>
                    <button className={styles.tbBtn} onClick={() => zoomBy(0.83)} title="Alejar">
                        <ZoomOut size={14} />
                    </button>
                    <button className={styles.tbBtn} onClick={fitToScreen} title="Ajustar a pantalla">
                        <Maximize2 size={14} />
                    </button>
                    <span className={styles.zoomLabel}>{Math.round(transform.scale * 100)}%</span>
                </div>
            </div>

            <div className={styles.body}>
                {/* ============ CANVAS ============ */}
                <div
                    ref={containerRef}
                    className={styles.canvas}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp}
                >
                    <div
                        className={styles.world}
                        style={{
                            width:  ER_LAYOUT.worldWidth,
                            height: ER_LAYOUT.worldHeight,
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        }}
                    >
                        {/* Líneas de relación detrás de las cajas */}
                        <svg
                            className={styles.lines}
                            width={ER_LAYOUT.worldWidth}
                            height={ER_LAYOUT.worldHeight}
                            viewBox={`0 0 ${ER_LAYOUT.worldWidth} ${ER_LAYOUT.worldHeight}`}
                        >
                            <defs>
                                <marker
                                    id="er-arrow"
                                    viewBox="0 0 10 10"
                                    refX="8" refY="5"
                                    markerWidth="6" markerHeight="6"
                                    orient="auto-start-reverse"
                                >
                                    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
                                </marker>
                                <marker
                                    id="er-arrow-active"
                                    viewBox="0 0 10 10"
                                    refX="8" refY="5"
                                    markerWidth="7" markerHeight="7"
                                    orient="auto-start-reverse"
                                >
                                    <path d="M0,0 L10,5 L0,10 Z" fill="#c7d2fe" />
                                </marker>
                            </defs>

                            {ER_RELATIONS.map((rel, i) => {
                                const from = ENTITY_BY_ID[rel.from];
                                const to   = ENTITY_BY_ID[rel.to];
                                if (!from || !to) return null;
                                const a = computeAnchors(from, to, rel, heights, showAudit);
                                const path = bezierPath(a.fromX, a.fromY, a.toX, a.toY);
                                const dimmed = isRelationDimmed(rel);
                                const active = focusedId && (rel.from === focusedId || rel.to === focusedId);

                                // Etiqueta en el extremo del FK ('N' para muchos, '1' para uno)
                                const fromCard = rel.cardinality.split(':')[0]; // 'N' o '1'
                                const toCard   = rel.cardinality.split(':')[1]; // siempre '1'

                                return (
                                    <g
                                        key={i}
                                        className={`${styles.relGroup} ${dimmed ? styles.relDim : ''} ${active ? styles.relActive : ''}`}
                                    >
                                        <path
                                            d={path}
                                            className={styles.relPath}
                                            markerEnd={active ? 'url(#er-arrow-active)' : 'url(#er-arrow)'}
                                            fill="none"
                                        />
                                        {/* Cardinalidad junto a cada extremo */}
                                        <text
                                            x={a.fromX + (a.fromOnLeft ? -10 : 10)}
                                            y={a.fromY - 6}
                                            className={styles.relCard}
                                            textAnchor={a.fromOnLeft ? 'end' : 'start'}
                                        >
                                            {fromCard}
                                        </text>
                                        <text
                                            x={a.toX + (a.fromOnLeft ? 10 : -10)}
                                            y={a.toY - 6}
                                            className={styles.relCard}
                                            textAnchor={a.fromOnLeft ? 'start' : 'end'}
                                        >
                                            {toCard}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Tarjetas de entidad */}
                        {ER_ENTITIES.map((entity) => {
                            const dimmed   = isDimmed(entity.id);
                            const selected = selectedId === entity.id;
                            const hovered  = hoveredId === entity.id;
                            const visibleFields = showAudit
                                ? entity.fields
                                : entity.fields.filter(f => !f.audit);
                            const accent = ER_DOMAINS[entity.domain].color;

                            return (
                                <div
                                    key={entity.id}
                                    className={`
                                        ${styles.card}
                                        ${dimmed   ? styles.cardDim    : ''}
                                        ${selected ? styles.cardSel    : ''}
                                        ${hovered  ? styles.cardHover  : ''}
                                    `}
                                    style={{
                                        left:   entity.position.x,
                                        top:    entity.position.y,
                                        width:  ER_LAYOUT.cardWidth,
                                        '--accent': accent,
                                    }}
                                    onMouseEnter={() => setHoveredId(entity.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedId(prev => prev === entity.id ? null : entity.id);
                                    }}
                                >
                                    {/* Header */}
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardTitleRow}>
                                            <Database size={14} className={styles.cardHeaderIcon} />
                                            <span className={styles.cardTitle}>{entity.id}</span>
                                        </div>
                                        <span className={styles.cardTable}>{tableLabel(entity)}</span>
                                    </div>

                                    {/* Campos */}
                                    <ul className={styles.fieldList}>
                                        {visibleFields.map((f) => (
                                            <li
                                                key={f.name}
                                                className={`
                                                    ${styles.field}
                                                    ${f.pk ? styles.fieldPk : ''}
                                                    ${f.fk ? styles.fieldFk : ''}
                                                    ${f.audit ? styles.fieldAudit : ''}
                                                    ${f.meta ? styles.fieldMeta : ''}
                                                `}
                                            >
                                                <span className={styles.fieldBadges}>
                                                    {f.pk && <Key size={10} className={styles.badgePk} />}
                                                    {f.fk && <Link2 size={10} className={styles.badgeFk} />}
                                                    {!f.pk && !f.fk && !f.meta && (
                                                        <span className={styles.badgeType}>{typeIcon(f.type)}</span>
                                                    )}
                                                </span>
                                                <span className={styles.fieldName}>
                                                    {f.name}
                                                    {f.nullable && <span className={styles.fieldNull}>?</span>}
                                                </span>
                                                <span className={styles.fieldType}>{f.type}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Footer chips: traits y dominio */}
                                    <div className={styles.cardFooter}>
                                        {entity.timestamps && (
                                            <span className={styles.traitChip} title="TimestampableTrait">
                                                <Clock size={9} /> ts
                                            </span>
                                        )}
                                        {entity.softDelete && (
                                            <span className={styles.traitChip} title="SoftDeletableTrait">
                                                <Trash2 size={9} /> soft
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mini info en esquina */}
                    <div className={styles.canvasHint}>
                        Arrastra para mover · Rueda para zoom · Click en una entidad para ver detalle
                    </div>
                </div>

                {/* ============ SIDEBAR ============ */}
                <aside className={styles.sidebar}>
                    {selectedEntity ? (
                        <DetailPanel
                            entity={selectedEntity}
                            relations={selectedRelations}
                            onClose={() => setSelectedId(null)}
                        />
                    ) : (
                        <LegendPanel />
                    )}
                </aside>
            </div>
        </div>
    );
};

/* ============================================================
   LegendPanel — leyenda de dominios y resumen del modelo.
   ============================================================ */

const LegendPanel = () => {
    const totals = useMemo(() => {
        const fieldCount = ER_ENTITIES.reduce((acc, e) => acc + e.fields.length, 0);
        return {
            entities: ER_ENTITIES.length,
            relations: ER_RELATIONS.length,
            fields: fieldCount,
        };
    }, []);

    return (
        <div className={styles.legend}>
            <h3 className={styles.legendTitle}>Modelo Entidad-Relación</h3>
            <p className={styles.legendIntro}>
                Diagrama del esquema Doctrine de Loggex. Cada caja es una entidad
                (tabla SQL); las líneas representan relaciones <code>ManyToOne</code>,
                <code> OneToMany</code> y <code>OneToOne</code>.
            </p>

            <div className={styles.legendStats}>
                <div className={styles.legendStat}>
                    <span className={styles.legendStatVal}>{totals.entities}</span>
                    <span className={styles.legendStatLabel}>entidades</span>
                </div>
                <div className={styles.legendStat}>
                    <span className={styles.legendStatVal}>{totals.relations}</span>
                    <span className={styles.legendStatLabel}>relaciones</span>
                </div>
                <div className={styles.legendStat}>
                    <span className={styles.legendStatVal}>{totals.fields}</span>
                    <span className={styles.legendStatLabel}>campos</span>
                </div>
            </div>

            <h4 className={styles.legendSection}>Dominios</h4>
            <ul className={styles.legendList}>
                {Object.entries(ER_DOMAINS).map(([key, dom]) => {
                    const count = ER_ENTITIES.filter(e => e.domain === key).length;
                    return (
                        <li key={key} className={styles.legendItem}>
                            <span
                                className={styles.legendSwatch}
                                style={{ background: dom.color }}
                            />
                            <span className={styles.legendItemLabel}>{dom.label}</span>
                            <span className={styles.legendItemCount}>{count}</span>
                        </li>
                    );
                })}
            </ul>

            <h4 className={styles.legendSection}>Convenciones</h4>
            <ul className={styles.conventionList}>
                <li><Key size={11} className={styles.badgePk} /> Clave primaria</li>
                <li><Link2 size={11} className={styles.badgeFk} /> Clave foránea</li>
                <li><span className={styles.fieldNull}>?</span> Campo nullable</li>
                <li><Clock size={9} /> <code>ts</code> usa <code>TimestampableTrait</code></li>
                <li><Trash2 size={9} /> <code>soft</code> usa <code>SoftDeletableTrait</code></li>
            </ul>

            <p className={styles.legendTip}>
                Pasa el cursor por una entidad para resaltar sus relaciones, o
                haz click para fijarla y ver el detalle aquí.
            </p>
        </div>
    );
};

/* ============================================================
   DetailPanel — ficha completa de la entidad seleccionada.
   ============================================================ */

const DetailPanel = ({ entity, relations, onClose }) => {
    const accent = ER_DOMAINS[entity.domain].color;

    return (
        <div className={styles.detail} style={{ '--accent': accent }}>
            <div className={styles.detailHead}>
                <div>
                    <span className={styles.detailDomain}>{ER_DOMAINS[entity.domain].label}</span>
                    <h3 className={styles.detailTitle}>{entity.id}</h3>
                    <code className={styles.detailTable}>tabla: {entity.table}</code>
                </div>
                <button className={styles.detailClose} onClick={onClose} aria-label="Cerrar">
                    <X size={16} />
                </button>
            </div>

            <div className={styles.detailMeta}>
                {entity.timestamps && (
                    <span className={styles.detailMetaChip}>
                        <Clock size={11} /> Timestampable
                    </span>
                )}
                {entity.softDelete && (
                    <span className={styles.detailMetaChip}>
                        <Trash2 size={11} /> Soft delete
                    </span>
                )}
                <span className={styles.detailMetaChip}>
                    {entity.fields.length} campos
                </span>
            </div>

            <h4 className={styles.detailSection}>Campos</h4>
            <ul className={styles.detailFields}>
                {entity.fields.map((f) => (
                    <li
                        key={f.name}
                        className={`${styles.detailField} ${f.audit ? styles.detailFieldAudit : ''}`}
                    >
                        <span className={styles.detailFieldBadges}>
                            {f.pk && <Key size={11} className={styles.badgePk} />}
                            {f.fk && <Link2 size={11} className={styles.badgeFk} />}
                        </span>
                        <span className={styles.detailFieldName}>
                            {f.name}{f.nullable && <span className={styles.fieldNull}>?</span>}
                        </span>
                        <span className={styles.detailFieldType}>{f.type}</span>
                        {f.fk && (
                            <span className={styles.detailFieldRef}>→ {f.fk}</span>
                        )}
                        {f.unique && <span className={styles.detailFieldFlag}>UQ</span>}
                    </li>
                ))}
            </ul>

            {relations.outgoing.length > 0 && (
                <>
                    <h4 className={styles.detailSection}>Apunta a (FK saliente)</h4>
                    <ul className={styles.detailRels}>
                        {relations.outgoing.map((r, i) => (
                            <li key={i}>
                                <span className={styles.relCardPill}>{r.cardinality}</span>
                                <code>{r.label}</code>
                                <span className={styles.relArrow}>→</span>
                                <strong>{r.to}</strong>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {relations.incoming.length > 0 && (
                <>
                    <h4 className={styles.detailSection}>Es referenciada por</h4>
                    <ul className={styles.detailRels}>
                        {relations.incoming.map((r, i) => (
                            <li key={i}>
                                <span className={styles.relCardPill}>{r.cardinality}</span>
                                <strong>{r.from}</strong>
                                <span className={styles.relArrow}>→</span>
                                <code>{r.label}</code>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default ErDiagram;
