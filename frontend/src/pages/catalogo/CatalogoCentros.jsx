import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import ThemedSelect from '../../components/ThemedSelect';
import DataProvenanceBanner from '../../components/DataProvenanceBanner';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

/**
 * Listing read-only de CatalogoCentro. SuperAdmin only — la fuente actual
 * (CSV oficial de la Junta de Andalucía) no expone CIFs ni datos de contacto
 * sensibles, pero el flujo de "Crear desde catálogo" desde /admin/centros
 * solo lo ejecuta el superadmin, así que este listado se restringe igual.
 */

const PROVINCIAS_ANDALUCIA = [
    'Almería', 'Cádiz', 'Córdoba', 'Granada',
    'Huelva', 'Jaén', 'Málaga', 'Sevilla',
];

const TITULARIDADES = ['publico', 'concertado', 'privado'];

const ETAPAS = [
    'primaria', 'eso', 'bachillerato',
    'fp_basica', 'fp_medio', 'fp_superior', 'fp_especializacion',
];

const CatalogoCentros = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = usePagination('catalogo-centros');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterProvincia, setFilterProvincia] = useState('');
    const [filterTitularidad, setFilterTitularidad] = useState('');
    const [filterEtapa, setFilterEtapa] = useState('');

    const [sortColumn, setSortColumn] = useState('nombre');
    const [sortDirection, setSortDirection] = useState('asc');

    const debounceTimeout = useRef(null);
    const abortController = useRef(null);
    const prevSearchTerm = useRef(searchTerm);

    const fetchData = useCallback(async (params) => {
        if (abortController.current) abortController.current.abort();
        abortController.current = new AbortController();

        setLoading(true);
        try {
            let url = getApiUrl(`/api/catalogo_centros?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
            if (params.searchTerm) url += `&q=${encodeURIComponent(params.searchTerm)}`;
            if (params.filterProvincia) url += `&provincia=${encodeURIComponent(params.filterProvincia)}`;
            if (params.filterTitularidad) url += `&titularidad=${encodeURIComponent(params.filterTitularidad)}`;
            if (params.sortColumn) url += `&order[${params.sortColumn}]=${params.sortDirection}`;

            const response = await fetch(url, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include',
                signal: abortController.current.signal,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

            const data = await response.json();
            const list = data['hydra:member'] || data.member || [];
            const total = data['hydra:totalItems'] || data.totalItems || list.length;
            setItems(list);
            setTotalItems(total);
            setError(null);
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Error fetching catalogo centros:', err);
            setError(err.message);
        } finally {
            if (abortController.current && !abortController.current.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const searchChanged = searchTerm !== prevSearchTerm.current;
        prevSearchTerm.current = searchTerm;

        const params = {
            page: currentPage,
            itemsPerPage,
            searchTerm,
            filterProvincia,
            filterTitularidad,
            sortColumn,
            sortDirection,
        };

        if (searchChanged) {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            debounceTimeout.current = setTimeout(() => fetchData(params), 500);
        } else {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            fetchData(params);
        }
        return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
    }, [currentPage, itemsPerPage, searchTerm, filterProvincia, filterTitularidad, sortColumn, sortDirection, fetchData]);

    if (!isSuperAdmin) {
        return <Navigate to="/admin/catalogo/itinerarios" replace />;
    }

    const handleSort = useCallback((columnKey) => {
        if (sortColumn === columnKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    }, [sortColumn]);

    const titularidadLabel = (v) => {
        if (!v) return '—';
        return t(`catalogo.centros.titularidad.${v}`, v);
    };

    const columns = [
        {
            header: t('catalogo.centros.columnCodigo'),
            accessor: 'codigoCentro',
            sortable: false,
        },
        {
            header: t('catalogo.centros.columnNombre'),
            accessor: 'nombre',
            sortable: true,
            sortKey: 'nombre',
        },
        {
            header: t('catalogo.centros.columnMunicipio'),
            accessor: (c) => c.municipio || '—',
            sortable: true,
            sortKey: 'municipio',
        },
        {
            header: t('catalogo.centros.columnProvincia'),
            accessor: (c) => c.provincia || '—',
        },
        {
            header: t('catalogo.centros.columnTitularidad'),
            accessor: (c) => (
                <span className={styles.badge}>{titularidadLabel(c.titularidad)}</span>
            ),
        },
        {
            header: t('catalogo.centros.columnEtapas'),
            accessor: (c) => {
                const etapas = c.etapasOfrecidas || [];
                if (etapas.length === 0) return <span className={styles.badgeNeutral}>—</span>;
                return (
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {etapas.map(e => (
                            <span key={e} className={styles.badge} title={t(`catalogo.etapaLabel.${e}`, e)}>
                                {t(`catalogo.etapaShort.${e}`, e)}
                            </span>
                        ))}
                    </span>
                );
            },
        },
    ];

    const visibleItems = filterEtapa
        ? items.filter(c => Array.isArray(c.etapasOfrecidas) && c.etapasOfrecidas.includes(filterEtapa))
        : items;

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={t('catalogo.centros.title')}
                    subtitle={t('catalogo.centros.subtitle')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('catalogo.centros.title') },
                    ]}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                />

                <DataProvenanceBanner />

                <div className={styles.toolbar}>
                    <div className={`${styles.toolbarField} ${styles.toolbarFieldGrow}`}>
                        <label className={styles.toolbarLabel}>{t('catalogo.centros.searchPlaceholder')}</label>
                        <SearchBar
                            value={searchTerm}
                            onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
                            placeholder={t('catalogo.centros.searchPlaceholder')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.centros.filterProvincia')}</label>
                        <ThemedSelect
                            value={filterProvincia}
                            onChange={(v) => { setFilterProvincia(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.centros.filterAll') },
                                ...PROVINCIAS_ANDALUCIA.map(p => ({ value: p, label: p })),
                            ]}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.centros.filterTitularidad')}</label>
                        <ThemedSelect
                            value={filterTitularidad}
                            onChange={(v) => { setFilterTitularidad(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.centros.filterAll') },
                                ...TITULARIDADES.map(tt => ({ value: tt, label: titularidadLabel(tt) })),
                            ]}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.centros.filterEtapa')}</label>
                        <ThemedSelect
                            value={filterEtapa}
                            onChange={(v) => setFilterEtapa(v)}
                            options={[
                                { value: '', label: t('catalogo.centros.filterAll') },
                                ...ETAPAS.map(e => ({ value: e, label: t(`catalogo.etapaLabel.${e}`, e) })),
                            ]}
                        />
                    </div>
                </div>

                {error && <div className={crudStyles.errorContainer}>{error}</div>}

                <DataTable
                    tableId="catalogo-centros"
                    columns={columns}
                    data={visibleItems}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                    loading={loading}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    mobileHeaderColumns={2}
                />
            </div>
        </Layout>
    );
};

export default CatalogoCentros;
