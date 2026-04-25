import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import ThemedSelect from '../../components/ThemedSelect';
import DataProvenanceBanner from '../../components/DataProvenanceBanner';
import { usePagination } from '../../hooks/usePagination';
import { getApiUrl } from '../../config/api';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

/**
 * Listing read-only de CatalogoItinerario con paginación, búsqueda libre
 * (nombre + código + familia, vía SearchAnyFilter `?q=`) y filtros server-side
 * por etapa, familia (parcial), nivel (parcial) y vigencia.
 *
 * Click en una fila navega al detalle. Sin acciones de edición.
 */
const ETAPAS = ['fp_basica', 'fp_medio', 'fp_superior', 'fp_especializacion'];

const CatalogoItinerarios = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = usePagination('catalogo-itinerarios');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterEtapa, setFilterEtapa] = useState('');
    const [filterFamilia, setFilterFamilia] = useState('');
    const [filterNivel, setFilterNivel] = useState('');
    const [filterVigente, setFilterVigente] = useState(''); // '' | 'yes' | 'no'

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
            let url = getApiUrl(`/api/catalogo_itinerarios?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
            if (params.searchTerm) url += `&q=${encodeURIComponent(params.searchTerm)}`;
            if (params.filterEtapa) url += `&etapa=${encodeURIComponent(params.filterEtapa)}`;
            if (params.filterFamilia) url += `&familia=${encodeURIComponent(params.filterFamilia)}`;
            if (params.filterNivel) url += `&nivel=${encodeURIComponent(params.filterNivel)}`;
            if (params.filterVigente === 'yes') url += `&exists[vigenteHasta]=false`;
            if (params.filterVigente === 'no') url += `&exists[vigenteHasta]=true`;
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
            console.error('Error fetching catalogo:', err);
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
            filterEtapa,
            filterFamilia,
            filterNivel,
            filterVigente,
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
    }, [currentPage, itemsPerPage, searchTerm, filterEtapa, filterFamilia, filterNivel, filterVigente, sortColumn, sortDirection, fetchData]);

    const handleSort = useCallback((columnKey) => {
        if (sortColumn === columnKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    }, [sortColumn]);

    const getId = (it) => it.id ?? (it['@id'] ? it['@id'].split('/').pop() : null);

    const formatHoras = (n) => (n ? t('catalogo.itinerarioDetail.horasUnit', { n }) : '—');

    const columns = [
        {
            header: t('catalogo.itinerarios.columnCodigo'),
            accessor: 'codigoOficial',
            sortable: true,
            sortKey: 'codigoOficial',
        },
        {
            header: t('catalogo.itinerarios.columnNombre'),
            accessor: 'nombre',
            sortable: true,
            sortKey: 'nombre',
        },
        {
            header: t('catalogo.itinerarios.columnEtapa'),
            accessor: (it) => (
                <span className={styles.badge}>
                    {t(`catalogo.etapaLabel.${it.etapa}`, it.etapa)}
                </span>
            ),
            sortable: true,
            sortKey: 'etapa',
        },
        {
            header: t('catalogo.itinerarios.columnFamilia'),
            accessor: (it) => it.familia || '—',
        },
        {
            header: t('catalogo.itinerarios.columnHoras'),
            accessor: (it) => formatHoras(it.duracionTotalHoras),
            sortable: true,
            sortKey: 'duracionTotalHoras',
        },
        {
            header: t('catalogo.itinerarios.columnEcts'),
            accessor: (it) => it.duracionTotalEcts ?? '—',
        },
        {
            header: t('catalogo.itinerarios.columnCcaa'),
            accessor: (it) => it.ccaa || '—',
        },
        {
            header: t('catalogo.itinerarios.columnVigencia'),
            accessor: (it) => (
                <span className={it.vigenteHasta ? styles.badgeNeutral : styles.badge}>
                    {it.vigenteHasta
                        ? t('catalogo.itinerarios.vigenteNo')
                        : t('catalogo.itinerarios.vigenteSi')}
                </span>
            ),
        },
        {
            header: '',
            accessor: (it) => {
                const id = getId(it);
                return (
                    <button
                        type="button"
                        className={crudStyles.iconButton}
                        title={t('catalogo.itinerarios.viewDetail')}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/catalogo/itinerarios/${id}`);
                        }}
                    >
                        <Eye size={16} />
                    </button>
                );
            },
        },
    ];

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={t('catalogo.itinerarios.title')}
                    subtitle={t('catalogo.itinerarios.subtitle')}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                />

                <DataProvenanceBanner />

                <div className={styles.toolbar}>
                    <div className={`${styles.toolbarField} ${styles.toolbarFieldGrow}`}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.searchPlaceholder')}</label>
                        <SearchBar
                            value={searchTerm}
                            onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
                            placeholder={t('catalogo.itinerarios.searchPlaceholder')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.filterEtapa')}</label>
                        <ThemedSelect
                            value={filterEtapa}
                            onChange={(v) => { setFilterEtapa(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.itinerarios.filterAll') },
                                ...ETAPAS.map(e => ({ value: e, label: t(`catalogo.etapaLabel.${e}`, e) })),
                            ]}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.filterFamilia')}</label>
                        <input
                            type="text"
                            className={crudStyles.input}
                            value={filterFamilia}
                            onChange={(e) => { setFilterFamilia(e.target.value); setCurrentPage(1); }}
                            placeholder={t('catalogo.itinerarios.filterFamilia')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.filterNivel')}</label>
                        <input
                            type="text"
                            className={crudStyles.input}
                            value={filterNivel}
                            onChange={(e) => { setFilterNivel(e.target.value); setCurrentPage(1); }}
                            placeholder={t('catalogo.itinerarios.filterNivel')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.filterVigente')}</label>
                        <ThemedSelect
                            value={filterVigente}
                            onChange={(v) => { setFilterVigente(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.itinerarios.filterAll') },
                                { value: 'yes', label: t('catalogo.itinerarios.filterVigenteYes') },
                                { value: 'no', label: t('catalogo.itinerarios.filterVigenteNo') },
                            ]}
                        />
                    </div>
                </div>

                {error && <div className={crudStyles.errorContainer}>{error}</div>}

                <DataTable
                    columns={columns}
                    data={items}
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

export default CatalogoItinerarios;
