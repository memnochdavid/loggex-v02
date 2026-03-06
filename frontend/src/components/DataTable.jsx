import React, { useState } from 'react';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import AccordionView from './AccordionView';
import useMediaQuery from '../hooks/useMediaQuery';

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
 * @param {string} mobileBreakpoint - Breakpoint para cambiar a vista móvil (ej: '768px', '1024px')
 * @param {number} mobileHeaderColumns - Número de columnas a mostrar en la cabecera del acordeón móvil (default: 1)
 */
const DataTable = ({ 
    columns, 
    data, 
    totalItems, 
    itemsPerPage, 
    currentPage, 
    onPageChange,
    onItemsPerPageChange,
    loading, // Único estado de carga
    sortColumn,
    sortDirection,
    onSort,
    pageSizeOptions = [10, 20, 30, 50, 100],
    mobileBreakpoint = '768px',
    mobileHeaderColumns = 1
}) => {
    const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint})`);
    const [expandedId, setExpandedId] = useState(null);

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

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
        if (typeof col.accessor === 'string' && col.accessor.includes('.')) {
            return col.accessor.split('.').reduce((obj, key) => obj && obj[key], row);
        }
        return row[col.accessor];
    };

    const handleToggle = (id) => {
        setExpandedId(prevId => (prevId === id ? null : id));
    };

    const renderPagination = (position) => {
        // Mostrar paginación incluso si no hay items (pero deshabilitada) para mantener altura
        if (totalItems === 0 && !loading) return null;
        
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
                        {totalItems > 0 ? `${startItem}-${endItem} de ${totalItems}` : '0 de 0'}
                    </div>
                </div>
                
                <div className={styles.pageButtons}>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1 || loading || totalItems === 0}
                    >
                        <ChevronsLeft size={16} />
                    </button>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading || totalItems === 0}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <span className={styles.pageNumber}>
                        Página {currentPage} {totalPages > 0 ? `de ${totalPages}` : ''}
                    </span>

                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading || totalItems === 0}
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button 
                        className={styles.pageButton} 
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage >= totalPages || loading || totalItems === 0}
                    >
                        <ChevronsRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    // Determinar si estamos en estado "sin datos" (loading=false y data vacía)
    const noDataAvailable = !loading && (!data || data.length === 0);

    return (
        <div className={styles.container} style={{ position: 'relative', minHeight: '200px' }}>
            {/* Overlay de carga sutil si loading es true Y hay datos previos */}
            {loading && data && data.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}>
                    <Loader2 className="animate-spin" size={32} color="#4f46e5" />
                </div>
            )}

            {!isMobile ? (
                /* Vista Escritorio */
                <div className={styles.desktopView} style={{ opacity: loading && data && data.length > 0 ? 0.5 : 1, transition: 'opacity 0.2s' }}>
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
                                {/* Caso 1: Cargando y sin datos previos */}
                                {loading && (!data || data.length === 0) ? (
                                    <tr>
                                        <td colSpan={columns.length} className={styles.td} style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                                <Loader2 className="animate-spin" size={24} />
                                                <span>Cargando datos...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : noDataAvailable ? (
                                    /* Caso 2: Sin datos y sin cargar */
                                    <tr>
                                        <td colSpan={columns.length} className={styles.emptyState} style={{ textAlign: 'center', padding: '3rem' }}>
                                            No hay datos disponibles.
                                        </td>
                                    </tr>
                                ) : (
                                    /* Caso 3: Datos disponibles */
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
            ) : (
                /* Vista Móvil */
                <div className={styles.mobileView} style={{ opacity: loading && data && data.length > 0 ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    <div className={styles.mobileContainer}>
                        <div className={styles.mobilePaginationContainer}>
                            {renderPagination('top')}
                        </div>

                        {loading && (!data || data.length === 0) ? (
                            <div className={styles.emptyState} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                                <Loader2 className="animate-spin" size={24} />
                                <span>Cargando datos...</span>
                            </div>
                        ) : noDataAvailable ? (
                            <div className={styles.emptyState} style={{ padding: '2rem', textAlign: 'center' }}>
                                No hay datos disponibles.
                            </div>
                        ) : (
                            <AccordionView 
                                data={data}
                                expandedId={expandedId}
                                onToggle={handleToggle}
                                renderHeader={(row) => {
                                    const headerCols = columns.slice(0, mobileHeaderColumns);
                                    // Buscar la columna de acciones (asumiendo que es la última o tiene header 'Acciones')
                                    const actionsCol = columns.find(col => col.header === 'Acciones' || col.accessor === 'actions');
                                    
                                    return (
                                        <div className={styles.mobileHeaderContent}>
                                            <div className={styles.mobileHeaderInfo}>
                                                {headerCols.map((col, idx) => (
                                                    <div key={idx} className={idx === 0 ? styles.mobileHeaderAvatar : styles.mobileHeaderText}>
                                                        {getCellValue(col, row)}
                                                    </div>
                                                ))}
                                            </div>
                                            {actionsCol && (
                                                <div className={styles.mobileHeaderActions} onClick={(e) => e.stopPropagation()}>
                                                    {getCellValue(actionsCol, row)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }}
                                renderItem={(row) => (
                                    <div className={styles.mobileCardContent}>
                                        {columns.slice(mobileHeaderColumns).filter(col => col.header !== 'Acciones' && col.accessor !== 'actions').map((col, index) => (
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
            )}
        </div>
    );
};

export default DataTable;
