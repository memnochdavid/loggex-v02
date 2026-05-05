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
 *
 * Overlays CCAA: un fetch único al cargar mapea qué itinerarios del catálogo
 * nacional tienen overrides en `CatalogoMateriaCcaa` para cada CCAA. Se muestra
 * como badges en la columna "Overlays CCAA" y se puede filtrar la página
 * visible por una CCAA concreta o por "Solo nacional".
 */
const ETAPAS = ['fp_basica', 'fp_medio', 'fp_superior', 'fp_especializacion'];

const CCAA_OPTIONS = [
    { value: 'AN', label: 'Andalucía' },
    { value: 'AR', label: 'Aragón' },
    { value: 'AS', label: 'Asturias' },
    { value: 'CB', label: 'Cantabria' },
    { value: 'CE', label: 'Ceuta' },
    { value: 'CL', label: 'Castilla y León' },
    { value: 'CM', label: 'Castilla-La Mancha' },
    { value: 'CN', label: 'Canarias' },
    { value: 'CT', label: 'Cataluña' },
    { value: 'EX', label: 'Extremadura' },
    { value: 'GA', label: 'Galicia' },
    { value: 'IB', label: 'Illes Balears' },
    { value: 'MC', label: 'Murcia' },
    { value: 'MD', label: 'Madrid' },
    { value: 'ML', label: 'Melilla' },
    { value: 'NC', label: 'Navarra' },
    { value: 'PV', label: 'País Vasco' },
    { value: 'RI', label: 'La Rioja' },
    { value: 'VC', label: 'C. Valenciana' },
];

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
    const [filterCcaa, setFilterCcaa] = useState(''); // '' | 'nacional' | 'AN' | 'CT' | ...
    // mapa itinerarioId → Set<ccaa> con overlays vigentes (vigenteHasta=NULL).
    const [overlaysPorItinerario, setOverlaysPorItinerario] = useState({});

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

    // Carga única al montar: mapa de overlays CCAA agrupados por itinerario nacional.
    // Filtro de "vigentes hoy" (vigenteHasta NULL) se hace en cliente — el backend
    // aún no tiene ExistsFilter declarado en CatalogoMateriaCcaa.
    useEffect(() => {
        const url = getApiUrl('/api/catalogo_materia_ccaas?pagination=false');
        fetch(url, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const list = data['hydra:member'] || data.member || [];
                const mapa = {};
                for (const ov of list) {
                    if (ov.vigenteHasta) continue; // solo vigentes hoy
                    const itRef = ov.catalogoItinerario;
                    if (!itRef) continue;
                    const itId = typeof itRef === 'string'
                        ? itRef.split('/').pop()
                        : (itRef.id ?? itRef['@id']?.split('/').pop());
                    if (!itId) continue;
                    if (!mapa[itId]) mapa[itId] = new Set();
                    if (ov.ccaa) mapa[itId].add(ov.ccaa);
                }
                const out = {};
                for (const k of Object.keys(mapa)) out[k] = [...mapa[k]].sort();
                setOverlaysPorItinerario(out);
            })
            .catch(err => console.error('Error cargando overlays CCAA:', err));
    }, []);

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
            accessor: (it) => {
                const id = getId(it);
                const overlays = overlaysPorItinerario[id] || [];
                if (overlays.length === 0) return <span className={styles.badgeNeutral}>—</span>;
                return (
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {overlays.map(c => (
                            <span key={c} className={styles.badge} title={CCAA_OPTIONS.find(o => o.value === c)?.label || c}>
                                {c}
                            </span>
                        ))}
                    </span>
                );
            },
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
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('catalogo.itinerarios.title') },
                    ]}
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

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.itinerarios.filterCcaa')}</label>
                        <ThemedSelect
                            value={filterCcaa}
                            onChange={(v) => { setFilterCcaa(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.itinerarios.filterAll') },
                                { value: 'nacional', label: t('catalogo.itinerarios.filterCcaaNacional') },
                                ...CCAA_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${o.value})` })),
                            ]}
                        />
                    </div>
                </div>

                {error && <div className={crudStyles.errorContainer}>{error}</div>}

                <DataTable
                    columns={columns}
                    data={(() => {
                        // Filtro derivado por CCAA en cliente (sobre la página visible).
                        // Si quieres filtro server-side global, requiere endpoint nuevo.
                        if (!filterCcaa) return items;
                        if (filterCcaa === 'nacional') {
                            return items.filter(it => {
                                const ovs = overlaysPorItinerario[getId(it)] || [];
                                return ovs.length === 0;
                            });
                        }
                        return items.filter(it => {
                            const ovs = overlaysPorItinerario[getId(it)] || [];
                            return ovs.includes(filterCcaa);
                        });
                    })()}
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
