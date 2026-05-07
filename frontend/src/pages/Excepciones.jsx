import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import AsyncSearchSelect from '../components/AsyncSearchSelect';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import useLiveRefetch from '../hooks/useLiveRefetch';
import { Plus, Check, X as XIcon, Trash2, Undo2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

/**
 * Vista admin de excepciones de horario (intercambios, sustituciones,
 * cancelaciones, eventos especiales).
 *
 * - DataTable con filtros por estado y tipo.
 * - Acciones inline: Aprobar/Rechazar (pendientes), Cancelar (aprobadas),
 *   Borrar (soft-delete cualquier estado).
 * - Modal de creación con campos condicionados por tipo. Admin crea
 *   directamente con estado APROBADA.
 * - Live refetch via Mercure (/admin/centros/{cid}/excepciones).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Fase C.
 */
// TIPOS para filtros y display.
const TIPOS = ['intercambio', 'sustitucion', 'cancelado', 'evento_especial'];
// TIPOS_CREATE: el modal expone los 4. Para `intercambio` el submit usa
// el endpoint dedicado /api/v1/excepciones/intercambio que crea pareja
// atómica (Fase E).
const TIPOS_CREATE = ['sustitucion', 'cancelado', 'evento_especial', 'intercambio'];
const ESTADOS = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];

const formatHora = (iso) => {
    if (!iso) return '';
    // El backend serializa TIME como "1970-01-01T08:30:00+00:00".
    const m = String(iso).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : '';
};

const formatFechaEs = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
};

