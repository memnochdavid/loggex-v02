import React from 'react';
import Lottie from 'lottie-react';
import nodataAnimation from '../../public/nodata.json';
import styles from './EmptyState.module.css';
import loadingStyles from './LoadingView.module.css';
import Button from './Button';
import { useTranslation } from 'react-i18next';

const EmptyState = ({ title, description, actionLabel, onAction, icon: Icon }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={`${styles.lottieWrapper} ${loadingStyles.lottieThemed}`}>
                <Lottie animationData={nodataAnimation} loop style={{ width: 120, height: 120 }} />
            </div>
            {Icon && (
                <div className={styles.iconWrapper}>
                    <Icon size={28} />
                </div>
            )}
            <span className={styles.title}>{title || t('emptyState.title')}</span>
            {description && <span className={styles.description}>{description}</span>}
            {actionLabel && onAction && (
                <Button variant="primary" onClick={onAction} className={styles.action}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
