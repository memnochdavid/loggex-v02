import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import ThemedSelect from '../../components/ThemedSelect';
import AsyncSearchSelect from '../../components/AsyncSearchSelect';
import DataProvenanceBanner from '../../components/DataProvenanceBanner';
import { usePagination } from '../../hooks/usePagination';
import { getApiUrl } from '../../config/api';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

const TIPOS = ['MODULO', 'TRONCAL', 'ESPECIFICA', 'OPTATIVA', 'LIBRE_CONFIGURACION', 'ASIGNATURA', 'FCT', 'PROYECTO'];
const CURSOS = ['1', '2', '3', '4'];

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

const CatalogoMaterias = () => {
    const { t } = useTranslation();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = usePagination('catalogo-materias');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterCurso, setFilterCurso] = useState('');
    const [filterItinerarioId, setFilterItinerarioId] = useState('');
    const [filterCcaa, setFilterCcaa] = useState(''); // '' | 'nacional' | 'AN' | 'CT' | ...
    // mapa catalogoMateriaId → Set<ccaa> con overlays vigentes (vigenteHasta=NULL).
    // Solo overrides (catalogoMateria NOT NULL); autonómicas puras se ignoran aquí.
    const [overlaysPorMateria, setOverlaysPorMateria] = useState({});

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
            let url = getApiUrl(`/api/catalogo_materias?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
            if (params.searchTerm) url += `&q=${encodeURIComponent(params.searchTerm)}`;
            if (params.filterTipo) url += `&tipo=${encodeURIComponent(params.filterTipo)}`;
            if (params.filterCurso) url += `&curso=${encodeURIComponent(params.filterCurso)}`;
            if (params.filterItinerarioId) url += `&itinerario=${encodeURIComponent(params.filterItinerarioId)}`;
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
            console.error('Error fetching materias:', err);
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
            filterTipo,
            filterCurso,
            filterItinerarioId,
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
    }, [currentPage, itemsPerPage, searchTerm, filterTipo, filterCurso, filterItinerarioId, sortColumn, sortDirection, fetchData]);

    // Carga única al montar: mapa de overlays CCAA agrupados por catalogoMateria.
    // Solo overrides (catalogoMateria NOT NULL); autonómicas puras se exponen
    // en CatalogoItinerarioDetail, no en este listado nacional. Filtros de
    // vigentes y catalogoMateria-no-null se hacen en cliente (no hay
    // ExistsFilter declarado en backend).
    useEffect(() => {
        const url = getApiUrl('/api/catalogo_materia_ccaas?pagination=false');
        fetch(url, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const list = data['hydra:member'] || data.member || [];
                const mapa = {};
                for (const ov of list) {
                    if (ov.vigenteHasta) continue;     // solo vigentes hoy
                    const matRef = ov.catalogoMateria;
                    if (!matRef) continue;             // omitir autonómicas puras
                    const matId = typeof matRef === 'string'
                        ? matRef.split('/').pop()
                        : (matRef.id ?? matRef['@id']?.split('/').pop());
                    if (!matId) continue;
                    if (!mapa[matId]) mapa[matId] = new Set();
                    if (ov.ccaa) mapa[matId].add(ov.ccaa);
                }
                const out = {};
                for (const k of Object.keys(mapa)) out[k] = [...mapa[k]].sort();
                setOverlaysPorMateria(out);
            })
            .catch(err => console.error('Error cargando overlays CCAA:', err));
    }, []);

    const handleSort = useCallback((columnKey) => {
        if (sortColumn === columnKey) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortColumn(columnKey); setSortDirection('asc'); }
    }, [sortColumn]);

    const getItinerarioId = (m) => {
        if (!m.itinerario) return null;
        if (typeof m.itinerario === 'string') return m.itinerario.split('/').pop();
        return m.itinerario.id ?? (m.itinerario['@id'] ? m.itinerario['@id'].split('/').pop() : null);
    };

    const getItinerarioName = (m) => {
        if (!m.itinerario || typeof m.itinerario === 'string') return null;
        return m.itinerario.nombre || null;
    };

    const formatHoras = (n) => (n ? t('catalogo.itinerarioDetail.horasUnit', { n }) : '—');

    const columns = [
        { header: t('catalogo.materias.columnCodigo'), accessor: 'codigoOficial', sortable: true, sortKey: 'codigoOficial' },
        { header: t('catalogo.materias.columnNombre'), accessor: 'nombre', sortable: true, sortKey: 'nombre' },
        {
            header: t('catalogo.materias.columnTipo'),
            accessor: (m) => (
                <span className={styles.badge}>{t(`catalogo.tipoLabel.${m.tipo}`, m.tipo)}</span>
            ),
        },
        { header: t('catalogo.materias.columnCurso'), accessor: (m) => m.curso ?? '—' },
        { header: t('catalogo.materias.columnHoras'), accessor: (m) => formatHoras(m.horasTotales) },
        { header: t('catalogo.materias.columnEcts'), accessor: (m) => m.ects ?? '—' },
        {
            header: t('catalogo.materias.columnItinerario'),
            accessor: (m) => {
                const id = getItinerarioId(m);
                const name = getItinerarioName(m);
                if (!id) return '—';
                return (
                    <Link
                        to={`/admin/catalogo/itinerarios/${id}`}
                        className={styles.normativaLink}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {name || `#${id}`}
                        <ExternalLink size={12} aria-hidden="true" />
                    </Link>
                );
            },
        },
        {
            header: t('catalogo.materias.columnCcaa', { defaultValue: 'Overlays CCAA' }),
            accessor: (m) => {
                const overlays = overlaysPorMateria[m.id] || [];
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
    ];

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={t('catalogo.materias.title')}
                    subtitle={t('catalogo.materias.subtitle')}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                />

                <DataProvenanceBanner />

                <div className={styles.toolbar}>
                    <div className={`${styles.toolbarField} ${styles.toolbarFieldGrow}`}>
                        <label className={styles.toolbarLabel}>{t('catalogo.materias.searchPlaceholder')}</label>
                        <SearchBar
                            value={searchTerm}
                            onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
                            placeholder={t('catalogo.materias.searchPlaceholder')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.materias.filterTipo')}</label>
                        <ThemedSelect
                            value={filterTipo}
                            onChange={(v) => { setFilterTipo(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.materias.filterAll') },
                                ...TIPOS.map(tp => ({ value: tp, label: t(`catalogo.tipoLabel.${tp}`, tp) })),
                            ]}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.materias.filterCurso')}</label>
                        <ThemedSelect
                            value={filterCurso}
                            onChange={(v) => { setFilterCurso(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.materias.filterAll') },
                                ...CURSOS.map(c => ({ value: c, label: c })),
                            ]}
                        />
                    </div>

                    <div className={`${styles.toolbarField} ${styles.toolbarFieldGrow}`}>
                        <label className={styles.toolbarLabel}>{t('catalogo.materias.filterItinerario')}</label>
                        <AsyncSearchSelect
                            endpoint="/api/catalogo_itinerarios"
                            value={filterItinerarioId}
                            onChange={(id) => { setFilterItinerarioId(id || ''); setCurrentPage(1); }}
                            getOptionLabel={(it) => `${it.codigoOficial} — ${it.nombre}`}
                            placeholder={t('catalogo.materias.filterAll')}
                        />
                    </div>

                    <div className={styles.toolbarField}>
                        <label className={styles.toolbarLabel}>{t('catalogo.materias.filterCcaa', { defaultValue: 'Overlay CCAA' })}</label>
                        <ThemedSelect
                            value={filterCcaa}
                            onChange={(v) => { setFilterCcaa(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: t('catalogo.materias.filterAll') },
                                { value: 'nacional', label: t('catalogo.materias.filterCcaaNacional', { defaultValue: 'Solo nacional (sin overlay)' }) },
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
                        if (!filterCcaa) return items;
                        if (filterCcaa === 'nacional') {
                            return items.filter(m => (overlaysPorMateria[m.id] || []).length === 0);
                        }
                        return items.filter(m => (overlaysPorMateria[m.id] || []).includes(filterCcaa));
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

export default CatalogoMaterias;
