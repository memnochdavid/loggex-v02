import React, { useMemo } from 'react';
import styles from './SkeletonRow.module.css';

const WIDTHS = [85, 70, 60, 90, 75, 65, 80, 55];

const SkeletonRow = ({ columns = 4, rows = 5 }) => {
    const widths = useMemo(() =>
        Array.from({ length: rows }, (_, r) =>
            Array.from({ length: columns }, (_, c) => WIDTHS[(r * columns + c) % WIDTHS.length])
        ),
    [columns, rows]);

    return (
        <>
            {widths.map((rowWidths, rowIndex) => (
                <tr key={rowIndex} className={styles.row}>
                    {rowWidths.map((w, colIndex) => (
                        <td key={colIndex} className={styles.cell}>
                            <div
                                className={styles.bone}
                                style={{ width: `${w}%` }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
};

const SkeletonCard = ({ count = 5 }) => {
    return (
        <div className={styles.cardContainer}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.bone} style={{ width: '60%', height: 16 }} />
                        <div className={styles.bone} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export { SkeletonRow, SkeletonCard };
export default SkeletonRow;
