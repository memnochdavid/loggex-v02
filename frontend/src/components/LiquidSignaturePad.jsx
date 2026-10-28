import React, { useState, useRef, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import Button from './Button';

/**
 * Captura una firma a mano alzada con trazo tipo tinta (presión/velocidad simulada)
 * usando perfect-freehand. Exporta el resultado como SVG.
 *
 * Props:
 *   onChange(svgString | null): callback al terminar cada trazo (o al limpiar).
 *   width, height: dimensiones del canvas en px (default 500 × 180).
 *   strokeColor: color del trazo (default "#111").
 *   className, style: aplicados al contenedor.
 */
// Ajustado para que parezca un bolígrafo (trazo fino, presión ligera)
const DEFAULT_STROKE_OPTIONS = {
    size: 2.5,
    thinning: 0.4,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
};

const getSvgPathFromStroke = (points) => {
    if (!points.length) return '';
    const d = points.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0.toFixed(2), y0.toFixed(2), ((x0 + x1) / 2).toFixed(2), ((y0 + y1) / 2).toFixed(2));
            return acc;
        },
        ['M', points[0][0].toFixed(2), points[0][1].toFixed(2), 'Q'],
    );
    d.push('Z');
    return d.join(' ');
};

const LiquidSignaturePad = ({
    onChange,
    width = 500,
    height = 180,
    strokeColor = '#111',
    className = '',
    style = {},
}) => {
    // Cada "trazo" es un array de [x, y, pressure]. Guardamos el histórico de trazos completos.
    const [strokes, setStrokes] = useState([]);
    const currentPointsRef = useRef([]);
    const [currentPath, setCurrentPath] = useState('');
    const svgRef = useRef(null);
    const drawingRef = useRef(false);

    const getPoint = (e) => {
        const rect = svgRef.current.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
    };

    const pointerDown = (e) => {
        e.target.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        currentPointsRef.current = [getPoint(e)];
        setCurrentPath(getSvgPathFromStroke(getStroke(currentPointsRef.current, DEFAULT_STROKE_OPTIONS)));
    };

    const pointerMove = (e) => {
        if (!drawingRef.current) return;
        currentPointsRef.current = [...currentPointsRef.current, getPoint(e)];
        setCurrentPath(getSvgPathFromStroke(getStroke(currentPointsRef.current, DEFAULT_STROKE_OPTIONS)));
    };

    const pointerUp = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        const finished = currentPointsRef.current;
        currentPointsRef.current = [];
        setCurrentPath('');
        const newStrokes = [...strokes, finished];
        setStrokes(newStrokes);
        emit(newStrokes);
    };

    const emit = useCallback((allStrokes) => {
        if (!onChange) return;
        if (allStrokes.length === 0) { onChange(null); return; }
        const paths = allStrokes.map(pts => getSvgPathFromStroke(getStroke(pts, DEFAULT_STROKE_OPTIONS)));
        const svg = [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
            ...paths.map(d => `<path d="${d}" fill="${strokeColor}" />`),
            `</svg>`,
        ].join('');

        // Rasterizar a PNG data URL (transparente) vía canvas — Dompdf lo renderiza fiable
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const png = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            onChange({ svg, png });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            onChange({ svg, png: null });
        };
        img.src = url;
    }, [onChange, width, height, strokeColor]);

    const clear = () => {
        setStrokes([]);
        setCurrentPath('');
        currentPointsRef.current = [];
        if (onChange) onChange(null);
    };

    const undo = () => {
        const newStrokes = strokes.slice(0, -1);
        setStrokes(newStrokes);
        emit(newStrokes);
    };

    const committedPaths = strokes.map(pts => getSvgPathFromStroke(getStroke(pts, DEFAULT_STROKE_OPTIONS)));

    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerLeave={pointerUp}
                style={{
                    border: '1px dashed var(--border-color, #999)',
                    borderRadius: '8px',
                    background: 'var(--bg-input, #fff)',
                    touchAction: 'none',
                    cursor: 'crosshair',
                }}
            >
                {committedPaths.map((d, i) => (
                    <path key={i} d={d} fill={strokeColor} />
                ))}
                {currentPath && <path d={currentPath} fill={strokeColor} />}
            </svg>
            <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="button" variant="secondary" onClick={undo} disabled={strokes.length === 0}>
                    Deshacer último trazo
                </Button>
                <Button type="button" variant="danger" onClick={clear} disabled={strokes.length === 0 && !currentPath}>
                    Limpiar
                </Button>
            </div>
        </div>
    );
};

export default LiquidSignaturePad;
