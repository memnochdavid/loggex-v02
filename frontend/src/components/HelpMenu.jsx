import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Check, Play, RotateCcw, Bell, BellOff } from 'lucide-react';
import ModalView from './ModalView';
import Button from './Button';
import { useTour } from '../context/TourContext';
import styles from './HelpMenu.module.css';

/**
 * Modal con la lista de tutoriales disponibles para el rol del usuario.
 * Se apoya en ModalView — hereda header/footer/body con las variables de
 * tema del centro, focus trap, ESC, scroll lock y animaciones.
 */
const HelpMenu = ({ open, onClose }) => {
    const { t } = useTranslation();
    const {
        availableTours, isCompleted, startTour, resetTours,
        badgesEnabled, setBadges,
    } = useTour();
    const [confirmReset, setConfirmReset] = useState(false);

    const handleStart = (id) => {
        onClose();
        /* Pequeño delay para que el modal termine su animación de cierre
           antes de que Joyride pinte el primer tooltip. */
        setTimeout(() => startTour(id), 200);
    };

    const handleReset = () => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }
        resetTours();
        setConfirmReset(false);
    };

    return (
        <ModalView
            isOpen={open}
            onClose={onClose}
            title={t('helpMenu.title')}
            size="medium"
            headerIcon={<GraduationCap size={22} />}
            footer={
                <div className={styles.footerRow}>
                    <label className={styles.badgeToggle}>
                        <input
                            type="checkbox"
                            checked={badgesEnabled}
                            onChange={(e) => setBadges(e.target.checked)}
                        />
                        <span className={styles.badgeToggleTrack}>
                            <span className={styles.badgeToggleThumb} />
                        </span>
                        <span className={styles.badgeToggleLabel}>
                            {badgesEnabled ? <Bell size={12} /> : <BellOff size={12} />}
                            {t('helpMenu.badgesToggle')}
                        </span>
                    </label>

                    <Button
                        type="button"
                        variant={confirmReset ? 'danger' : 'secondary'}
                        onClick={handleReset}
                        onBlur={() => setConfirmReset(false)}
                    >
                        <RotateCcw size={14} style={{ marginRight: 6 }} />
                        {confirmReset ? t('helpMenu.resetConfirm') : t('helpMenu.reset')}
                    </Button>
                </div>
            }
        >
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
                                    <div className={styles.itemHeadline}>
                                        <span className={styles.itemTitle}>
                                            {t(tour.titleKey)}
                                        </span>
                                        {done && (
                                            <span className={styles.doneChip} title={t('helpMenu.alreadySeen')}>
                                                <Check size={11} />
                                                {t('helpMenu.seen')}
                                            </span>
                                        )}
                                    </div>
                                    {tour.descKey && (
                                        <span className={styles.itemDesc}>
                                            {t(tour.descKey)}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.itemActions}>
                                    <Button
                                        type="button"
                                        variant={done ? 'secondary' : 'primary'}
                                        onClick={() => handleStart(tour.id)}
                                    >
                                        <Play size={13} style={{ marginRight: 6 }} />
                                        {done ? t('helpMenu.replay') : t('helpMenu.start')}
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </ModalView>
    );
};

export default HelpMenu;
