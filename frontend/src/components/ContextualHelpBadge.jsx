import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Play, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTour } from '../context/TourContext';
import styles from './ContextualHelpBadge.module.css';

/**
 * Badge flotante (abajo-derecha) que se renderiza cuando el TourContext
 * detecta un tour con trigger.route matching y el user no lo ha completado.
 *
 * Dos acciones:
 *  · "Mostrar"    → startTour(id)
 *  · "No, gracias" → dismissTour(id)  (marcado como completado → no vuelve a salir)
 *
 * Se auto-oculta cuando cambia el candidato (navegación a otra ruta) y tiene
 * un pequeño delay al entrar para que no salga instantáneo en cada clic de nav.
 */
const ContextualHelpBadge = () => {
    const { t } = useTranslation();
    const { badgeCandidate, startTour, dismissTour, location } = useTour();
    const [visible, setVisible] = useState(false);
    /* Evita que el badge parpadee al cambiar de ruta rápidamente: tras un
       cambio de pathname damos 700ms antes de mostrar el nuevo. */
    const showTimerRef = useRef(null);

    useEffect(() => {
        /* Limpia timer al cambiar candidato/ruta para no meter delays colgados. */
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }

        if (!badgeCandidate) {
            setVisible(false);
            return;
        }

        showTimerRef.current = setTimeout(() => {
            setVisible(true);
        }, 700);

        return () => {
            if (showTimerRef.current) clearTimeout(showTimerRef.current);
        };
    }, [badgeCandidate, location.pathname]);

    if (!badgeCandidate) return null;

    const handleAccept = () => {
        setVisible(false);
        /* Pequeño delay para que la animación de salida del badge termine
           antes de que Joyride pinte el primer tooltip. */
        setTimeout(() => startTour(badgeCandidate.id), 180);
    };

    const handleDismiss = () => {
        setVisible(false);
        dismissTour(badgeCandidate.id);
    };

    const badge = (
        <div className={`${styles.wrapper} ${visible ? styles.wrapperVisible : ''}`}>
            <div className={styles.card} role="dialog" aria-live="polite">
                <button
                    className={styles.closeBtn}
                    onClick={handleDismiss}
                    aria-label={t('contextualBadge.close')}
                >
                    <X size={14} />
                </button>

                <div className={styles.header}>
                    <div className={styles.iconWrap}>
                        <GraduationCap size={18} />
                    </div>
                    <div className={styles.headerText}>
                        <span className={styles.label}>{t('contextualBadge.label')}</span>
                        <h4 className={styles.title}>{t(badgeCandidate.titleKey)}</h4>
                    </div>
                </div>

                {badgeCandidate.descKey && (
                    <p className={styles.desc}>{t(badgeCandidate.descKey)}</p>
                )}

                <div className={styles.meta}>
                    <span className={styles.stepsChip}>
                        {t('contextualBadge.stepsCount', { count: badgeCandidate.steps.length })}
                    </span>
                </div>

                <div className={styles.actions}>
                    <button
                        className={styles.dismissBtn}
                        onClick={handleDismiss}
                    >
                        {t('contextualBadge.dismiss')}
                    </button>
                    <button
                        className={styles.acceptBtn}
                        onClick={handleAccept}
                    >
                        <Play size={12} />
                        {t('contextualBadge.show')}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(badge, document.body);
};

export default ContextualHelpBadge;
