import React from 'react';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @param {Array} columns - Array de objetos { header: string, accessor: string | function, className?: string }
 * @param {Array} data - Array de datos a mostrar
 * @param {number} totalItems - Total de elementos en el servidor
 * @param {number} itemsPerPage - Elementos por página
 * @param {number} currentPage - Página actual (1-based)
 * @param {function} onPageChange - Callback cuando cambia la página
 * @param {boolean} loading - Estado de carga
 */
const DataTable = ({ 
    columns, 
    data, 
    totalItems, 
    itemsPerPage, 
    currentPage, 
    onPageChange,
    loading 
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    if (!loading && (!data || data.length === 0)) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>No hay datos disponibles.</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <table className={styles.table}>
                <thead className={styles.thead}>
                    <tr>
                        {columns.map((col, index) => (
                            <th key={index} className={`${styles.th} ${col.className || ''}`}>
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className={styles.tbody}>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className={styles.td} style={{ textAlign: 'center', padding: '2rem' }}>
                                Cargando datos...
                            </td>
                        </tr>
                    ) : (
                        data.map((row, rowIndex) => (
                            <tr key={row.id || row['@id'] || rowIndex}>
                                {columns.map((col, colIndex) => (
                                    <td key={colIndex} className={`${styles.td} ${col.className || ''}`}>
                                        {typeof col.accessor === 'function' 
                                            ? col.accessor(row) 
                                            : row[col.accessor]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {totalItems > 0 && (
                <div className={styles.pagination}>
                    <div className={styles.pageInfo}>
                        Mostrando <strong>{startItem}-{endItem}</strong> de <strong>{totalItems}</strong>
                    </div>
                    <div className={styles.pageButtons}>
                        <button 
                            className={styles.pageButton} 
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            className={styles.pageButton} 
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages || loading}
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
