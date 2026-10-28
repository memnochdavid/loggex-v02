import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../../public/loading.json';
import { useTranslation } from 'react-i18next';
import styles from './LoadingView.module.css';

const LoadingView = ({ text }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.lottieThemed}>
                <Lottie animationData={loadingAnimation} loop style={{ width: 100, height: 100 }} />
            </div>
            <span>{text || t('common.loading')}</span>
        </div>
    );
};

export default LoadingView;
