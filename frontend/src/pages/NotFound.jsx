import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import styles from './NotFound.module.css';
import Button from '../components/Button';
import { getAssetUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const { t } = useTranslation();
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(getAssetUrl('/404.json'))
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error("Error loading lottie:", error));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.lottieContainer}>
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <h1 className={styles.errorCode}>404</h1>
        )}
      </div>

      <h2 className={styles.title}>{t('notFound.title')}</h2>
      <p className={styles.message}>
        {t('notFound.message')}
      </p>
      
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button>
          {t('notFound.goHome')}
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
