import React from 'react';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown } from 'lucide-react';
import AccordionView from './AccordionView';

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

    const getCellValue = (col, row) => {
        if (typeof col.accessor === 'function') {
            return col.accessor(row);
        }
        // Soporte para accessors anidados como 'centro.nombre'
        if (typeof col.accessor === 'string' && col.accessor.includes('.')) {
            return col.accessor.split('.').reduce((obj, key) => obj && obj[key], row);
        }
        return row[col.accessor];
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
                                                {getCellValue(col, row)}
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

            {/* Vista Móvil con AccordionView */}
            <div className={styles.mobileView}>
                <div className={styles.mobileContainer}>
                    <div className={styles.mobilePaginationContainer}>
                        {renderPagination('top')}
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>Cargando datos...</div>
                    ) : (
                        <AccordionView 
                            data={data}
                            renderHeader={(row) => {
                                // Renderizar las primeras 3 columnas en la cabecera (Avatar, Nombre, Apellidos)
                                const col0 = columns[0];
                                const col1 = columns[1];
                                const col2 = columns[2];
                                return (
                                    <div className={styles.mobileHeaderContent}>
                                        {col0 && <div className={styles.mobileHeaderAvatar}>{getCellValue(col0, row)}</div>}
                                        <div className={styles.mobileHeaderText}>
                                            {col1 && <span>{getCellValue(col1, row)}</span>}
                                            {col2 && <span style={{ marginLeft: '4px' }}>{getCellValue(col2, row)}</span>}
                                        </div>
                                    </div>
                                );
                            }}
                            renderItem={(row) => (
                                <div className={styles.mobileCardContent}>
                                    {/* Mostrar TODAS las columnas excepto la primera (Avatar/ID) en el cuerpo */}
                                    {columns.slice(1).map((col, index) => (
                                        <div key={index} className={styles.mobileRow}>
                                            <span className={styles.mobileLabel}>{col.header}</span>
                                            <span className={styles.mobileValue}>
                                                {getCellValue(col, row)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        />
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
