import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import ThemedSelect from '../components/ThemedSelect';
import CrudHeader from '../components/CrudHeader';
import { formatGrupoNombre } from '../utils/grupo';
import styles from './HorariosConsumicion.module.css';

// Tab "Consumición de horas anuales" del editor /admin/horarios.
// Sesión 2: toggle rango↔evaluación, tonalidad por fila, sub-totales
// plegables y banner tonalizado.
// Sesión 3 añadirá la vista "proyección" timeline con recharts.
// Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8

const minToHorasStr = (min) => {
  if (!min) return '0';
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

// Δ% en una décima vs currículo. -3.0 / -10.0 son las fronteras de tonalidad.
const computeDelta = (plan, curr) => {
  if (!curr || curr <= 0) return 0;
  return Math.round(1000 * (plan - curr) / curr) / 10;
};

// neutral cuando la materia no consume horas semanales (FCT, etc).
const toneFor = (delta, curriculo) => {
  if (!curriculo || curriculo <= 0) return 'neutral';
  if (delta >= -3) return 'ok';
  if (delta >= -10) return 'warn';
  return 'error';
};

const fmtDateEs = (s) => {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
};

const HorariosConsumicion = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = (user?.roles || []).includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eje, setEje] = useState('rangos');
  const [expandedImpId, setExpandedImpId] = useState(null);

  useEffect(() => {
    const url = isSuperAdmin
      ? '/api/grupos?pagination=false'
      : `/api/grupos?centro=${user?.centro?.id || ''}&pagination=false`;
    fetch(getApiUrl(url), { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const items = d['hydra:member'] || d.member || [];
        setGrupos(items);
        if (items.length > 0 && !selectedGrupo) {
          setSelectedGrupo(String(items[0].id));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, user?.centro?.id]);

  useEffect(() => {
    if (!selectedGrupo) {
      setData(null);
      return;
    }
    setLoading(true);
    setExpandedImpId(null);
    fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/consumicion-anual`), {
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [selectedGrupo]);

  const grupoOpts = useMemo(() => grupos.map(g => ({
    value: String(g.id),
    label: formatGrupoNombre(g),
  })), [grupos]);

  const rangosById = useMemo(
    () => Object.fromEntries((data?.rangos || []).map(r => [r.id, r])),
    [data]
  );
  const evalsById = useMemo(
    () => Object.fromEntries((data?.evaluaciones || []).map(e => [e.id, e])),
    [data]
  );

  const groupSummary = useMemo(() => {
    if (!data?.materias) return null;
    const totalCurr = data.materias.reduce((a, m) => a + m.minutosCurriculo, 0);
    const totalPlan = data.materias.reduce((a, m) => a + m.minutosPlanificadoTotal, 0);
    const totalImp = data.materias.reduce((a, m) => a + m.minutosImpartidosHoy, 0);
    const delta = computeDelta(totalPlan, totalCurr);
    return {
      totalCurr,
      totalPlan,
      totalImp,
      delta,
      tone: toneFor(delta, totalCurr),
    };
  }, [data]);

  const semanasTotales = useMemo(() => {
    if (!data) return 0;
    const arr = eje === 'rangos' ? data.rangos : data.evaluaciones;
    return (arr || []).reduce((acc, r) => acc + (r.semanas || 0), 0);
  }, [data, eje]);

  const ejeCount = eje === 'rangos' ? (data?.rangos?.length || 0) : (data?.evaluaciones?.length || 0);
  const noEvaluacionesAvailable = (data?.evaluaciones?.length || 0) === 0;

  const renderDetailRow = (m) => {
    const subRows = eje === 'rangos' ? m.porRango : m.porEvaluacion;
    return (
      <tr className={styles.detailRow}>
        <td colSpan={6}>
          <div className={styles.detailWrap}>
            {(subRows || []).map((p) => {
              const id = eje === 'rangos' ? p.rangoId : p.evaluacionId;
              const meta = eje === 'rangos' ? rangosById[id] : evalsById[id];
              if (!meta) return null;
              const planH = minToHorasStr(p.minutosPlanificados);
              const impH = minToHorasStr(p.minutosImpartidos);
              return (
                <div key={id} className={styles.detailItem}>
                  <div className={styles.detailItemHeader}>
                    <span className={styles.detailItemName}>{meta.nombre || `#${id}`}</span>
                    <span className={styles.detailItemDates}>
                      {fmtDateEs(meta.fechaInicio)} → {fmtDateEs(meta.fechaFin)}
                    </span>
                  </div>
                  <div className={styles.detailItemBody}>
                    {eje === 'rangos' && p.minutosSemanales != null && (
                      <span>
                        {t('scheduleEditor.consumption.detailMinSem', {
                          min: p.minutosSemanales,
                        })}
                      </span>
                    )}
                    <span>{t('scheduleEditor.consumption.detailPlan', { h: planH })}</span>
                    <span>{t('scheduleEditor.consumption.detailImp', { h: impH })}</span>
                    <span className={styles.detailItemMeta}>
                      {t('scheduleEditor.consumption.detailWeeks', {
                        sem: (meta.semanas || 0).toFixed(1),
                        semTrans: (meta.semanasTranscurridas || 0).toFixed(1),
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.container}>
      <CrudHeader
        title={t('scheduleEditor.consumption.title')}
        subtitle={t('scheduleEditor.consumption.subtitle')}
        middle={tabs}
      />

      <div className={styles.toolbar}>
        <div className={styles.selectorBox}>
          <ThemedSelect
            value={selectedGrupo}
            onChange={(v) => setSelectedGrupo(v)}
            options={grupoOpts}
            placeholder={t('scheduleEditor.consumption.selectGroupHint')}
          />
        </div>
        {data && data.rangos && (
          <div className={styles.headerStat}>
            {t('scheduleEditor.consumption.headerStat', {
              percent: data.porcentajeCursoTranscurrido,
              trans: data.diasLectivosTranscurridos,
              total: data.diasLectivosTotales,
            })}
          </div>
        )}
        {data && (
          <div className={styles.axisToggle} role="tablist" aria-label={t('scheduleEditor.consumption.axisToggleLabel')}>
            <button
              type="button"
              role="tab"
              aria-selected={eje === 'rangos'}
              className={`${styles.axisPill} ${eje === 'rangos' ? styles.axisPillActive : ''}`}
              onClick={() => { setEje('rangos'); setExpandedImpId(null); }}
            >
              {t('scheduleEditor.consumption.axisRangos')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={eje === 'evaluaciones'}
              disabled={noEvaluacionesAvailable}
              title={noEvaluacionesAvailable ? t('scheduleEditor.consumption.noEvaluations') : ''}
              className={`${styles.axisPill} ${eje === 'evaluaciones' ? styles.axisPillActive : ''}`}
              onClick={() => { setEje('evaluaciones'); setExpandedImpId(null); }}
            >
              {t('scheduleEditor.consumption.axisEvaluaciones')}
            </button>
          </div>
        )}
      </div>

      {loading && <div className={styles.empty}>{t('scheduleEditor.consumption.loading')}</div>}

      {!loading && data && data.rangos && data.rangos.length === 0 && (
        <div className={styles.empty}>{t('scheduleEditor.consumption.noRanges')}</div>
      )}

      {!loading && data && data.rangos && data.rangos.length > 0 && (
        <>
          {groupSummary && (
            <div className={`${styles.banner} ${styles[`banner_${groupSummary.tone}`]}`}>
              <div className={styles.bannerTitle}>
                {t(`scheduleEditor.consumption.banner_${groupSummary.tone}`, { delta: groupSummary.delta })}
              </div>
              <div className={styles.bannerStats}>
                {t('scheduleEditor.consumption.bannerStats', {
                  curr: minToHorasStr(groupSummary.totalCurr),
                  plan: minToHorasStr(groupSummary.totalPlan),
                  imp: minToHorasStr(groupSummary.totalImp),
                })}
              </div>
            </div>
          )}

          <div className={styles.rangosSummary}>
            {t(eje === 'rangos' ? 'scheduleEditor.consumption.rangosSummary' : 'scheduleEditor.consumption.evalsSummary', {
              count: ejeCount,
              semanas: semanasTotales.toFixed(1),
            })}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.expanderCol} aria-hidden="true"></th>
                  <th>{t('scheduleEditor.consumption.colMateria')}</th>
                  <th>{t('scheduleEditor.consumption.colModalidad')}</th>
                  <th className={styles.numCol}>{t('scheduleEditor.consumption.colCurriculo')}</th>
                  <th className={styles.numCol}>{t('scheduleEditor.consumption.colPlanificado')}</th>
                  <th className={styles.numCol}>{t('scheduleEditor.consumption.colImpartidoHoy')}</th>
                  <th className={styles.numCol}>{t('scheduleEditor.consumption.colDelta')}</th>
                </tr>
              </thead>
              <tbody>
                {data.materias.map((m) => {
                  const curr = m.minutosCurriculo;
                  const plan = m.minutosPlanificadoTotal;
                  const delta = computeDelta(plan, curr);
                  const tone = toneFor(delta, curr);
                  const isExpanded = expandedImpId === m.imparticionId;
                  return (
                    <React.Fragment key={m.imparticionId}>
                      <tr
                        className={`${styles[`row_${tone}`]} ${styles.expandableRow} ${isExpanded ? styles.expandedRow : ''}`}
                        onClick={() => setExpandedImpId(isExpanded ? null : m.imparticionId)}
                      >
                        <td className={styles.expanderCol}>
                          <ChevronRight
                            size={14}
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                          />
                        </td>
                        <td>{m.materiaNombre}</td>
                        <td className={styles.modalidad}>{m.modalidad}</td>
                        <td className={styles.numCol}>{minToHorasStr(curr)}</td>
                        <td className={styles.numCol}>{minToHorasStr(plan)}</td>
                        <td className={styles.numCol}>{minToHorasStr(m.minutosImpartidosHoy)}</td>
                        <td className={`${styles.numCol} ${styles.deltaCell}`}>
                          {curr > 0 ? `${delta > 0 ? '+' : ''}${delta}%` : '—'}
                        </td>
                      </tr>
                      {isExpanded && renderDetailRow(m)}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.footnote}>{t('scheduleEditor.consumption.projectionComing')}</div>
        </>
      )}
    </div>
  );
};

export default HorariosConsumicion;
