import React from 'react';
import styles from './ProfLoadPanel.module.css';

/**
 * Panel de carga semanal del profesorado. Dos columnas.
 *
 * Props:
 *   profeCarga: [{ profe, total, enOtros, enActual }, ...]
 *   max:        horas máximo semana contractual (default 40)
 */
const ProfLoadPanel = ({ profeCarga = [], max = 40 }) => {
    if (!profeCarga.length) return null;

    const itemFor = ({ profe, total, enOtros, enActual }) => {
        const pct = Math.min(100, (total / max) * 100);
        const overflow = Math.max(0, total - max);
        let cls = styles.barOk;
        if (total > max)           cls = styles.barOver;
        else if (total >= max - 4) cls = styles.barHigh;
        else if (total >= max * 0.6) cls = styles.barMid;
        const nombre = `${profe.nombre || ''} ${profe.apellidos || ''}`.trim();
        return (
            <div key={profe.id} className={styles.row}
                 title={`En este grupo: ${enActual}h · En otros: ${enOtros}h`}>
                <div className={styles.name}>{nombre}</div>
                <div className={styles.track}>
                    <div className={`${styles.fill} ${cls}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={styles.counter}>
                    {total}/{max}
                    {overflow > 0 && <span className={styles.overflow}> +{overflow}h extra</span>}
                </div>
            </div>
        );
    };

    return (
        <section className={styles.container}>
            <header className={styles.header}>
                <h3 className={styles.title}>Carga semanal del profesorado</h3>
                <span className={styles.subtitle}>
                    Máx. {max} h/sem. &middot; Horas extra permitidas hasta 80 h anuales
                </span>
            </header>
            <div className={styles.grid}>
                {profeCarga.map(itemFor)}
            </div>
        </section>
    );
};

export default ProfLoadPanel;
