import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, Users } from 'lucide-react';
import ModalView from './ModalView';
import AsyncSearchSelect from './AsyncSearchSelect';
import styles from '../pages/Crud.module.css';
import { getApiUrl } from '../config/api';
import { toast, parseErrorResponse } from '../utils/toast';

/**
 * "Adjuntar a grupo existente" — Fase A clases-compartidas.
 *
 * Replica horario completo (PLs + PLIs + placements) del grupo origen al
 * destino mapeando por `materia.id`. Útil cuando dos grupos comparten
 * currículo LOMLOE (caso EAG: 1º DAW + 1º DAM con materias M:N).
 *
 * Flujo:
 *   1. Admin abre modal desde "Acciones del curso" del HorariosEditor.
 *   2. Selecciona grupo origen (mismo centro, distinto al destino).
 *   3. Modal lanza GET /adjuntar-preview que devuelve stats + warnings.
 *   4. Admin revisa: materias compartidas, omitidas, profe mismatch, si
 *      destino tiene horario que se sobrescribirá.
 *   5. Confirma → POST /adjuntar-a con cleanFirst según preview.
 *
 * Doc: docs/hoja-de-ruta-clases-compartidas.md (Fase A).
 */
const AdjuntarGrupoModal = ({ isOpen, onClose, grupoDestino, centroId, onSuccess }) => {
    const { t } = useTranslation();

    const [origenId, setOrigenId] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const destinoId = grupoDestino?.id ?? null;

    // Reset al abrir/cerrar.
    useEffect(() => {
        if (!isOpen) return;
        setOrigenId('');
        setPreview(null);
        setPreviewError(null);
        setSubmitting(false);
    }, [isOpen]);

    // Preview cada vez que cambia el origen seleccionado.
    useEffect(() => {
        if (!origenId || !destinoId) { setPreview(null); return; }
        let cancelled = false;
        setPreviewLoading(true);
        setPreviewError(null);
        fetch(getApiUrl(`/api/v1/grupos/${destinoId}/adjuntar-preview/${origenId}`), {
            credentials: 'include',
        })
            .then(async r => {
                if (!r.ok) {
                    const txt = await r.text().catch(() => '');
                    throw new Error(txt || `HTTP ${r.status}`);
                }
                return r.json();
            })
            .then(data => { if (!cancelled) setPreview(data); })
            .catch(err => { if (!cancelled) setPreviewError(err.message); })
            .finally(() => { if (!cancelled) setPreviewLoading(false); });
        return () => { cancelled = true; };
    }, [origenId, destinoId]);

    const handleOrigenChange = useCallback((selected) => {
        const id = String(selected ?? '').includes('/')
            ? String(selected).split('/').pop()
            : String(selected ?? '');
        setOrigenId(id);
    }, []);

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (!destinoId || !origenId || submitting) return;
        if (!preview) return;

        const cleanFirst = !!preview.destinoTienePls;
        setSubmitting(true);
        try {
            const res = await fetch(getApiUrl(`/api/v1/grupos/${destinoId}/adjuntar-a/${origenId}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cleanFirst }),
            });
            if (!res.ok) {
                const message = await parseErrorResponse(res);
                throw new Error(message);
            }
            const data = await res.json();
            const s = data.stats || {};
            toast.success(
                t('adjuntarGrupo.success', {
                    defaultValue: 'Horario adjuntado: {{horarios}} placements, {{plis}} PLIs en {{pls}} rangos.',
                    horarios: s.horariosCreados || 0,
                    plis: s.plisCreados || 0,
                    pls: s.plsCreados || 0,
                }),
                { duration: 5000 },
            );
            if (s.materiasOmitidas?.length) {
                toast.info(
                    t('adjuntarGrupo.omitidas', {
                        defaultValue: '{{n}} materia(s) del origen sin par en el destino — placements omitidos: {{lista}}',
                        n: s.materiasOmitidas.length,
                        lista: s.materiasOmitidas.map(m => m.abreviatura || m.codigo || m.nombre).filter(Boolean).join(', '),
                    }),
                    { duration: 8000 },
                );
            }
            if (s.profeMismatch?.length) {
                toast.warning(
                    t('adjuntarGrupo.profeMismatch', {
                        defaultValue: '⚠ {{n}} materia(s) con profesor distinto entre grupos: {{lista}}. El solver no las tratará como clase compartida.',
                        n: s.profeMismatch.length,
                        lista: s.profeMismatch.map(m => m.abreviatura || m.codigo).filter(Boolean).join(', '),
                    }),
                    { duration: 12000 },
                );
            }
            onSuccess?.(data);
            onClose?.();
        } catch (err) {
            console.error('Error adjuntando grupo', err);
            toast.error(err.message, {
                description: t('adjuntarGrupo.errorCtx', {
                    defaultValue: 'No se pudo completar el clonado.',
                }),
            });
        } finally {
            setSubmitting(false);
        }
    };

    const previewSummary = useMemo(() => {
        if (!preview) return null;
        const compartidas = (preview.plisCreados || 0);
        const omitidas = preview.materiasOmitidas?.length || 0;
        const mismatch = preview.profeMismatch?.length || 0;
        return { compartidas, omitidas, mismatch };
    }, [preview]);

    const submitDisabled = !preview || previewLoading || submitting || !!previewError;

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onClose}
            title={t('adjuntarGrupo.title', { defaultValue: 'Adjuntar a grupo existente' })}
            size="large"
            onSubmit={handleSubmit}
            isSubmitting={submitting || submitDisabled}
            submitText={preview?.destinoTienePls
                ? t('adjuntarGrupo.submitOverwrite', { defaultValue: 'Reemplazar horario y adjuntar' })
                : t('adjuntarGrupo.submit', { defaultValue: 'Adjuntar' })}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('adjuntarGrupo.origenLabel', { defaultValue: 'Grupo origen' })}
                </label>
                <AsyncSearchSelect
                    name="origen"
                    value={origenId}
                    onChange={handleOrigenChange}
                    endpoint="/api/grupos"
                    extraParams={centroId ? { centro: centroId, pagination: false } : { pagination: false }}
                    getOptionLabel={(g) => {
                        const cur = g.curso ? `${g.curso}º · ` : '';
                        const nom = g.nombre || `Grupo ${g.id}`;
                        const abrev = g.abreviatura ? ` (${g.abreviatura})` : '';
                        return `${cur}${nom}${abrev}`;
                    }}
                    getOptionValue={(g) => g.id || g['@id']?.split('/').pop()}
                    placeholder={t('adjuntarGrupo.origenPlaceholder', { defaultValue: 'Buscar grupo del centro…' })}
                    required
                />
                <small className={styles.formHint}>
                    {t('adjuntarGrupo.origenHint', {
                        defaultValue: 'Selecciona el grupo cuyo horario quieres replicar al actual. Las materias se mapean por código LOMLOE; las que no existan en el destino se omiten.',
                    })}
                </small>
            </div>

            {previewLoading && (
                <p className={styles.formHint}>
                    {t('adjuntarGrupo.previewLoading', { defaultValue: 'Calculando preview…' })}
                </p>
            )}

            {previewError && (
                <div className={styles.adjuntarBanner} data-tone="error">
                    <AlertTriangle size={16} />
                    <span>{previewError}</span>
                </div>
            )}

            {preview && !previewError && (
                <div className={styles.adjuntarPreview}>
                    {/* Resumen verde */}
                    <div className={styles.adjuntarBanner} data-tone="ok">
                        <CheckCircle2 size={16} />
                        <span>
                            {t('adjuntarGrupo.previewSummary', {
                                defaultValue: 'Se replicarán {{horarios}} placements en {{pls}} rangos sobre {{compartidas}} materia(s) compartida(s).',
                                horarios: preview.horariosCreados || 0,
                                pls: preview.plsCreados || 0,
                                compartidas: previewSummary?.compartidas || 0,
                            })}
                        </span>
                    </div>

                    {/* Warning de materias omitidas (no compartidas en el destino) */}
                    {preview.materiasOmitidas?.length > 0 && (
                        <div className={styles.adjuntarBanner} data-tone="info">
                            <Info size={16} />
                            <div>
                                <strong>{t('adjuntarGrupo.omitidasTitle', {
                                    defaultValue: '{{n}} materia(s) del origen no existen en el destino:',
                                    n: preview.materiasOmitidas.length,
                                })}</strong>
                                <div className={styles.itinerariosChipList}>
                                    {preview.materiasOmitidas.map(m => (
                                        <span key={m.materiaId} className={styles.itinerarioChip}>
                                            {m.abreviatura || m.codigo || m.nombre}
                                        </span>
                                    ))}
                                </div>
                                <small className={styles.formHint}>
                                    {t('adjuntarGrupo.omitidasHint', {
                                        defaultValue: 'Sus placements no se clonan. Para incluirlas, asigna esas materias al itinerario del destino y vuelve a adjuntar.',
                                    })}
                                </small>
                            </div>
                        </div>
                    )}

                    {/* Warning de profesor distinto: el solver NO tratará como compartida */}
                    {preview.profeMismatch?.length > 0 && (
                        <div className={styles.adjuntarBanner} data-tone="warn">
                            <Users size={16} />
                            <div>
                                <strong>{t('adjuntarGrupo.profeMismatchTitle', {
                                    defaultValue: '{{n}} materia(s) con profesor distinto entre origen y destino:',
                                    n: preview.profeMismatch.length,
                                })}</strong>
                                <div className={styles.itinerariosChipList}>
                                    {preview.profeMismatch.map(m => (
                                        <span key={m.materiaId} className={styles.itinerarioChip}>
                                            {m.abreviatura || m.codigo}
                                        </span>
                                    ))}
                                </div>
                                <small className={styles.formHint}>
                                    {t('adjuntarGrupo.profeMismatchHint', {
                                        defaultValue: 'El placement se clona, pero el solver NO las verá como clase compartida (usa profesor.id). Asigna el mismo profesor en ambos grupos para unificar físicamente.',
                                    })}
                                </small>
                            </div>
                        </div>
                    )}

                    {/* Warning rojo: destino tiene PLs vivos, se sobrescribirán */}
                    {preview.destinoTienePls && (
                        <div className={styles.adjuntarBanner} data-tone="error">
                            <AlertTriangle size={16} />
                            <span>
                                {t('adjuntarGrupo.destinoTieneHorario', {
                                    defaultValue: '⚠ El grupo destino ya tiene {{n}} rango(s) configurados. Se BORRARÁN al adjuntar (soft-delete).',
                                    n: preview.destinoNumPls,
                                })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </ModalView>
    );
};

export default AdjuntarGrupoModal;
