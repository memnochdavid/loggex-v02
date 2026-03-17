import React from 'react';
import styles from './AuroraBackground.module.css';

const AuroraBackground = () => {
    return (
        <>
            <div className={styles.base} />
            <div className={styles.blob1} />
            <div className={styles.blob2} />
            <div className={styles.blob3} />
            <div className={styles.blob4} />
            <div className={styles.blob5} />
            <div className={styles.blob6} />
            <div className={styles.highlight} />
            <div className={styles.noise} />
        </>
    );
};

export default AuroraBackground;
