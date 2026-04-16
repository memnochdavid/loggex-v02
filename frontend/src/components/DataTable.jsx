import React, { useState } from 'react';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown } from 'lucide-react';
import AccordionView from './AccordionView';
import { TableSkeleton, MobileListSkeleton } from './Skeleton';
import ThemedSelect from './ThemedSelect';
import useMediaQuery from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
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
                        <span>{t('dataTable.rows')}</span>
                        <ThemedSelect
                            value={itemsPerPage}
                            onChange={(v) => onItemsPerPageChange && onItemsPerPageChange(Number(v))}
                            options={options.map(o => ({ value: o, label: String(o) }))}
                            disabled={loading}
                            minWidth={72}
                            placement={position === 'bottom' ? 'top' : 'bottom'}
                            ariaLabel={t('dataTable.rows')}
                        />
                    </div>
                    <div className={styles.pageInfo}>
                        {totalItems > 0 ? `${startItem}-${endItem} ${t('common.of')} ${totalItems}` : '0 de 0'}
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
                        {t('dataTable.page')} {currentPage} {totalPages > 0 ? `${t('common.of')} ${totalPages}` : ''}
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
        <div className={styles.container}>
            {!isMobile ? (
                /* Vista Escritorio */
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
                                {/* Caso 1: Cargando — skeleton siempre que loading (también al paginar/filtrar) */}
                                {loading ? (
                                    <TableSkeleton
                                        columns={columns.length}
                                        rows={Math.min(itemsPerPage || 5, 8)}
                                        tdClassName={styles.td}
                                    />
                                ) : noDataAvailable ? (
                                    /* Caso 2: Sin datos y sin cargar */
                                    <tr>
                                        <td colSpan={columns.length} className={styles.emptyState} style={{ textAlign: 'center', padding: '3rem' }}>
                                            {t('dataTable.noData')}
                                        </td>
                                    </tr>
                                ) : (
                                    /* Caso 3: Datos disponibles */
                                    data.map((row, rowIndex) => (
                                        <tr key={row.id || row['@id'] || rowIndex} className={styles.dataRow}>
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
                <div className={styles.mobileView}>
                    <div className={styles.mobileContainer}>
                        <div className={styles.mobilePaginationContainer}>
                            {renderPagination('top')}
                        </div>

                        {loading ? (
                            <MobileListSkeleton rows={4} />
                        ) : noDataAvailable ? (
                            <div className={styles.emptyState} style={{ padding: '2rem', textAlign: 'center' }}>
                                {t('dataTable.noData')}
                            </div>
                        ) : (
                            <AccordionView 
                                data={data}
                                expandedId={expandedId}
                                onToggle={handleToggle}
                                renderHeader={(row) => {
                                    const headerCols = columns.slice(0, mobileHeaderColumns);
                                    // Buscar la columna de acciones (asumiendo que es la última o tiene header 'Acciones')
                                    const actionsCol = columns.find(col => col.header === 'Acciones' || col.accessor === 'actions' || col.header === t('common.actions'));
                                    
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
                                        {columns.slice(mobileHeaderColumns).filter(col => col.header !== 'Acciones' && col.accessor !== 'actions' && col.header !== t('common.actions')).map((col, index) => (
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
