import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import ThemedSelect from '../components/ThemedSelect';
import CrudHeader from '../components/CrudHeader';
import { formatGrupoNombre } from '../utils/grupo';
import styles from './HorariosConsumicion.module.css';

// Tab "Consumición de horas anuales" del editor /admin/horarios.
// Sesión 1: vista mínima (tabla por materia + cabecera con % curso transcurrido).
// Sesión 2 añadirá tonalidad y toggle rango↔evaluación; sesión 3 timeline.
// Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8

const minToHorasStr = (min) => {
  if (!min) return '0';
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

const HorariosConsumicion = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = (user?.roles || []).includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const semanasTotales = useMemo(() => {
    if (!data?.rangos) return 0;
    return data.rangos.reduce((acc, r) => acc + (r.semanas || 0), 0);
  }, [data]);

  const content = (
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
      </div>

      {loading && <div className={styles.empty}>{t('scheduleEditor.consumption.loading')}</div>}

      {!loading && data && data.rangos && data.rangos.length === 0 && (
        <div className={styles.empty}>{t('scheduleEditor.consumption.noRanges')}</div>
      )}

      {!loading && data && data.rangos && data.rangos.length > 0 && (
        <>
          <div className={styles.rangosSummary}>
            {t('scheduleEditor.consumption.rangosSummary', {
              count: data.rangos.length,
              semanas: semanasTotales.toFixed(1),
            })}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
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
                  const delta = curr > 0 ? Math.round(1000 * (plan - curr) / curr) / 10 : 0;
                  return (
                    <tr key={m.imparticionId}>
                      <td>{m.materiaNombre}</td>
                      <td className={styles.modalidad}>{m.modalidad}</td>
                      <td className={styles.numCol}>{minToHorasStr(curr)}</td>
                      <td className={styles.numCol}>{minToHorasStr(plan)}</td>
                      <td className={styles.numCol}>{minToHorasStr(m.minutosImpartidosHoy)}</td>
                      <td className={styles.numCol}>{delta > 0 ? '+' : ''}{delta}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.footnote}>{t('scheduleEditor.consumption.noDataYet')}</div>
        </>
      )}
    </div>
  );

  return content;
};

export default HorariosConsumicion;
