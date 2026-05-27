import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    ZoomIn, ZoomOut, Maximize2, Minimize2, Eye, EyeOff, Search, X,
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
   Router ortogonal de líneas de relación.

   Cada línea se traza con segmentos perpendiculares:
   - mismo column → desvío por el gutter lateral
   - columnas adyacentes → un único canal vertical en el gutter común
   - 2+ columnas de distancia → highway horizontal por encima del mundo

   Después se asignan sub-lanes (offsets) en cada gutter y en la highway
   para que múltiples líneas no se superpongan.
   ============================================================ */

/** Índice de columna de una entidad (según su X). */
const colOf = (entity) => {
    const idx = ER_LAYOUT.columnX.indexOf(entity.position.x);
    return idx >= 0 ? idx : 0;
};

/**
 * Calcula el camino ortogonal "base" (sin offsets de lane) de una relación.
 * Devuelve los puntos del polígono y los gutters/highway que ocupa, para
 * que la asignación de lanes pueda desplazarlos después.
 */
const computeRelPath = (rel, source, target, heights, showAudit, sameColSide) => {
    const sCol = colOf(source);
    const tCol = colOf(target);

    const sFkIdx = findFkRowIndex(source, rel, showAudit);
    const sFkY = sFkIdx >= 0
        ? rowCenterY(source, sFkIdx)
        : source.position.y + heights[source.id] / 2;

    /* PK siempre es el primer campo visible (índice 0). */
    const tPkY = rowCenterY(target, 0);

    /* ---- Mismo column: desvío por gutter lateral ---- */
    if (sCol === tCol) {
        /* alterna lado para no apilar todas las internas en la misma columna */
        let useLeft = sameColSide === 'left' || (sameColSide == null && sCol > 0);
        /* Col 0 (izquierda) sólo puede ir por la derecha; col N (derecha)
           sólo puede ir por la izquierda — no hay gutter fuera del mundo. */
        const maxCol = ER_LAYOUT.columnX.length - 1;
        if (sCol === 0) useLeft = false;
        if (sCol === maxCol) useLeft = true;
        const gutterIdx = useLeft ? sCol - 1 : sCol;
        const channelX = ER_LAYOUT.gutterCenterX[gutterIdx];
        const sExitX  = useLeft ? source.position.x : source.position.x + ER_LAYOUT.cardWidth;
        const tEnterX = useLeft ? target.position.x : target.position.x + ER_LAYOUT.cardWidth;
        return {
            kind: 'sameCol',
            points: [
                { x: sExitX,  y: sFkY },
                { x: channelX, y: sFkY, channelGutter: gutterIdx },
                { x: channelX, y: tPkY, channelGutter: gutterIdx },
                { x: tEnterX, y: tPkY },
            ],
            channels: [{ gutterIdx, y1: Math.min(sFkY, tPkY), y2: Math.max(sFkY, tPkY) }],
            anchors: { sExitX, sFkY, tEnterX, tPkY, fromOnLeft: useLeft },
        };
    }

    const goingRight = tCol > sCol;
    const sExitX  = goingRight ? source.position.x + ER_LAYOUT.cardWidth : source.position.x;
    const tEnterX = goingRight ? target.position.x : target.position.x + ER_LAYOUT.cardWidth;

    /* ---- Columnas adyacentes: canal único en el gutter común ---- */
    if (Math.abs(tCol - sCol) === 1) {
        const gutterIdx = goingRight ? sCol : tCol;
        const channelX = ER_LAYOUT.gutterCenterX[gutterIdx];
        return {
            kind: 'adjacent',
            points: [
                { x: sExitX,  y: sFkY },
                { x: channelX, y: sFkY, channelGutter: gutterIdx },
                { x: channelX, y: tPkY, channelGutter: gutterIdx },
                { x: tEnterX, y: tPkY },
            ],
            channels: [{ gutterIdx, y1: Math.min(sFkY, tPkY), y2: Math.max(sFkY, tPkY) }],
            anchors: { sExitX, sFkY, tEnterX, tPkY, fromOnLeft: !goingRight },
        };
    }

    /* ---- Multi-hop (2+ columnas): highway por arriba ---- */
    const sGutterIdx = goingRight ? sCol : sCol - 1;
    const tGutterIdx = goingRight ? tCol - 1 : tCol;
    const sChannelX = ER_LAYOUT.gutterCenterX[sGutterIdx];
    const tChannelX = ER_LAYOUT.gutterCenterX[tGutterIdx];
    const highwayY = ER_LAYOUT.highwayTopY;
    return {
        kind: 'multiHop',
        points: [
            { x: sExitX,    y: sFkY },
            { x: sChannelX, y: sFkY,     channelGutter: sGutterIdx },
            { x: sChannelX, y: highwayY, channelGutter: sGutterIdx, highwayLane: true },
            { x: tChannelX, y: highwayY, channelGutter: tGutterIdx, highwayLane: true },
            { x: tChannelX, y: tPkY,     channelGutter: tGutterIdx },
            { x: tEnterX,   y: tPkY },
        ],
        channels: [
            { gutterIdx: sGutterIdx, y1: Math.min(highwayY, sFkY), y2: Math.max(highwayY, sFkY) },
            { gutterIdx: tGutterIdx, y1: Math.min(highwayY, tPkY), y2: Math.max(highwayY, tPkY) },
        ],
        highway: { x1: Math.min(sChannelX, tChannelX), x2: Math.max(sChannelX, tChannelX) },
        anchors: { sExitX, sFkY, tEnterX, tPkY, fromOnLeft: !goingRight },
    };
};

