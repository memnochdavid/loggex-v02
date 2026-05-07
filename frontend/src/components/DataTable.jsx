import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './DataTable.module.css';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, Columns3 } from 'lucide-react';
import AccordionView from './AccordionView';
import { TableSkeleton, MobileListSkeleton } from './Skeleton';
import ThemedSelect from './ThemedSelect';
import useMediaQuery from '../hooks/useMediaQuery';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { useTranslation } from 'react-i18next';

/**
 * @param {Array} columns - Array de objetos { header: string, accessor: string | function, className?: string, sortable?: boolean, sortKey?: string, id?: string, hideable?: boolean }
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
 * @param {string} [tableId] - ID estable de la tabla. Si se define, se activa el control de visibilidad de columnas con persistencia en localStorage (clave `dataTableHiddenCols_{tableId}`).
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
    pageSizeOptions = [5, 10, 20, 30, 50, 100],
    mobileBreakpoint = '768px',
    mobileHeaderColumns = 1,
    tableId = null
}) => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint})`);
    const [expandedId, setExpandedId] = useState(null);

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const options = [...new Set([...pageSizeOptions, itemsPerPage])].sort((a, b) => a - b);

    // Identidad estable por columna: prioriza `id` explícito; si no, usa el
    // accessor cuando es string; si tampoco, cae al header. Esa cadena entra
    // como clave del set persistido en localStorage.
    const columnId = (col) => col.id
        || (typeof col.accessor === 'string' ? col.accessor : null)
        || (typeof col.header === 'string' ? col.header : '');

    const allColumnIds = columns.map(columnId);
    const [hiddenIds, toggleHidden] = useColumnVisibility(tableId, allColumnIds);
    const visibleColumns = columns.filter(c => !hiddenIds.includes(columnId(c)));

    const handleSort = (column) => {
        if (!column.sortable || !onSort) return;
        const key = column.sortKey || (typeof column.accessor === 'string' ? column.accessor : null);
        if (key) {
            onSort(key);
        }
    };

    // La columna "Acciones" se identifica por header traducido o accessor
    // === 'actions'. El detector se reutiliza para alinear cabecera+celda al
    // final (flex-end) y para extraer la columna en la vista móvil.
    const isActionsCol = (col) =>
        col.accessor === 'actions'
        || col.header === 'Acciones'
        || col.header === t('common.actions');

    // Columnas ofrecidas en el menú de visibilidad: cualquiera no marcada
    // hideable:false y que no sea la de "Acciones" (esa siempre se queda).
    const hideableColumns = columns.filter(c => c.hideable !== false && !isActionsCol(c));

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

    // Popover de selección de columnas. Se renderiza vía portal a document.body
    // con position: fixed para escapar del overflow:hidden del .container y
    // quedar siempre visible aunque la tabla termine antes verticalmente.
    // Reposiciona al scroll/resize y se cierra al click fuera o Escape.
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const columnsMenuRef = useRef(null);
    const columnsBtnRef = useRef(null);

    const updateMenuPosition = () => {
        if (!columnsBtnRef.current) return;
        const rect = columnsBtnRef.current.getBoundingClientRect();
        const menuW = columnsMenuRef.current?.offsetWidth ?? 240;
        const margin = 8;
        let left = rect.left + rect.width / 2 - menuW / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
        setMenuPos({ top: rect.bottom + 8, left });
    };

    useEffect(() => {
        if (!columnsMenuOpen) return;
        updateMenuPosition();
        const handleClickOutside = (e) => {
            if (
                columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)
                && columnsBtnRef.current && !columnsBtnRef.current.contains(e.target)
            ) {
                setColumnsMenuOpen(false);
            }
        };
        const handleEscape = (e) => { if (e.key === 'Escape') setColumnsMenuOpen(false); };
        const handleReposition = () => updateMenuPosition();
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [columnsMenuOpen]);

    const renderColumnsControl = () => {
        if (!tableId || hideableColumns.length === 0) return null;
        return (
            <div className={styles.columnsControl}>
                <button
                    ref={columnsBtnRef}
                    type="button"
                    className={styles.columnsButton}
                    onClick={() => setColumnsMenuOpen(o => !o)}
                    aria-label={t('dataTable.columns', { defaultValue: 'Columnas' })}
                    aria-expanded={columnsMenuOpen}
                    title={t('dataTable.columns', { defaultValue: 'Columnas' })}
                    disabled={loading}
                >
                    <Columns3 size={16} />
                </button>
                {columnsMenuOpen && createPortal(
                    <div
                        ref={columnsMenuRef}
                        className={styles.columnsMenu}
                        role="menu"
                        style={{ top: menuPos.top, left: menuPos.left }}
                    >
                        {hideableColumns.map((col) => {
                            const id = columnId(col);
                            const isVisible = !hiddenIds.includes(id);
                            return (
                                <label key={id} className={styles.columnsMenuItem}>
                                    <input
                                        type="checkbox"
                                        className={styles.columnsCheckbox}
                                        checked={isVisible}
                                        onChange={() => toggleHidden(id)}
                                    />
                                    <span className={styles.columnsMenuLabel}>{col.header}</span>
                                </label>
                            );
                        })}
                    </div>,
                    document.body
                )}
            </div>
        );
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

                {position === 'top' && (
                    <div className={styles.columnsCenter}>
                        {renderColumnsControl()}
                    </div>
                )}
                
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
                                    {visibleColumns.map((col, index) => {
                                        const isSorted = sortColumn === (col.sortKey || col.accessor);
                                        const actionsClass = isActionsCol(col) ? styles.actionsCol : '';

                                        return (
                                            <th
                                                key={index}
                                                className={`${styles.th} ${col.className || ''} ${col.sortable ? styles.sortable : ''} ${actionsClass}`}
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
                                        columns={visibleColumns.length}
                                        rows={Math.min(itemsPerPage || 5, 8)}
                                        tdClassName={styles.td}
                                    />
                                ) : noDataAvailable ? (
                                    /* Caso 2: Sin datos y sin cargar */
                                    <tr>
                                        <td colSpan={visibleColumns.length} className={styles.emptyState} style={{ textAlign: 'center', padding: '3rem' }}>
                                            {t('dataTable.noData')}
                                        </td>
                                    </tr>
                                ) : (
                                    /* Caso 3: Datos disponibles */
                                    data.map((row, rowIndex) => (
                                        <tr key={row.id || row['@id'] || rowIndex} className={styles.dataRow}>
                                            {visibleColumns.map((col, colIndex) => {
                                                const actionsClass = isActionsCol(col) ? styles.actionsCell : '';
                                                return (
                                                    <td key={colIndex} className={`${styles.td} ${col.className || ''} ${actionsClass}`}>
                                                        {getCellValue(col, row)}
                                                    </td>
                                                );
                                            })}
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
                                    const headerCols = visibleColumns.slice(0, mobileHeaderColumns);
                                    const actionsCol = columns.find(isActionsCol);
                                    
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
                                        {visibleColumns.slice(mobileHeaderColumns).filter(col => !isActionsCol(col)).map((col, index) => (
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
