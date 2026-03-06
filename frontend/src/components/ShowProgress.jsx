import React from 'react';
import styles from './ShowProgress.module.css';

const ShowProgress = ({ percentage, height = '6px', showLabel = true }) => {
    // Asegurar que el porcentaje esté entre 0 y 100
    const validPercentage = Math.min(Math.max(percentage || 0, 0), 100);

    // Determinar color basado en la gravedad de las faltas
    const getColor = (p) => {
        if (p <= 15) return 'var(--color-success, #10b981)'; // <= 15% Verde
        if (p <= 25) return 'var(--color-warning, #f59e0b)'; // <= 25% Amarillo
        return 'var(--color-error, #ef4444)';               // > 25% Rojo
    };

    const color = getColor(validPercentage);

    return (
        <div className={styles.wrapper}>
            <div className={styles.track} style={{ height }}>
                <div 
                    className={styles.bar} 
                    style={{ 
                        width: `${validPercentage}%`,
                        backgroundColor: color
                    }} 
                />
            </div>
            {showLabel && (
                <span className={styles.label}>
                    {validPercentage}%
                </span>
            )}
        </div>
    );
};

export default ShowProgress;
