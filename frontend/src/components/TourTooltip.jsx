import React from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import styles from './TourTooltip.module.css';

/**
 * Tooltip personalizado para react-joyride. Sustituye al default de la
 * librería para que los tooltips hereden las variables de tema del centro
 * (colores, radios, tipografía, tamaños) en lugar de los defaults hard-coded.
 *
 * react-joyride pasa `backProps`, `primaryProps`, `skipProps`, `closeProps`
 * ya con sus handlers y aria-labels listos — solo tenemos que pintarlos.
 */
const TourTooltip = ({
    continuous,
    index,
    size,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    isLastStep,
}) => {
    const showBack = index > 0;
    const showSkip = !!skipProps && !isLastStep;
    /* Cuando `continuous` es true Joyride expone primaryProps como
       "Siguiente" o "Finalizar"; si es false, muestra "Cerrar" (closeProps). */
    const primary = continuous ? primaryProps : closeProps;

    return (
        <div {...tooltipProps} className={styles.tooltip}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    {step.title && (
                        <h4 className={styles.title}>{step.title}</h4>
                    )}
                    <span className={styles.progress}>
                        {index + 1} / {size}
                    </span>
                </div>
                {skipProps && (
                    <button
                        {...skipProps}
                        className={styles.closeBtn}
                        aria-label={skipProps['aria-label'] || 'Cerrar'}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <div className={styles.content}>
                {step.content}
            </div>

            {/* Progress bar fina sobre el footer */}
            <div className={styles.progressTrack} aria-hidden="true">
                <div
                    className={styles.progressFill}
                    style={{ width: `${((index + 1) / size) * 100}%` }}
                />
            </div>

            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    {showSkip && (
                        <button
                            {...skipProps}
                            className={styles.skipBtn}
                        >
                            {skipProps.title}
                        </button>
                    )}
                </div>

                <div className={styles.footerRight}>
                    {showBack && (
                        <Button
                            type="button"
                            variant="secondary"
                            {...backProps}
                        >
                            {backProps.title}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="primary"
                        {...primary}
                    >
                        {primary.title}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TourTooltip;
