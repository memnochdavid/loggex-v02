import React, { useEffect, useRef, useState } from 'react';
import styles from './MateriaLabel.module.css';

/**
 * Muestra `materia.nombre` por defecto y cambia a `materia.abreviatura` cuando
 * el ancho disponible no da para mostrar el nombre completo. Sin cambio circular:
 * un nodo oculto con el nombre completo se usa para medir el ancho necesario,
 * así la decisión sólo depende del ancho del contenedor (no del texto visible).
 *
 * Uso:
 *   <MateriaLabel materia={materia} />
 *   <MateriaLabel materia={{ nombre, abreviatura }} />
 */
const MateriaLabel = ({ materia, className = '' }) => {
    const nombre = materia?.nombre || '';
    const abrev = materia?.abreviatura;
    const [useShort, setUseShort] = useState(false);
    const containerRef = useRef(null);
    const measureRef = useRef(null);

    useEffect(() => {
        if (!abrev || !containerRef.current || !measureRef.current) return;
        const container = containerRef.current;
        const measure = measureRef.current;
        const check = () => {
            const available = container.clientWidth;
            const needed = measure.scrollWidth;
            setUseShort(needed > available + 1);
        };
        check();
        const observer = new ResizeObserver(check);
        observer.observe(container);
        return () => observer.disconnect();
    }, [abrev, nombre]);

    if (!abrev) {
        return <span className={className} title={nombre}>{nombre}</span>;
    }

    return (
        <span
            ref={containerRef}
            className={`${styles.wrap} ${className}`}
            title={nombre}
        >
            <span ref={measureRef} className={styles.measure} aria-hidden="true">
                {nombre}
            </span>
            <span className={styles.visible}>
                {useShort ? abrev : nombre}
            </span>
        </span>
    );
};

export default MateriaLabel;
