import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import ModalView from './ModalView';
import AsyncSearchSelect from './AsyncSearchSelect';
import Button from './Button';
import styles from '../pages/Crud.module.css';
import { getApiUrl } from '../config/api';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

/**
 * Gestiona las materias asignadas a un itinerario (Materia ↔ Itinerario M:N).
 *
 * - Lista las materias actuales asignadas al itinerario con CTA para
 *   desvincularlas (no borra la materia: la quita de la colección).
 * - CTA "Añadir materia existente": busca materias del mismo centro NO
 *   asignadas todavía y permite anexar una al itinerario actual.
 *
 * Persistencia: PATCH `application/merge-patch+json` sobre `/api/materias/{id}`
 * con el array `itinerarios` completo. El owning side es Materia, así que
 * lo natural es modificar la lista de itinerarios desde la materia.
 *
 * Doc: docs/hoja-de-ruta-materias-multi-itinerario.md (D-3 UX add).
 */
const MateriasItinerarioModal = ({ isOpen, onClose, itinerario, centroId }) => {
    const { t } = useTranslation();
    const confirm = useConfirm();

    const [materias, setMaterias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [buffer, setBuffer] = useState('');

    const itinerarioId = itinerario?.id ?? itinerario?.['@id']?.split('/').pop();
    const itinerarioIri = itinerarioId ? `/api/itinerarios/${itinerarioId}` : null;

    const fetchMaterias = useCallback(async () => {
        if (!itinerarioId) return;
        setLoading(true);
        try {
            const url = getApiUrl(`/api/materias?itinerarios=${itinerarioId}&pagination=false`);
            const res = await fetch(url, {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const items = data['hydra:member'] || data.member || [];
            // Ordenar por curso + nombre para legibilidad.
            items.sort((a, b) => {
                const ca = a.curso ?? 99, cb = b.curso ?? 99;
                if (ca !== cb) return ca - cb;
                return (a.nombre || '').localeCompare(b.nombre || '');
            });
            setMaterias(items);
        } catch (err) {
            console.error('Error cargando materias del itinerario', err);
            toast.error(t('materiasItinerario.loadError', {
                defaultValue: 'No se pudieron cargar las materias del itinerario.',
            }));
        } finally {
            setLoading(false);
        }
    }, [itinerarioId, t]);

    useEffect(() => {
        if (isOpen) {
            setBuffer('');
            fetchMaterias();
        }
    }, [isOpen, fetchMaterias]);

    const assignedIds = useMemo(
        () => new Set(materias.map(m => String(m.id ?? m['@id']?.split('/').pop()))),
        [materias],
    );

    const extractItinerarioIris = (materia) => {
        const list = Array.isArray(materia.itinerarios) ? materia.itinerarios : [];
        return list.map(entry => {
            if (typeof entry === 'string') return entry;
            if (entry?.['@id']) return entry['@id'];
            if (entry?.id != null) return `/api/itinerarios/${entry.id}`;
            return null;
        }).filter(Boolean);
    };

    const patchMateria = async (materiaId, nuevosItinerarios) => {
        const res = await fetch(getApiUrl(`/api/materias/${materiaId}`), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/merge-patch+json',
                Accept: 'application/ld+json',
            },
            credentials: 'include',
            body: JSON.stringify({ itinerarios: nuevosItinerarios }),
        });
        if (!res.ok) {
            const message = await parseErrorResponse(res);
            throw new Error(message);
        }
    };

    const handleAdd = useCallback(async (selectedId) => {
        if (!selectedId || !itinerarioIri) return;
        const id = String(selectedId).includes('/') ? String(selectedId).split('/').pop() : String(selectedId);
        setBusy(true);
        try {
            // Lee la materia para no pisar otros itinerarios que ya tenga.
            const res = await fetch(getApiUrl(`/api/materias/${id}`), {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const materia = await res.json();
            const actuales = extractItinerarioIris(materia);
            if (actuales.includes(itinerarioIri)) {
                toast.info(t('materiasItinerario.alreadyAssigned', {
                    defaultValue: 'Esta materia ya está asignada al itinerario.',
                }));
                setBuffer('');
                return;
            }
            await patchMateria(id, [...actuales, itinerarioIri]);
            toast.success(t('materiasItinerario.addSuccess', {
                defaultValue: 'Materia añadida al itinerario.',
            }));
            setBuffer('');
            await fetchMaterias();
        } catch (err) {
            console.error('Error añadiendo materia al itinerario', err);
            toast.error(err.message, {
                description: t('materiasItinerario.addErrorCtx', {
                    defaultValue: 'No se ha podido añadir la materia al itinerario.',
                }),
            });
        } finally {
            setBusy(false);
        }
    }, [itinerarioIri, fetchMaterias, t]);

    const handleRemove = useCallback(async (materia) => {
        if (!itinerarioIri) return;
        const ok = await confirm({
            body: t('materiasItinerario.confirmRemove', {
                defaultValue: '¿Quitar "{{nombre}}" de este itinerario? La materia seguirá viva en el resto de itinerarios donde esté asignada.',
                nombre: materia.nombre,
            }),
        });
        if (!ok) return;
        const actuales = extractItinerarioIris(materia);
        const next = actuales.filter(iri => iri !== itinerarioIri);
        if (next.length === 0) {
            const ok2 = await confirm({
                body: t('materiasItinerario.confirmLastItinerario', {
                    defaultValue: 'Esta era la única asignación. Si la quitas, la materia quedará huérfana (sin itinerario). ¿Quieres continuar?',
                }),
            });
            if (!ok2) return;
        }
        const id = materia.id ?? materia['@id']?.split('/').pop();
        setBusy(true);
        try {
            await patchMateria(id, next);
            toast.success(t('materiasItinerario.removeSuccess', {
                defaultValue: 'Materia desvinculada del itinerario.',
            }));
            await fetchMaterias();
        } catch (err) {
            console.error('Error quitando materia del itinerario', err);
            toast.error(err.message, {
                description: t('materiasItinerario.removeErrorCtx', {
                    defaultValue: 'No se ha podido desvincular la materia.',
                }),
            });
        } finally {
            setBusy(false);
        }
    }, [itinerarioIri, fetchMaterias, confirm, t]);

    if (!itinerario) return null;

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onClose}
            title={t('materiasItinerario.title', {
                defaultValue: 'Materias de {{nombre}}',
                nombre: itinerario.nombre,
            })}
            size="large"
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('materiasItinerario.addLabel', { defaultValue: 'Añadir materia existente' })}
                </label>
                <AsyncSearchSelect
                    name="materiaBuffer"
                    value={buffer}
                    onChange={handleAdd}
                    endpoint="/api/materias"
                    extraParams={centroId ? { 'itinerarios.centro': centroId } : {}}
                    getOptionLabel={(m) => {
                        const cur = m.curso ? `${m.curso}º · ` : '';
                        const ab = m.abreviatura ? ` (${m.abreviatura})` : '';
                        return `${cur}${m.nombre}${ab}`;
                    }}
                    getOptionValue={(m) => m.id || m['@id']?.split('/').pop()}
                    placeholder={t('materiasItinerario.addPlaceholder', {
                        defaultValue: 'Buscar materia del centro…',
                    })}
                    disabled={busy}
                />
                <small className={styles.formHint}>
                    {t('materiasItinerario.addHint', {
                        defaultValue: 'Selecciona una materia ya creada en el centro para asignarla también a este itinerario. Útil para currículos compartidos LOMLOE (ej. 1º DAW + 1º DAM).',
                    })}
                </small>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('materiasItinerario.assignedLabel', {
                        defaultValue: 'Materias asignadas ({{count}})',
                        count: materias.length,
                    })}
                </label>
                {loading && <p className={styles.formHint}>{t('common.loading', { defaultValue: 'Cargando…' })}</p>}
                {!loading && materias.length === 0 && (
                    <p className={styles.itinerariosEmpty}>
                        {t('materiasItinerario.empty', { defaultValue: 'Aún no hay materias asignadas.' })}
                    </p>
                )}
                {!loading && materias.length > 0 && (
                    <div className={styles.itinerariosChipList}>
                        {materias.map(m => (
                            <span key={m.id ?? m['@id']} className={styles.itinerarioChip}>
                                {m.curso ? `${m.curso}º · ` : ''}{m.nombre}{m.abreviatura ? ` (${m.abreviatura})` : ''}
                                <button
                                    type="button"
                                    className={styles.itinerarioChipRemove}
                                    onClick={() => handleRemove(m)}
                                    disabled={busy}
                                    title={t('common.remove', { defaultValue: 'Quitar' })}
                                    aria-label={t('common.remove', { defaultValue: 'Quitar' })}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </ModalView>
    );
};

export default MateriasItinerarioModal;
