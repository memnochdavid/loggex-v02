import React from 'react';
import styles from './CrudHeader.module.css';

const CrudHeader = ({ title, subtitle, logo, children }) => {
    return (
        <div className={styles.container}>
            <div className={styles.titleGroup}>
                {logo && (
                    <div className={styles.logoContainer}>
                        {typeof logo === 'string' ? (
                            <img src={logo} alt="Logo" className={styles.logo} />
                        ) : (
                            logo
                        )}
                    </div>
                )}
                <div className={styles.textContainer}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            </div>
            <div className={styles.actions}>
                {children}
            </div>
        </div>
    );
};

export default CrudHeader;
