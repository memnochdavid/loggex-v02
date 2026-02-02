import React, { useState } from 'react';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

/**
 * Componente interno para la vista móvil de una fila (tarjeta)
 */
const MobileCard = ({ row, columns }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Usamos la primera columna como título, y el resto como contenido
    const titleColumn = columns[0];
    const contentColumns = columns.slice(1);

    const getCellValue = (col, row) => {
        if (typeof col.accessor === 'function') {
            return col.accessor(row);
        }
        return row[col.accessor];
    };

    return (
        <div className={styles.mobileCard}>
            <div 
                className={`${styles.mobileCardHeader} ${isOpen ? styles.expanded : ''}`} 
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>
                    {getCellValue(titleColumn, row)}
                </span>
                <ChevronDown 
                    size={20} 
                    className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
                />
            </div>
            
            {isOpen && (
                <div className={styles.mobileCardContent}>
                    {contentColumns.map((col, index) => (
                        <div key={index} className={styles.mobileRow}>
                            <span className={styles.mobileLabel}>{col.header}</span>
                            <span className={styles.mobileValue}>
                                {getCellValue(col, row)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * @param {Array} columns - Array de objetos { header: string, accessor: string | function, className?: string, sortable?: boolean, sortKey?: string }
 * @param {Array} data - Array de datos a mostrar
 * @param {number} totalItems - Total de elementos en el servidor
 * @param {number} itemsPerPage - Elementos por página
 * @param {number} currentPage - Página actual (1-based)
 * @param {function} onPageChange - Callback cuando cambia la página
 * @param {function} onItemsPerPageChange - Callback cuando cambia el número de items por página
 * @param {boolean} loading - Estado de carga
 * @param {string} sortColumn - Clave de la columna actual ordenada
 * @param {string} sortDirection - 'asc' o 'desc'
 * @param {function} onSort - Callback cuando se ordena (columnKey)
 * @param {Array} pageSizeOptions - Opciones para el selector de tamaño de página
 */
const DataTable = ({ 
    columns, 
    data, 
    totalItems, 
    itemsPerPage, 
    currentPage, 
    onPageChange,
    onItemsPerPageChange,
    loading,
    sortColumn,
    sortDirection,
    onSort,
    pageSizeOptions = [10, 20, 30, 50, 100]
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Asegurar que itemsPerPage esté en las opciones
    const options = [...new Set([...pageSizeOptions, itemsPerPage])].sort((a, b) => a - b);

    const handleSort = (column) => {
        if (!column.sortable || !onSort) return;
        const key = column.sortKey || (typeof column.accessor === 'string' ? column.accessor : null);
        if (key) {
            onSort(key);
        }
    };

    const handleItemsPerPageChange = (e) => {
        if (onItemsPerPageChange) {
            onItemsPerPageChange(Number(e.target.value));
        }
    };

    const renderPagination = (position) => {
        if (totalItems === 0) return null;
        
        return (
            <div className={`${styles.pagination} ${position === 'top' ? styles.paginationTop : styles.paginationBottom}`}>
                <div className={styles.paginationControls}>
                    <div className={styles.itemsPerPage}>
                        <span>Filas:</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={handleItemsPerPageChange}
                            className={styles.select}
                            disabled={loading}
                        >
                            {options.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.pageInfo}>
                        {startItem}-{endItem} de {totalItems}
                    </div>
                </div>
                
                <div className={styles.pageButtons}>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1 || loading}
                        aria-label="Primera página"
                        title="Primera página"
                    >
                        <ChevronsLeft size={16} />
                    </button>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        aria-label="Página anterior"
                        title="Página anterior"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <span className={styles.pageNumber}>
                        Página {currentPage} de {totalPages}
                    </span>

                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        aria-label="Página siguiente"
                        title="Página siguiente"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage >= totalPages || loading}
                        aria-label="Última página"
                        title="Última página"
                    >
                        <ChevronsRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    if (!loading && (!data || data.length === 0)) {
        return (
            <div className={styles.container}>
                <div className={styles.desktopView}>
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
                            <tr>
                                <td colSpan={columns.length} className={styles.emptyState}>
                                    No hay datos disponibles.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className={styles.mobileView}>
                    <div className={styles.emptyState}>No hay datos disponibles.</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Vista Escritorio */}
            <div className={styles.desktopView}>
                {renderPagination('top')}
                
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                {columns.map((col, index) => {
                                    const isSorted = sortColumn === (col.sortKey || col.accessor);
                                    
                                    return (
                                        <th 
                                            key={index} 
                                            className={`${styles.th} ${col.className || ''} ${col.sortable ? styles.sortable : ''}`}
                                            onClick={() => col.sortable && handleSort(col)}
                                        >
                                            <div className={styles.thContent}>
                                                {col.header}
                                                {isSorted && (
                                                    <span className={styles.sortIcon}>
                                                        {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
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
                </div>

                {renderPagination('bottom')}
            </div>

            {/* Vista Móvil */}
            <div className={styles.mobileView}>
                <div className={styles.mobileContainer}>
                    {loading ? (
                        <div className={styles.emptyState}>Cargando datos...</div>
                    ) : (
                        data.map((row, index) => (
                            <MobileCard 
                                key={row.id || row['@id'] || index} 
                                row={row} 
                                columns={columns} 
                            />
                        ))
                    )}
                    
                    <div className={styles.mobilePaginationContainer}>
                        {renderPagination('bottom')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
