import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, AlertTriangle, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import ThemedSelect from '../components/ThemedSelect';
import CrudHeader from '../components/CrudHeader';
import { formatGrupoNombre } from '../utils/grupo';
import styles from './HorariosConsumicion.module.css';

// Tab "Consumición de horas anuales" del editor /admin/horarios.
// Sesión 3 (cierra Fase 8): vista "Proyección" con timeline de líneas
// (ideal currículo / planificado acumulado / impartido teórico) por
// materia + banner de sugerencias cuando hay déficit.
// Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8

const minToHorasStr = (min) => {
  if (!min) return '0';
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

const computeDelta = (plan, curr) => {
  if (!curr || curr <= 0) return 0;
  return Math.round(1000 * (plan - curr) / curr) / 10;
};

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

const SS_KEY = 'horariosConsumicion.prefs.v1';

const HorariosConsumicion = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = (user?.roles || []).includes('ROLE_SUPERADMIN');

  const initialPrefs = (() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { vista: 'tabla', eje: 'rangos' };
  })();

  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eje, setEje] = useState(initialPrefs.eje || 'rangos');
  const [vista, setVista] = useState(initialPrefs.vista || 'tabla');
  const [expandedImpId, setExpandedImpId] = useState(null);
  const [selectedMateria, setSelectedMateria] = useState('');

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ vista, eje }));
    } catch { /* ignore */ }
  }, [vista, eje]);

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

  // Cuando llega data nueva, default selectedMateria a la primera con currículo > 0.
  useEffect(() => {
    if (!data?.materias?.length) {
      setSelectedMateria('');
      return;
    }
    const stillExists = data.materias.some(m => String(m.imparticionId) === selectedMateria);
    if (!stillExists) {
      const firstWithCurr = data.materias.find(m => m.minutosCurriculo > 0) || data.materias[0];
      setSelectedMateria(String(firstWithCurr.imparticionId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const grupoOpts = useMemo(() => grupos.map(g => ({
    value: String(g.id),
    label: formatGrupoNombre(g),
  })), [grupos]);

  const materiaOpts = useMemo(() => (data?.materias || []).map(m => ({
    value: String(m.imparticionId),
    label: m.materiaNombre || `#${m.imparticionId}`,
  })), [data]);

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

  // Materias con déficit > 3% — base de la sugerencia.
  const sugerencias = useMemo(() => {
    if (!data?.materias) return [];
    return data.materias
      .map(m => ({ ...m, delta: computeDelta(m.minutosPlanificadoTotal, m.minutosCurriculo) }))
      .filter(m => m.minutosCurriculo > 0 && m.delta < -3)
      .sort((a, b) => a.delta - b.delta);
  }, [data]);

  const semanasTotales = useMemo(() => {
    if (!data) return 0;
    const arr = eje === 'rangos' ? data.rangos : data.evaluaciones;
    return (arr || []).reduce((acc, r) => acc + (r.semanas || 0), 0);
  }, [data, eje]);

  const ejeCount = eje === 'rangos' ? (data?.rangos?.length || 0) : (data?.evaluaciones?.length || 0);
  const noEvaluacionesAvailable = (data?.evaluaciones?.length || 0) === 0;

  // Serie de hitos para el chart de proyección (eje rangos).
  const chartSeries = useMemo(() => {
    if (!data?.rangos?.length || !selectedMateria) return [];
    const m = data.materias.find(mat => String(mat.imparticionId) === String(selectedMateria));
    if (!m) return [];

    const totalCurrH = m.minutosCurriculo / 60;
    const totalDias = data.diasLectivosTotales || 1;
    const fr = data.fechaReferencia;
    const inicio = data.rangos[0].fechaInicio;

    const points = [{
      fecha: inicio,
      label: fmtDateEs(inicio),
      ideal: 0,
      plan: 0,
      impartido: 0,
    }];

    let planAccMin = 0;
    let impAccMin = 0;
    let diasAcc = 0;
    let frInsertado = false;

    data.rangos.forEach((r) => {
      const por = (m.porRango || []).find(p => p.rangoId === r.id) || { minutosPlanificados: 0, minutosImpartidos: 0 };

      // Si fechaRef cae dentro de este rango (entre el último hito y el fin), añade un hito intermedio.
      const lastHitFecha = points[points.length - 1].fecha;
      if (!frInsertado && fr > lastHitFecha && fr < r.fechaFin) {
        const fracR = r.diasLectivos > 0 ? (r.diasLectivosTranscurridos || 0) / r.diasLectivos : 0;
        const planFRMin = planAccMin + (por.minutosPlanificados || 0) * fracR;
        const idealFRH = totalCurrH * (data.diasLectivosTranscurridos || 0) / totalDias;
        points.push({
          fecha: fr,
          label: `${fmtDateEs(fr)} (hoy)`,
          ideal: idealFRH,
          plan: planFRMin / 60,
          impartido: m.minutosImpartidosHoy / 60,
        });
        frInsertado = true;
      }

      planAccMin += por.minutosPlanificados || 0;
      impAccMin += por.minutosImpartidos || 0;
      diasAcc += r.diasLectivos || 0;
      const idealH = totalCurrH * diasAcc / totalDias;

      points.push({
        fecha: r.fechaFin,
        label: fmtDateEs(r.fechaFin),
        ideal: idealH,
        plan: planAccMin / 60,
        impartido: r.fechaFin <= fr ? impAccMin / 60 : null,
      });
    });

    return points;
  }, [data, selectedMateria]);

  const selectedMateriaObj = useMemo(() => {
    if (!data?.materias || !selectedMateria) return null;
    return data.materias.find(m => String(m.imparticionId) === String(selectedMateria)) || null;
  }, [data, selectedMateria]);

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

  const renderTablaView = () => (
    <>
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
    </>
  );

  const renderProyeccionView = () => {
    const fr = data.fechaReferencia;
    const finalCurrH = (selectedMateriaObj?.minutosCurriculo || 0) / 60;
    const finalPlanH = (selectedMateriaObj?.minutosPlanificadoTotal || 0) / 60;
    const finalDelta = selectedMateriaObj
      ? computeDelta(selectedMateriaObj.minutosPlanificadoTotal, selectedMateriaObj.minutosCurriculo)
      : 0;
    const finalTone = selectedMateriaObj
      ? toneFor(finalDelta, selectedMateriaObj.minutosCurriculo)
      : 'neutral';

    return (
      <div className={styles.proyeccionWrap}>
        <div className={styles.proyeccionToolbar}>
          <div className={styles.materiaPicker}>
            <ThemedSelect
              value={selectedMateria}
              onChange={(v) => setSelectedMateria(v)}
              options={materiaOpts}
              placeholder={t('scheduleEditor.consumption.selectMateria')}
            />
          </div>
          {selectedMateriaObj && (
            <div className={`${styles.materiaSummary} ${styles[`row_${finalTone}`]}`}>
              <span>{t('scheduleEditor.consumption.chartFinalCurr', { h: finalCurrH.toFixed(1) })}</span>
              <span>{t('scheduleEditor.consumption.chartFinalPlan', { h: finalPlanH.toFixed(1) })}</span>
              <span className={styles.deltaCell}>
                {finalCurrH > 0 ? `${finalDelta > 0 ? '+' : ''}${finalDelta}%` : '—'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartSeries} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--text-muted)"
                label={{
                  value: t('scheduleEditor.consumption.chartYAxis'),
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: 'var(--text-muted)' },
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v, name) => [v != null ? `${Number(v).toFixed(1)} h` : '—', name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <ReferenceLine
                x={chartSeries.find(p => p.label.includes('(hoy)'))?.label}
                stroke="var(--text-muted)"
                strokeDasharray="2 2"
                label={{ value: t('scheduleEditor.consumption.chartToday'), fontSize: 10, fill: 'var(--text-muted)', position: 'top' }}
              />
              <Line
                type="monotone"
                dataKey="ideal"
                name={t('scheduleEditor.consumption.chartLegendIdeal')}
                stroke="var(--text-muted)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="plan"
                name={t('scheduleEditor.consumption.chartLegendPlan')}
                stroke="var(--color-primary, #3b82f6)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="impartido"
                name={t('scheduleEditor.consumption.chartLegendImp')}
                stroke="var(--success, #16a34a)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {sugerencias.length > 0 && (
          <div className={styles.suggestions}>
            <div className={styles.suggestionsTitle}>
              <AlertTriangle size={16} />
              {t('scheduleEditor.consumption.suggestionTitle', { count: sugerencias.length })}
            </div>
            <ul className={styles.suggestionsList}>
              {sugerencias.slice(0, 5).map(s => (
                <li key={s.imparticionId}>
                  {t('scheduleEditor.consumption.suggestionItem', {
                    materia: s.materiaNombre,
                    faltanH: Math.ceil((s.minutosCurriculo - s.minutosPlanificadoTotal) / 60),
                    delta: s.delta,
                  })}
                </li>
              ))}
            </ul>
            <div className={styles.suggestionsFootnote}>
              {t('scheduleEditor.consumption.suggestionHint')}
            </div>
          </div>
        )}

        {sugerencias.length === 0 && (
          <div className={styles.suggestionsOk}>
            <Sparkles size={16} />
            {t('scheduleEditor.consumption.suggestionAllOk')}
          </div>
        )}
      </div>
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
          <div className={styles.toggleStack}>
            <div className={styles.axisToggle} role="tablist" aria-label={t('scheduleEditor.consumption.viewToggleLabel')}>
              <button
                type="button"
                role="tab"
                aria-selected={vista === 'tabla'}
                className={`${styles.axisPill} ${vista === 'tabla' ? styles.axisPillActive : ''}`}
                onClick={() => setVista('tabla')}
              >
                {t('scheduleEditor.consumption.viewTabla')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vista === 'proyeccion'}
                className={`${styles.axisPill} ${vista === 'proyeccion' ? styles.axisPillActive : ''}`}
                onClick={() => setVista('proyeccion')}
              >
                {t('scheduleEditor.consumption.viewProyeccion')}
              </button>
            </div>
            {vista === 'tabla' && (
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

          {vista === 'tabla' ? renderTablaView() : renderProyeccionView()}
        </>
      )}
    </div>
  );
};

export default HorariosConsumicion;
