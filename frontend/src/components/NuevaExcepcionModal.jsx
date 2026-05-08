import React, { useState, useEffect, useMemo } from 'react';
import { Shuffle } from 'lucide-react';
import ModalView from './ModalView';
import Button from './Button';
import AsyncSearchSelect from './AsyncSearchSelect';
import HorarioGridPicker from './HorarioGridPicker';
import { getApiUrl } from '../config/api';
import { toast, parseErrorResponse } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import crudStyles from '../pages/Crud.module.css';
import styles from './TimeTable.module.css';

const TIPOS_DISPONIBLES = ['sustitucion', 'cancelado', 'evento_especial', 'intercambio'];

/**
 * Modal reusable para crear una excepción puntual sobre un placement.
 * Pensado para abrir desde la rejilla de `/admin/horarios` con click derecho
 * (Fase C.3 del roadmap intercambio-imparticiones). El backend
 * (`ExcepcionHorarioProcessor` para los 3 tipos directos, `IntercambioController`
 * para intercambio) marca la excepción como APROBADA si el usuario tiene rol
 * ADMIN/SUPERADMIN; los profesores la dejarían en PENDIENTE.
 *
 * `target` shape:
 *   horarioId       (number)            id del Horario base persistido
 *   fechaSugerida   (string ISO)        prerrellena el campo fechaConcreta
 *   diaSemana       (1-5)               solo informativo
 *   horaInicio      (string 'HH:MM')    usado además para calcular durA en intercambio
 *   horaFin         (string 'HH:MM')    usado además para calcular durA en intercambio
 *   materia         (string)            nombre o etiqueta para el hint
 *   profesorId      (number, opcional)  id del titular base (para excluir del picker B)
 *   profesorNombre  (string)            nombre completo del titular base
 *   grupoNombre     (string)            "1º DAW (DAW1)" para contexto
 *
 * Tipo `intercambio`: el placement clicado es la cara A (la que cede). El admin
 * elige una o más caras B (mismo profe en todas) cuya Σ minutos == minutos A.
 * POSTea contra `/api/v1/excepciones/intercambio` (endpoint dedicado Plan B).
 */
