import React from 'react';
import styles from './CrudHeader.module.css';

const CrudHeader = ({ title, children }) => {
    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.actions}>
                {children}
            </div>
        </div>
    );
};

export default CrudHeader;