const userName = (u) => {
    if (!u) return null;
    return [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.email || '—';
};

const Excepciones = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const canManage = isSuperAdmin || isAdmin;

    const [excepciones, setExcepciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedEstado, setSelectedEstado] = useState('');
    const [selectedTipo, setSelectedTipo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = usePagination('excepciones');

    const [sortColumn, setSortColumn] = useState('fechaConcreta');
    const [sortDirection, setSortDirection] = useState('desc');

    const abortController = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        tipo: 'sustitucion',
        horarioBase: '',
        fechaConcreta: '',
        profeOverride: '',
        imparticionEfectiva: '',  // legado; intercambio ya no lo usa (derivado de horarioBaseB)
        motivo: '',
        observaciones: '',
        // Intercambio bilateral (Fase E):
        horarioBaseB: '',
        fechaConcretaB: '',
    });

    const fetchData = useCallback(async (params) => {
        if (abortController.current) abortController.current.abort();
        abortController.current = new AbortController();
        setLoading(true);

        try {
            let url = getApiUrl(`/api/excepcion_horarios?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
            if (params.selectedEstado) url += `&estado=${params.selectedEstado}`;
            if (params.selectedTipo) url += `&tipo=${params.selectedTipo}`;
            if (params.sortColumn) url += `&order[${params.sortColumn}]=${params.sortDirection}`;

            const response = await fetch(url, {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
                signal: abortController.current.signal,
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            const items = data['hydra:member'] || data.member || [];
            const total = data['hydra:totalItems'] || data.totalItems || items.length;
            setExcepciones(items);
            setTotalItems(total);
            setError(null);
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Error fetching excepciones:', err);
            setError(err.message);
        } finally {
            if (abortController.current && !abortController.current.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    // Mercure live: el admin del centro recibe cambios al topic
    // /admin/centros/{cid}/excepciones (firmado en el JWT vía wildcard).
    const liveTopics = useMemo(() => {
        if (!canManage) return [];
        const cid = user?.centro?.id;
        if (isSuperAdmin) return ['/admin/centros/{cid}/excepciones'];
        return cid ? [`/admin/centros/${cid}/excepciones`] : [];
    }, [canManage, isSuperAdmin, user?.centro?.id]);

    useLiveRefetch(liveTopics, () => {
        fetchData({
            page: currentPage,
            itemsPerPage,
            selectedEstado,
            selectedTipo,
            sortColumn,
            sortDirection,
        });
    });

    useEffect(() => {
        fetchData({
            page: currentPage,
            itemsPerPage,
            selectedEstado,
            selectedTipo,
            sortColumn,
            sortDirection,
        });
    }, [
        currentPage,
        itemsPerPage,
        selectedEstado,
        selectedTipo,
        sortColumn,
        sortDirection,
        fetchData,
    ]);

    const handleSort = useCallback((columnKey) => {
        if (sortColumn === columnKey) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    }, [sortColumn]);

    const handleItemsPerPageChange = (newItemsPerPage) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const handleOpenModal = () => {
        setFormData({
            tipo: 'sustitucion',
            horarioBase: '',
            fechaConcreta: '',
            profeOverride: '',
            imparticionEfectiva: '',
            motivo: '',
            observaciones: '',
            horarioBaseB: '',
            fechaConcretaB: '',
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (!saving) setIsModalOpen(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.horarioBase || !formData.fechaConcreta || !formData.tipo) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Faltan campos obligatorios' }));
            return;
        }
        if (formData.tipo === 'intercambio' && (!formData.horarioBaseB || !formData.fechaConcretaB)) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Faltan datos de la otra cara del intercambio' }));
            return;
        }
        setSaving(true);

        try {
            let response;
            if (formData.tipo === 'intercambio') {
                // Endpoint dedicado: crea las dos caras linked atómicamente
                // (Fase E). El admin crea APROBADA directa por defecto.
                response = await fetch(getApiUrl('/api/v1/excepciones/intercambio'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        horarioBaseA:   `/api/horarios/${String(formData.horarioBase).split('/').pop()}`,
                        fechaConcretaA: formData.fechaConcreta,
                        horarioBaseB:   `/api/horarios/${String(formData.horarioBaseB).split('/').pop()}`,
                        fechaConcretaB: formData.fechaConcretaB,
                        motivo:         formData.motivo || null,
                        observaciones:  formData.observaciones || null,
                    }),
                    credentials: 'include',
                });
            } else {
                const payload = {
                    horarioBase: `/api/horarios/${String(formData.horarioBase).split('/').pop()}`,
                    fechaConcreta: formData.fechaConcreta,
                    tipo: formData.tipo,
                    estado: 'aprobada',
                    motivo: formData.motivo || null,
                    observaciones: formData.observaciones || null,
                };
                if (formData.tipo === 'sustitucion' && formData.profeOverride) {
                    payload.profeOverride = `/api/users/${String(formData.profeOverride).split('/').pop()}`;
                }
                if (formData.tipo === 'evento_especial' && formData.profeOverride) {
                    payload.profeOverride = `/api/users/${String(formData.profeOverride).split('/').pop()}`;
                }
                response = await fetch(getApiUrl('/api/excepcion_horarios'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/ld+json', Accept: 'application/ld+json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
            }
            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }
            toast.success(t('exceptions.createdSuccess', { defaultValue: 'Incidencia creada' }));
            setIsModalOpen(false);
            fetchData({
                page: currentPage,
                itemsPerPage,
                selectedEstado,
                selectedTipo,
                sortColumn,
                sortDirection,
            });
        } catch (err) {
            console.error('Error creating excepción:', err);
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const patchEstado = async (row, nuevoEstado, confirmKey) => {
        const ok = await confirm({
            body: t(confirmKey, { defaultValue: '¿Confirmar?' }),
        });
        if (!ok) return;

        try {
            const id = row.id || row['@id']?.split('/').pop();
            const response = await fetch(getApiUrl(`/api/excepcion_horarios/${id}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/merge-patch+json',
                    Accept: 'application/ld+json',
                },
                body: JSON.stringify({ estado: nuevoEstado }),
                credentials: 'include',
            });
            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }
            toast.success(t('exceptions.updated', { defaultValue: 'Excepción actualizada' }));
            // Refetch lo dispara Mercure live; igual lo forzamos por si llega tarde.
            fetchData({
                page: currentPage,
                itemsPerPage,
                selectedEstado,
                selectedTipo,
                sortColumn,
                sortDirection,
            });
        } catch (err) {
            console.error('Error patching excepción:', err);
            toast.error(err.message);
        }
    };

    const handleAprobar  = (row) => patchEstado(row, 'aprobada',  'exceptions.confirmApprove');
    const handleRechazar = (row) => patchEstado(row, 'rechazada', 'exceptions.confirmReject');
    const handleCancelar = (row) => patchEstado(row, 'cancelada', 'exceptions.confirmCancel');

    const handleDelete = async (row) => {
        const ok = await confirm({ body: t('exceptions.confirmDelete', { defaultValue: '¿Eliminar excepción?' }) });
        if (!ok) return;
        try {
            const id = row.id || row['@id']?.split('/').pop();
            const response = await fetch(getApiUrl(`/api/excepcion_horarios/${id}`), {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }
            toast.success(t('exceptions.deleted', { defaultValue: 'Excepción eliminada' }));
            fetchData({
                page: currentPage,
                itemsPerPage,
                selectedEstado,
                selectedTipo,
                sortColumn,
                sortDirection,
            });
        } catch (err) {
            console.error('Error deleting excepción:', err);
            toast.error(err.message);
        }
    };

    const tipoLabel = (tipo) => t(`exceptions.types.${tipo}`, {
        defaultValue: { intercambio: 'Intercambio', sustitucion: 'Sustitución', cancelado: 'Cancelado', evento_especial: 'Evento especial' }[tipo] || tipo,
    });
    const estadoLabel = (estado) => t(`exceptions.estados.${estado}`, {
        defaultValue: { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' }[estado] || estado,
    });

    const badgeClassFor = (estado) => {
        if (estado === 'aprobada') return `${styles.badge} ${styles.badgeActive}`;
        if (estado === 'rechazada' || estado === 'cancelada') return `${styles.badge} ${styles.badgeInactive}`;
        return `${styles.badge} ${styles.badgeNeutral}`;
    };

    const columns = useMemo(() => [
        {
            header: t('exceptions.date', { defaultValue: 'Fecha' }),
            accessor: (row) => formatFechaEs(row.fechaConcreta),
            sortable: true,
            sortKey: 'fechaConcreta',
        },
        {
            header: t('exceptions.slot', { defaultValue: 'Tramo' }),
            accessor: (row) => {
                const h = row.horarioBase;
                if (!h) return '—';
                return `${formatHora(h.horaInicio)}–${formatHora(h.horaFin)}`;
            },
        },
        {
            header: t('exceptions.subjectGroup', { defaultValue: 'Materia · Grupo' }),
            accessor: (row) => {
                const h = row.horarioBase;
                const imp = h?.imparticion;
                const materia = imp?.materia?.nombre || '—';
                const g = imp?.grupo;
                const grupo = g ? [g.curso ? `${g.curso}º` : null, g.abreviatura || g.nombre].filter(Boolean).join(' ') : '';
                return grupo ? `${materia} · ${grupo}` : materia;
            },
        },
        {
            header: t('exceptions.titular', { defaultValue: 'Titular' }),
            accessor: (row) => userName(row.horarioBase?.imparticion?.profesor) || '—',
        },
        {
            header: t('exceptions.tipo', { defaultValue: 'Tipo' }),
            accessor: (row) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{tipoLabel(row.tipo)}</span>,
            sortable: false,
        },
        {
            header: t('exceptions.override', { defaultValue: 'Sustituto / Cambio' }),
            accessor: (row) => {
                if (row.tipo === 'cancelado') return '—';
                if (row.tipo === 'evento_especial') return row.motivo || t('exceptions.event', { defaultValue: 'Evento' });
                const ie = row.imparticionEfectiva;
                if (ie) return userName(ie.profesor) || (ie.materia?.nombre ?? '—');
                return userName(row.profeOverride) || '—';
            },
        },
        {
            header: t('exceptions.estado', { defaultValue: 'Estado' }),
            accessor: (row) => <span className={badgeClassFor(row.estado)}>{estadoLabel(row.estado)}</span>,
            sortable: true,
            sortKey: 'estado',
        },
        {
            header: t('exceptions.requestedBy', { defaultValue: 'Solicita' }),
            accessor: (row) => userName(row.solicitadaPor) || '—',
        },
        {
            header: t('common.actions'),
            accessor: (row) => (
                <div className={styles.actions}>
                    {row.estado === 'pendiente' && (
                        <>
                            <button
                                className={styles.iconButton}
                                onClick={() => handleAprobar(row)}
                                title={t('exceptions.approve', { defaultValue: 'Aprobar' })}
                            >
                                <Check size={18} />
                            </button>
                            <button
                                className={`${styles.iconButton} ${styles.danger}`}
                                onClick={() => handleRechazar(row)}
                                title={t('exceptions.reject', { defaultValue: 'Rechazar' })}
                            >
                                <XIcon size={18} />
                            </button>
                        </>
                    )}
                    {row.estado === 'aprobada' && (
                        <button
                            className={styles.iconButton}
                            onClick={() => handleCancelar(row)}
                            title={t('exceptions.revert', { defaultValue: 'Revertir aprobación' })}
                        >
                            <Undo2 size={18} />
                        </button>
                    )}
                    <button
                        className={`${styles.iconButton} ${styles.danger}`}
                        onClick={() => handleDelete(row)}
                        title={t('common.delete')}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ),
            sortable: false,
        },
    ], [t]);

    const toolbar = (
        <>
            <ThemedSelect
                value={selectedEstado}
                onChange={setSelectedEstado}
                minWidth={170}
                ariaLabel={t('exceptions.filterEstado', { defaultValue: 'Filtrar por estado' })}
                options={[
                    { value: '', label: t('exceptions.allEstados', { defaultValue: 'Todos los estados' }) },
                    ...ESTADOS.map(e => ({ value: e, label: estadoLabel(e) })),
                ]}
            />
            <ThemedSelect
                value={selectedTipo}
                onChange={setSelectedTipo}
                minWidth={180}
                ariaLabel={t('exceptions.filterTipo', { defaultValue: 'Filtrar por tipo' })}
                options={[
                    { value: '', label: t('exceptions.allTipos', { defaultValue: 'Todos los tipos' }) },
                    ...TIPOS.map(tp => ({ value: tp, label: tipoLabel(tp) })),
                ]}
            />
            {canManage && (
                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <Button onClick={handleOpenModal}>
                        <Plus size={18} style={{ marginRight: 8 }} />
                        {t('common.new')}
                    </Button>
                </div>
            )}
        </>
    );

    // Antes de Fase E el modal mostraba un select de imparticionEfectiva para
    // intercambio. Ahora el endpoint dedicado `/intercambio` deriva la
    // imparticion del horarioBaseB elegido, por lo que el campo ya no se
    // expone y la variable queda en false (legacy guard por si alguien
    // cambia el tipo programáticamente).
    const showProfeOverride = formData.tipo === 'sustitucion' || formData.tipo === 'evento_especial';
    const showIntercambioPair = formData.tipo === 'intercambio';

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader
                    title={t('exceptions.title', { defaultValue: 'Excepciones de horario' })}
                    subtitle={t('exceptions.subtitle', { defaultValue: 'Intercambios, sustituciones, cancelaciones y eventos especiales sobre el horario base.' })}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('exceptions.title', { defaultValue: 'Excepciones' }) },
                    ]}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                    stackActionsEarly
                >
                    {toolbar}
                </CrudHeader>

                {error && (
                    <div className={styles.errorContainer}>
                        <p>{error}</p>
                        <Button onClick={() => fetchData({ page: currentPage, itemsPerPage, selectedEstado, selectedTipo, sortColumn, sortDirection })} variant="secondary" style={{ marginTop: '1rem' }}>
                            {t('common.retry')}
                        </Button>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={excepciones}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    loading={loading}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    mobileBreakpoint={'700px'}
                />

                <ModalView
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    title={t('exceptions.newTitle', { defaultValue: 'Nueva excepción' })}
                    onSubmit={handleSubmit}
                    isSubmitting={saving}
                >
                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('exceptions.tipo', { defaultValue: 'Tipo' })}</label>
                        <select
                            name="tipo"
                            className={styles.select}
                            value={formData.tipo}
                            onChange={handleInputChange}
                            required
                        >
                            {TIPOS_CREATE.map(tp => (
                                <option key={tp} value={tp}>{tipoLabel(tp)}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('exceptions.horarioBase', { defaultValue: 'Bloque del horario base' })}</label>
                        <AsyncSearchSelect
                            name="horarioBase"
                            value={formData.horarioBase}
                            onChange={(v) => setFormData(p => ({ ...p, horarioBase: v }))}
                            endpoint="/api/horarios"
                            getOptionLabel={(h) => {
                                const dia = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][h.diaSemana] || '';
                                const hi = formatHora(h.horaInicio);
                                const hf = formatHora(h.horaFin);
                                const m = h.imparticion?.materia?.nombre || '?';
                                const g = h.imparticion?.grupo;
                                const grupo = g ? `${g.curso ? `${g.curso}º ` : ''}${g.abreviatura || g.nombre || ''}` : '';
                                return `${dia} ${hi}-${hf} · ${m}${grupo ? ' · ' + grupo : ''}`;
                            }}
                            getOptionValue={(h) => h.id || h['@id']?.split('/').pop()}
                            placeholder={t('exceptions.searchHorario', { defaultValue: 'Buscar bloque…' })}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('exceptions.fechaConcreta', { defaultValue: 'Fecha concreta' })}</label>
                        <input
                            type="date"
                            name="fechaConcreta"
                            className={styles.input}
                            value={formData.fechaConcreta}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    {showProfeOverride && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                {formData.tipo === 'sustitucion'
                                    ? t('exceptions.profeOverride', { defaultValue: 'Profesor sustituto' })
                                    : t('exceptions.profeFacilitador', { defaultValue: 'Facilitador (opcional)' })}
                            </label>
                            <AsyncSearchSelect
                                name="profeOverride"
                                value={formData.profeOverride}
                                onChange={(v) => setFormData(p => ({ ...p, profeOverride: v }))}
                                endpoint="/api/users"
                                extraParams={{ rol_app: 'profesor' }}
                                getOptionLabel={(u) => userName(u)}
                                getOptionValue={(u) => u.id || u['@id']?.split('/').pop()}
                                placeholder={t('exceptions.searchUser', { defaultValue: 'Buscar profesor…' })}
                                required={formData.tipo === 'sustitucion'}
                            />
                        </div>
                    )}

                    {showIntercambioPair && (
                        <>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>{t('exceptions.horarioBaseB', { defaultValue: 'Bloque del otro profe que cubrirás' })}</label>
                                <AsyncSearchSelect
                                    name="horarioBaseB"
                                    value={formData.horarioBaseB}
                                    onChange={(v) => setFormData(p => ({ ...p, horarioBaseB: v }))}
                                    endpoint="/api/horarios"
                                    getOptionLabel={(h) => {
                                        const dia = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][h.diaSemana] || '';
                                        const m = h.imparticion?.materia?.nombre || '?';
                                        const p = h.imparticion?.profesor;
                                        const profe = p ? [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() : '?';
                                        const hi = (h.horaInicio || '').match(/T(\d{2}:\d{2})/)?.[1] || '';
                                        const hf = (h.horaFin || '').match(/T(\d{2}:\d{2})/)?.[1] || '';
                                        return `${dia} ${hi}-${hf} · ${m} · ${profe}`;
                                    }}
                                    getOptionValue={(h) => h.id || h['@id']?.split('/').pop()}
                                    placeholder={t('exceptions.searchHorario', { defaultValue: 'Buscar bloque…' })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>{t('exceptions.fechaConcretaB', { defaultValue: 'Fecha en la que cubrirás al otro' })}</label>
                                <input
                                    type="date"
                                    name="fechaConcretaB"
                                    className={styles.input}
                                    value={formData.fechaConcretaB}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('exceptions.motivo', { defaultValue: 'Motivo' })}</label>
                        <input
                            type="text"
                            name="motivo"
                            className={styles.input}
                            value={formData.motivo}
                            onChange={handleInputChange}
                            placeholder={t('exceptions.motivoPlaceholder', { defaultValue: 'Ej. ausencia justificada, charla externa…' })}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('exceptions.observaciones', { defaultValue: 'Observaciones (opcional)' })}</label>
                        <textarea
                            name="observaciones"
                            className={styles.textarea}
                            value={formData.observaciones}
                            onChange={handleInputChange}
                            rows={3}
                        />
                    </div>
                </ModalView>
            </div>
        </Layout>
    );
};

export default Excepciones;