const NuevaExcepcionModal = ({ isOpen, onClose, target, onSuccess }) => {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        tipo: 'sustitucion',
        fechaConcreta: '',
        profeOverride: '',
        motivo: '',
        observaciones: '',
        // Intercambio (Plan B 2026-05-08): array de bloques B que cubren
        // colectivamente al bloque A. Σ duración B == duración A.
        parejasB: [],
    });
    const [saving, setSaving] = useState(false);

    // Resetear el form cada vez que se abre con un target distinto.
    useEffect(() => {
        if (isOpen && target) {
            setForm({
                tipo: 'sustitucion',
                fechaConcreta: target.fechaSugerida || '',
                profeOverride: '',
                motivo: '',
                observaciones: '',
                parejasB: [],
            });
        }
    }, [isOpen, target]);

    const hint = useMemo(() => {
        if (!target) return '';
        const partes = [];
        if (target.materia) partes.push(target.materia);
        if (target.grupoNombre) partes.push(target.grupoNombre);
        if (target.horaInicio && target.horaFin) {
            partes.push(`${target.horaInicio}–${target.horaFin}`);
        }
        return partes.join(' · ');
    }, [target]);

    // Duración en minutos del bloque A (el placement clicado), necesaria para
    // que el HorarioGridPicker valide que Σ minutos B == minutos A.
    const durA = useMemo(() => {
        if (!target?.horaInicio || !target?.horaFin) return 0;
        const [hH, hM] = String(target.horaInicio).split(':').map(Number);
        const [fH, fM] = String(target.horaFin).split(':').map(Number);
        return (fH * 60 + fM) - (hH * 60 + hM);
    }, [target]);

    // Date para anclar la semana visible en el picker. Cae a hoy si no hay fecha.
    const weekAnchor = useMemo(() => {
        if (target?.fechaSugerida) return new Date(`${target.fechaSugerida}T00:00:00`);
        return new Date();
    }, [target]);

    const isIntercambio = form.tipo === 'intercambio';

    const handleSubmit = async () => {
        if (!target?.horarioId) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Faltan datos del bloque' }));
            return;
        }
        if (!form.fechaConcreta) {
            toast.error(t('exceptions.errorFechaRequired', { defaultValue: 'Falta la fecha' }));
            return;
        }
        if (form.tipo === 'sustitucion' && !form.profeOverride) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Falta el profesor sustituto' }));
            return;
        }
        if (isIntercambio && (!Array.isArray(form.parejasB) || form.parejasB.length === 0)) {
            toast.error(t('exceptions.errorRequired', {
                defaultValue: 'Selecciona los bloques que cubre el otro profesor',
            }));
            return;
        }

        setSaving(true);
        try {
            let response;
            if (isIntercambio) {
                // Endpoint dedicado: crea las N+1 caras linked atómicamente
                // por intercambio_grupo_id (Plan B 2026-05-08).
                response = await fetch(getApiUrl('/api/v1/excepciones/intercambio'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        horarioBaseA: `/api/horarios/${target.horarioId}`,
                        fechaConcretaA: form.fechaConcreta,
                        parejasB: form.parejasB.map(s => ({
                            horarioBaseB: `/api/horarios/${String(s.horarioId).split('/').pop()}`,
                            fechaConcretaB: s.fechaConcreta,
                        })),
                        motivo: form.motivo || null,
                        observaciones: form.observaciones || null,
                    }),
                    credentials: 'include',
                });
            } else {
                const payload = {
                    horarioBase: `/api/horarios/${target.horarioId}`,
                    fechaConcreta: form.fechaConcreta,
                    tipo: form.tipo,
                    motivo: form.motivo || null,
                    observaciones: form.observaciones || null,
                };
                if ((form.tipo === 'sustitucion' || form.tipo === 'evento_especial') && form.profeOverride) {
                    payload.profeOverride = `/api/users/${String(form.profeOverride).split('/').pop()}`;
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

            const created = await response.json().catch(() => null);
            toast.success(t('exceptions.createdSuccess', { defaultValue: 'Incidencia creada' }), {
                description: t('exceptions.createdDesc', {
                    defaultValue: 'Aplicada al horario y notificada a los afectados.',
                }),
            });
            if (onSuccess) onSuccess(created);
            if (onClose) onClose();
        } catch (err) {
            console.error('Error creando excepción:', err);
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onClose}
            title={t('exceptions.newTitle', { defaultValue: 'Nueva excepción' })}
            size={isIntercambio ? 'large' : 'small'}
            cancelText={t('common.cancel')}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        <Shuffle size={18} style={{ marginRight: '8px' }} />
                        {saving
                            ? t('common.saving')
                            : t('exceptions.create', { defaultValue: 'Crear' })}
                    </Button>
                </>
            )}
        >
            <div className={styles.modalBody}>
                {hint && (
                    <p className={styles.subValue} style={{ marginBottom: 'var(--space-3)' }}>
                        {hint}
                    </p>
                )}

                <div className={crudStyles.formGroup}>
                    <label className={crudStyles.label}>{t('exceptions.tipo', { defaultValue: 'Tipo' })}</label>
                    <select
                        className={crudStyles.select}
                        value={form.tipo}
                        onChange={(e) => setForm(p => ({
                            ...p,
                            tipo: e.target.value,
                            profeOverride: '',
                            parejasB: [],
                        }))}
                    >
                        {TIPOS_DISPONIBLES.map(tipo => (
                            <option key={tipo} value={tipo}>
                                {t(`exceptions.types.${tipo}`, { defaultValue: tipo })}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={crudStyles.formGroup}>
                    <label className={crudStyles.label}>{t('exceptions.date', { defaultValue: 'Fecha' })}</label>
                    <input
                        type="date"
                        className={crudStyles.input}
                        value={form.fechaConcreta}
                        onChange={(e) => setForm(p => ({ ...p, fechaConcreta: e.target.value }))}
                        required
                    />
                </div>

                {(form.tipo === 'sustitucion' || form.tipo === 'evento_especial') && (
                    <div className={crudStyles.formGroup}>
                        <label className={crudStyles.label}>
                            {form.tipo === 'sustitucion'
                                ? t('exceptions.profeOverride', { defaultValue: 'Profesor sustituto' })
                                : t('exceptions.profeFacilitador', { defaultValue: 'Facilitador (opcional)' })}
                        </label>
                        <AsyncSearchSelect
                            value={form.profeOverride}
                            onChange={(v) => setForm(p => ({ ...p, profeOverride: v }))}
                            endpoint="/api/users"
                            extraParams={{ rol_app: ['profesor', 'admin'] }}
                            getOptionLabel={(u) => [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.email || '—'}
                            getOptionValue={(u) => u.id || u['@id']?.split('/').pop()}
                            placeholder={t('exceptions.searchUser', { defaultValue: 'Buscar profesor…' })}
                            required={form.tipo === 'sustitucion'}
                        />
                    </div>
                )}

                {isIntercambio && (
                    <div className={crudStyles.formGroup}>
                        <label className={crudStyles.label}>
                            {t('exceptions.horarioBaseB', { defaultValue: 'Bloque(s) del otro profe que cubrirás' })}
                        </label>
                        <HorarioGridPicker
                            selections={form.parejasB}
                            onChange={(newSelections) => setForm(p => ({ ...p, parejasB: newSelections }))}
                            weekAnchor={weekAnchor}
                            targetMinutes={durA}
                            excludeProfesorId={target?.profesorId}
                        />
                    </div>
                )}

                <div className={crudStyles.formGroup}>
                    <label className={crudStyles.label}>{t('exceptions.motivo', { defaultValue: 'Motivo' })}</label>
                    <input
                        type="text"
                        className={crudStyles.input}
                        value={form.motivo}
                        onChange={(e) => setForm(p => ({ ...p, motivo: e.target.value }))}
                        placeholder={t('exceptions.motivoPlaceholder', { defaultValue: 'Ej. ausencia justificada, charla externa…' })}
                    />
                </div>

                <div className={crudStyles.formGroup}>
                    <label className={crudStyles.label}>{t('exceptions.observaciones', { defaultValue: 'Observaciones (opcional)' })}</label>
                    <textarea
                        className={crudStyles.textarea}
                        value={form.observaciones}
                        onChange={(e) => setForm(p => ({ ...p, observaciones: e.target.value }))}
                        rows={2}
                    />
                </div>
            </div>
        </ModalView>
    );
};

export default NuevaExcepcionModal;