/**
 * Asigna sub-lanes a cada relación dentro de cada gutter (y dentro de la
 * highway superior). El offset se aplica restando la mitad de las lanes para
 * que queden centradas alrededor del eje del gutter.
 */
const assignLanes = (paths) => {
    /* Agrupa por gutter las relaciones cuyo canal vertical lo atraviesa. */
    const byGutter = {};
    paths.forEach((p, pIdx) => {
        p.channels.forEach((ch, cIdx) => {
            (byGutter[ch.gutterIdx] ??= []).push({ pIdx, cIdx, ...ch });
        });
    });

    const gutterLanes = {}; // `${pIdx}_${cIdx}` -> lane index
    Object.entries(byGutter).forEach(([, entries]) => {
        /* Orden estable por punto medio Y → líneas similares quedan juntas
           pero sin solaparse. */
        entries.sort((a, b) => ((a.y1 + a.y2) - (b.y1 + b.y2)) / 2);
        const mid = (entries.length - 1) / 2;
        entries.forEach((e, i) => {
            gutterLanes[`${e.pIdx}_${e.cIdx}`] = i - mid; // centrado alrededor de 0
        });
    });

    /* Asigna lane Y a las relaciones que usan la highway superior. */
    const highwayEntries = [];
    paths.forEach((p, pIdx) => {
        if (p.highway) highwayEntries.push({ pIdx, ...p.highway });
    });
    /* Las más largas (que cubren más X) en lanes superiores;
       las más cortas en lanes inferiores → menos cruces visuales. */
    highwayEntries.sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1));
    const highwayLanes = {};
    highwayEntries.forEach((e, i) => {
        highwayLanes[e.pIdx] = i;
    });

    return { gutterLanes, highwayLanes };
};

/**
 * Aplica los offsets de lane a los puntos de cada path. Los puntos del
 * canal vertical (con `channelGutter`) reciben offset X. Los puntos de la
 * highway (con `highwayLane`) reciben offset Y.
 */
const applyLanes = (paths, gutterLanes, highwayLanes) => {
    return paths.map((p, pIdx) => {
        const newPoints = p.points.map((pt, ptIdx) => {
            let { x, y } = pt;
            if (pt.channelGutter != null) {
                const cIdx = p.channels.findIndex(c => c.gutterIdx === pt.channelGutter);
                const lane = gutterLanes[`${pIdx}_${cIdx}`] ?? 0;
                const gx = ER_LAYOUT.gutterCenterX[pt.channelGutter];
                if (gx !== undefined) {
                    x = gx + lane * ER_LAYOUT.laneStep;
                }
            }
            if (pt.highwayLane) {
                const lane = highwayLanes[pIdx] ?? 0;
                y = ER_LAYOUT.highwayTopY + lane * ER_LAYOUT.highwayLaneStep;
            }
            return { x, y };
        });
        return { ...p, finalPoints: newPoints };
    });
};

/**
 * Convierte una lista de puntos en un atributo `d` de SVG con esquinas
 * suavemente redondeadas (cuarto de círculo de radio `r`).
 */
