import React from 'react';
import styles from './Skeleton.module.css';

export const Skeleton = ({ width, height, variant = 'line', style, className = '' }) => {
    const variantClass = styles[variant] || styles.line;
    return (
        <span
            className={`${styles.skeleton} ${variantClass} ${className}`}
            style={{ width, height, ...style }}
            aria-hidden="true"
        />
    );
};

export const TableSkeleton = ({ columns = 4, rows = 5, tdClassName = '' }) => {
    const widths = ['60%', '80%', '45%', '70%', '55%', '85%', '40%', '65%'];
    return (
        <>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={r} className={styles.tableRow}>
                    {Array.from({ length: columns }).map((__, c) => (
                        <td key={c} className={tdClassName}>
                            <Skeleton
                                variant="line"
                                width={widths[(r + c) % widths.length]}
                                height="0.9em"
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
};

export const MobileListSkeleton = ({ rows = 4 }) => (
    <>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={styles.mobileCard}>
                <div className={styles.cardHeader}>
                    <Skeleton variant="circle" width="36px" height="36px" />
                    <Skeleton variant="line" width="60%" height="1em" />
                </div>
                <Skeleton variant="line" width="85%" height="0.8em" />
                <Skeleton variant="line" width="40%" height="0.8em" />
            </div>
        ))}
    </>
);

export default Skeleton;
