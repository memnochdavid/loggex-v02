import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Check, Play, X, RotateCcw } from 'lucide-react';
import { useTour } from '../context/TourContext';
import styles from './HelpMenu.module.css';

/**
 * Modal accesible desde el menú del UserAvatar — lista todos los tours
 * disponibles para el rol del usuario, con indicador "ya visto" y botón
 * para relanzarlos. Incluye también un reset del progreso (útil para QA
 * y demos).
 *
 * El componente se controla externamente con `open` + `onClose` para que
 * el botón que lo abre quede en la jerarquía del menú existente.
 */
const HelpMenu = ({ open, onClose }) => {
    const { t } = useTranslation();
    const { availableTours, isCompleted, startTour, resetTours } = useTour();
    const [confirmReset, setConfirmReset] = useState(false);

    if (!open) return null;

    const handleStart = (id) => {
        onClose();
        /* Pequeño delay para que el modal cierre limpio antes de que
           Joyride pinte el primer tooltip. */
        setTimeout(() => startTour(id), 150);
    };

    const handleReset = () => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }
        resetTours();
        setConfirmReset(false);
    };

    const modal = (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <header className={styles.header}>
                    <div className={styles.headerTitle}>
                        <GraduationCap size={18} />
                        <h3>{t('helpMenu.title')}</h3>
                    </div>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label={t('helpMenu.close')}
                    >
                        <X size={18} />
                    </button>
                </header>

                <p className={styles.intro}>{t('helpMenu.intro')}</p>

                {availableTours.length === 0 ? (
                    <p className={styles.empty}>{t('helpMenu.empty')}</p>
                ) : (
                    <ul className={styles.list}>
                        {availableTours.map((tour) => {
                            const done = isCompleted(tour.id);
                            return (
                                <li key={tour.id} className={styles.item}>
                                    <div className={styles.itemMain}>
                                        <span className={styles.itemTitle}>
                                            {t(tour.titleKey)}
                                        </span>
                                        {tour.descKey && (
                                            <span className={styles.itemDesc}>
                                                {t(tour.descKey)}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.itemActions}>
                                        {done && (
                                            <span className={styles.doneChip} title={t('helpMenu.alreadySeen')}>
                                                <Check size={12} />
                                                {t('helpMenu.seen')}
                                            </span>
                                        )}
                                        <button
                                            className={styles.startBtn}
                                            onClick={() => handleStart(tour.id)}
                                        >
                                            <Play size={12} />
                                            {done ? t('helpMenu.replay') : t('helpMenu.start')}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <footer className={styles.footer}>
                    <button
                        className={`${styles.resetBtn} ${confirmReset ? styles.resetBtnConfirm : ''}`}
                        onClick={handleReset}
                        onBlur={() => setConfirmReset(false)}
                    >
                        <RotateCcw size={12} />
                        {confirmReset
                            ? t('helpMenu.resetConfirm')
                            : t('helpMenu.reset')}
                    </button>
                </footer>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default HelpMenu;