const pointsToRoundedPath = (points, r = 6) => {
    const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length < 2) return '';
    let d = `M ${valid[0].x} ${valid[0].y}`;
    for (let i = 1; i < valid.length - 1; i++) {
        const prev = valid[i - 1];
        const curr = valid[i];
        const next = valid[i + 1];
        const d1x = curr.x - prev.x;
        const d1y = curr.y - prev.y;
        const len1 = Math.hypot(d1x, d1y) || 1;
        const d2x = next.x - curr.x;
        const d2y = next.y - curr.y;
        const len2 = Math.hypot(d2x, d2y) || 1;
        const radius = Math.max(0, Math.min(r, len1 / 2, len2 / 2));
        const ax = curr.x - (d1x / len1) * radius;
        const ay = curr.y - (d1y / len1) * radius;
        const bx = curr.x + (d2x / len2) * radius;
        const by = curr.y + (d2y / len2) * radius;
        d += ` L ${ax} ${ay} Q ${curr.x} ${curr.y} ${bx} ${by}`;
    }
    const last = valid[valid.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
};

/* ============================================================
   ErDiagram — componente principal.
   ============================================================ */

const ErDiagram = ({ fullscreen = false, onToggleFullscreen = null } = {}) => {
    const [transform, setTransform] = useState({ x: 60, y: 40, scale: 0.55 });
    const [showAudit, setShowAudit] = useState(false);
    const [hideUnrelatedRels, setHideUnrelatedRels] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedRel, setSelectedRel] = useState(null);
    const [search, setSearch] = useState('');

    const containerRef = useRef(null);
    const worldRef = useRef(null);
    const didFitRef = useRef(false);
    /* Única fuente de verdad para la posición de la cámara.
       Se actualiza desde los eventos pointermove durante el arrastre
       y se sincroniza con el estado `transform` en los demás casos. */
    const camRef = useRef({ x: transform.x, y: transform.y });

    /* ---------- Heights por entidad ---------- */
    const heights = useMemo(() => {
        const m = {};
        ER_ENTITIES.forEach(e => { m[e.id] = computeHeight(e, showAudit); });
        return m;
    }, [showAudit]);

    /* Una sola flecha por par (from→to): cuando hay varias FKs entre las
       mismas dos entidades (ej. Mensaje→User: remitente + destinatario)
       el canvas muestra una línea; el detalle completo está en el panel lateral. */
    const dedupedRelations = useMemo(() => {
        const seen = new Set();
        return ER_RELATIONS.filter(rel => {
            const key = `${rel.from}→${rel.to}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, []);

    /* ---------- Routing ortogonal de TODAS las relaciones ----------
       Calcula primero el camino base de cada relación, luego asigna
       sub-lanes por gutter/highway y por último compone los puntos
       finales del polígono. */
    const routedPaths = useMemo(() => {
        /* Para entidades en la misma columna, alterna lado izquierdo/derecho
           para que las relaciones internas no se apilen todas a la izquierda. */
        const sameColCounter = {};
        const basePaths = dedupedRelations.map((rel) => {
            const from = ENTITY_BY_ID[rel.from];
            const to   = ENTITY_BY_ID[rel.to];
            if (!from || !to) return { rel, path: null };

            let sameColSide;
            if (colOf(from) === colOf(to)) {
                const colKey = colOf(from);
                sameColCounter[colKey] = (sameColCounter[colKey] || 0) + 1;
                /* Col 0 (Centro) sólo puede ir por la derecha; resto alterna. */
                if (colKey === 0) sameColSide = 'right';
                else sameColSide = sameColCounter[colKey] % 2 === 1 ? 'left' : 'right';
            }

            const path = computeRelPath(rel, from, to, heights, showAudit, sameColSide);
            return { rel, path };
        });

        const realPaths = basePaths.filter(p => p.path).map(p => p.path);
        const { gutterLanes, highwayLanes } = assignLanes(realPaths);
        const withLanes = applyLanes(realPaths, gutterLanes, highwayLanes);

        /* Reasocia los paths re-laneados con sus relaciones originales. */
        let i = 0;
        return basePaths.map(({ rel, path }) => ({
            rel,
            path: path ? withLanes[i++] : null,
        }));
    }, [heights, showAudit, dedupedRelations]);

    /* ---------- Foco / dim ---------- */
    const focusedId = hoveredId || selectedId;
    const focusedRel = !focusedId ? selectedRel : null;

    const relatedSet = useMemo(() => {
        if (!focusedId && !focusedRel) return null;
        if (focusedId) {
            const set = new Set([focusedId]);
            ER_RELATIONS.forEach(r => {
                if (r.from === focusedId) set.add(r.to);
                if (r.to === focusedId) set.add(r.from);
            });
            return set;
        }
        return new Set([focusedRel.from, focusedRel.to]);
    }, [focusedId, focusedRel]);

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
        if (relatedSet && !relatedSet.has(id)) return true;
        return false;
    }, [matchedSet, relatedSet]);

    const isRelationDimmed = useCallback((rel) => {
        if (matchedSet && !(matchedSet.has(rel.from) && matchedSet.has(rel.to))) return true;
        if (focusedRel && focusedRel !== rel) return true;
        if (focusedId && rel.from !== focusedId && rel.to !== focusedId) return true;
        return false;
    }, [matchedSet, focusedId, focusedRel]);

    /* ---------- Pan con Pointer Events + setPointerCapture ----------
       setPointerCapture garantiza que todos los eventos posteriores
       (pointermove, pointerup) se entreguen a este elemento aunque el
       puntero salga de sus límites.  No necesita onMouseLeave.
       camRef es la única fuente de verdad de la posición durante el drag.
       React estado `transform` solo se actualiza al soltar el arrastre.
       ─────────────────────────────────────────────────────────────── */
    const [dragging, setDragging] = useState(false);
    const pointerStartRef = useRef({ x: 0, y: 0 });
    const pointerOriginRef = useRef({ x: 0, y: 0 });

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        /* Lee la posición desde el estado `transform` (render más
           reciente) en vez de `camRef`, porque `camRef` no se actualiza
           con el zoom y tendría coordenadas anteriores al zoom. */
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
        pointerOriginRef.current = { x: transform.x, y: transform.y };
        camRef.current.x = transform.x;
        camRef.current.y = transform.y;
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        const nx = pointerOriginRef.current.x + dx;
        const ny = pointerOriginRef.current.y + dy;
        camRef.current.x = nx;
        camRef.current.y = ny;
        if (worldRef.current) {
            worldRef.current.style.transform =
                `translate(${nx}px, ${ny}px) scale(${transform.scale})`;
        }
    };
    const onPointerUp = () => {
        if (!dragging) return;
        setDragging(false);
        setTransform(t => ({ ...t, x: camRef.current.x, y: camRef.current.y }));
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

    /* Re-fit cuando cambia el modo fullscreen (el contenedor cambia de tamaño).
       Esperamos un par de frames para que el navegador aplique el nuevo layout
       antes de calcular las dimensiones reales. */
    useEffect(() => {
        const r1 = requestAnimationFrame(() => {
            const r2 = requestAnimationFrame(() => fitToScreen());
            return () => cancelAnimationFrame(r2);
        });
        return () => cancelAnimationFrame(r1);
    }, [fullscreen, fitToScreen]);

    /* ─── Sincronización del transform al DOM y a camRef ────────
       Tras CADA render:
       1. Si NO estamos arrastrando, volcamos `transform` (React)
          a `camRef` para que esté siempre al día.
       2. Aplicamos la posición correcta al DOM directamente (sin
          pasar por JSX style, para que React nunca lo machaque).
       ──────────────────────────────────────────────────────────── */
    useLayoutEffect(() => {
        if (!dragging) {
            camRef.current.x = transform.x;
            camRef.current.y = transform.y;
        }
        if (worldRef.current) {
            const x = dragging ? camRef.current.x : transform.x;
            const y = dragging ? camRef.current.y : transform.y;
            worldRef.current.style.transform =
                `translate(${x}px, ${y}px) scale(${transform.scale})`;
        }
    });

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
        <div className={`${styles.shell} ${fullscreen ? styles.shellFullscreen : ''}`}>
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
                    <button
                        className={`${styles.tbBtn} ${hideUnrelatedRels ? styles.tbBtnActive : ''}`}
                        onClick={() => setHideUnrelatedRels(h => !h)}
                        title="Ocultar relaciones no conectadas a la entidad seleccionada"
                    >
                        <Link2 size={14} />
                        <span>Solo conexiones</span>
                    </button>
                </div>

                <div className={styles.toolbarGroup}>
                    <button className={styles.tbBtn} onClick={() => zoomBy(1.2)} title="Acercar">
                        <ZoomIn size={14} />
                    </button>
                    <button className={styles.tbBtn} onClick={() => zoomBy(0.83)} title="Alejar">
                        <ZoomOut size={14} />
                    </button>
                    <button
                        className={styles.tbBtn}
                        onClick={() => {
                            if (onToggleFullscreen) onToggleFullscreen();
                            else fitToScreen();
                        }}
                        title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    >
                        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        className={`${styles.tbBtn} ${sidebarCollapsed ? styles.tbBtnActive : ''}`}
                        onClick={() => setSidebarCollapsed(s => !s)}
                        title={sidebarCollapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral'}
                    >
                        {sidebarCollapsed ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <span className={styles.zoomLabel}>{Math.round(transform.scale * 100)}%</span>
                </div>
            </div>

            <div className={styles.body}>
                {/* ============ CANVAS ============ */}
                <div
                    ref={containerRef}
                    className={styles.canvas}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    <div
                        ref={worldRef}
                        className={styles.world}
                        style={{
                            width:  ER_LAYOUT.worldWidth,
                            height: ER_LAYOUT.worldHeight,
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
                                <marker
                                    id="er-arrow-outgoing"
                                    viewBox="0 0 10 10"
                                    refX="8" refY="5"
                                    markerWidth="7" markerHeight="7"
                                    orient="auto-start-reverse"
                                >
                                    <path d="M0,0 L10,5 L0,10 Z" fill="#fbbf24" />
                                </marker>
                                <marker
                                    id="er-arrow-incoming"
                                    viewBox="0 0 10 10"
                                    refX="8" refY="5"
                                    markerWidth="7" markerHeight="7"
                                    orient="auto-start-reverse"
                                >
                                    <path d="M0,0 L10,5 L0,10 Z" fill="#67e8f9" />
                                </marker>
                            </defs>

                            {routedPaths.map(({ rel, path }, i) => {
                                if (!path) return null;
                                const dimmed = isRelationDimmed(rel);
                                const isOutgoing   = focusedId != null && rel.from === focusedId;
                                const isIncoming   = focusedId != null && rel.to   === focusedId;
                                const isRelFocused = focusedId == null && rel === focusedRel;
                                const active = isOutgoing || isIncoming || isRelFocused;
                                if (hideUnrelatedRels && !active) return null;
                                const dStr = pointsToRoundedPath(path.finalPoints, 8);

                                /* 'N' o '1' del lado FK; siempre '1' del lado PK. */
                                const fromCard = rel.cardinality.split(':')[0];
                                const toCard   = rel.cardinality.split(':')[1];
                                const a = path.anchors;

                                const dirClass = isOutgoing ? styles.relOutgoing
                                    : isIncoming            ? styles.relIncoming
                                    : isRelFocused          ? styles.relActive
                                    : '';
                                const markerEnd = isOutgoing   ? 'url(#er-arrow-outgoing)'
                                    : isIncoming               ? 'url(#er-arrow-incoming)'
                                    : isRelFocused             ? 'url(#er-arrow-active)'
                                    : 'url(#er-arrow)';

                                return (
                                    <g
                                        key={i}
                                        className={`${styles.relGroup} ${dimmed ? styles.relDim : ''} ${dirClass}`}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedRel(prev => prev === rel ? null : rel);
                                            setSelectedId(null);
                                        }}
                                    >
                                        <path
                                            d={dStr}
                                            className={styles.relPath}
                                            markerEnd={markerEnd}
                                            fill="none"
                                        />
                                        {/* Cardinalidad: 'N'/'1' junto al lado FK, '1' junto al lado PK */}
                                        <text
                                            x={a.sExitX + (a.fromOnLeft ? -14 : 14)}
                                            y={a.sFkY - 4}
                                            className={styles.relCard}
                                            textAnchor={a.fromOnLeft ? 'end' : 'start'}
                                        >
                                            {fromCard}
                                        </text>
                                        <text
                                            x={a.tEnterX + (a.fromOnLeft ? 14 : -14)}
                                            y={a.tPkY - 4}
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
                                    onPointerDown={(e) => e.stopPropagation()}
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
                <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
                    {!sidebarCollapsed && (
                        selectedEntity ? (
                            <DetailPanel
                                entity={selectedEntity}
                                relations={selectedRelations}
                                onClose={() => setSelectedId(null)}
                            />
                        ) : (
                            <LegendPanel />
                        )
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
