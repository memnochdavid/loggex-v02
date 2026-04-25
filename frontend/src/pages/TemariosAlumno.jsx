import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import { FileText, Download } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from "../../public/book.json";
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const TemariosAlumno = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState('');

  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  // Estados para filtros de SuperAdmin
  const [centros, setCentros] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('');
  const [allGrupos, setAllGrupos] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [modulos, setMaterias] = useState([]); // NUEVO
  const [selectedMateria, setSelectedModulo] = useState(''); // NUEVO

  // Cargar centros para SuperAdmin
  useEffect(() => {
      if (isSuperAdmin) {
          fetch(getApiUrl('/api/centros?pagination=false'), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              setCentros(items);
          })
          .catch(err => console.error("Error cargando centros:", err));
      }
  }, [isSuperAdmin]);

  // Cargar grupos cuando cambia el centro seleccionado
  useEffect(() => {
      if (isSuperAdmin && selectedCentro) {
          fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              setAllGrupos(items);
              setSelectedYear('');
              setSelectedGrupo(''); // Resetear grupo al cambiar centro
              setMaterias([]); // Resetear módulos
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando grupos:", err));
      } else {
          setAllGrupos([]);
          setSelectedYear('');
          setSelectedGrupo('');
          setMaterias([]);
          setSelectedModulo('');
      }
  }, [selectedCentro, isSuperAdmin]);

  const availableYears = [...new Set(allGrupos.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
  const grupos = selectedYear ? allGrupos.filter(g => g.anioEscolar === selectedYear) : allGrupos;

  // Cargar módulos cuando cambia el grupo seleccionado (NUEVO)
  useEffect(() => {
      if (isSuperAdmin && selectedGrupo) {
          // Obtener imparticiones del grupo para sacar los módulos
          fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              // Extraer módulos únicos
              const uniqueModulos = [];
              const map = new Map();
              for (const item of items) {
                  if (item.modulo && !map.has(item.modulo.id)) {
                      map.set(item.modulo.id, true);
                      uniqueModulos.push(item.modulo);
                  }
              }
              setMaterias(uniqueModulos);
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando módulos:", err));
      } else {
          setMaterias([]);
          setSelectedModulo('');
      }
  }, [selectedGrupo, isSuperAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        let allImparticiones = [];

        if (isSuperAdmin) {
            // Lógica para SuperAdmin
            let query = 'pagination=false';
            if (selectedMateria) {
                query += `&modulo=${selectedMateria}`;
                if (selectedGrupo) query += `&grupo=${selectedGrupo}`;
            } else if (selectedGrupo) {
                query += `&grupo=${selectedGrupo}`;
            } else if (selectedCentro) {
                query += `&grupo.centro=${selectedCentro}`;
            } else {
                // Si no hay filtros, no cargamos nada para evitar sobrecarga
                setAsignaturas([]);
                setLoading(false);
                return;
            }

            const impRes = await fetch(getApiUrl(`/api/imparticions?${query}`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const impData = await impRes.json();
            allImparticiones = impData['hydra:member'] || impData.member || [];

        } else {
            // Lógica para Alumno normal
            // 1. Obtener matrículas del alumno
            const matriculasRes = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
            });
            const matriculasData = await matriculasRes.json();
            const matriculas = matriculasData['hydra:member'] || matriculasData.member || [];

            if (matriculas.length === 0) {
              setAsignaturas([]);
              setLoading(false);
              return;
            }

            // 2. Obtener grupos de las matrículas activas
            const grupoIds = matriculas.map(m => {
                if (typeof m.grupo === 'string') return m.grupo.split('/').pop();
                return m.grupo.id;
            });

            // Eliminar duplicados
            const uniqueGrupoIds = [...new Set(grupoIds)];

            // 3. Obtener imparticiones de esos grupos
            for (const grupoId of uniqueGrupoIds) {
                const impRes = await fetch(getApiUrl(`/api/imparticions?grupo=${grupoId}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                const impData = await impRes.json();
                const imps = impData['hydra:member'] || impData.member || [];
                allImparticiones = [...allImparticiones, ...imps];
            }
        }

        // 4. Obtener materiales para esas imparticiones (Común)
        const asignaturasData = [];

        for (const imp of allImparticiones) {
            const impId = imp.id || imp['@id'].split('/').pop();
            const matRes = await fetch(getApiUrl(`/api/materials?imparticion=${impId}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const matData = await matRes.json();
            const materiales = matData['hydra:member'] || matData.member || [];

            const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';
            
            // Formato solicitado: [Módulo] ([Grupo]) - [Profesor]
            const title = `${imp.modulo.nombre} (${imp.grupo.abreviatura || imp.grupo.nombre}) - ${nombreProfesor}`;

            const grupoId = typeof imp.grupo === 'string'
                ? imp.grupo.split('/').pop()
                : (imp.grupo?.id || imp.grupo?.['@id']?.split('/').pop());

            asignaturasData.push({
                id: impId,
                title: title,
                profesor: nombreProfesor,
                materiales: materiales,
                grupoId,
            });
        }

        setAsignaturas(asignaturasData);

      } catch (err) {
        console.error("Error cargando materiales:", err);
        setError(t('studentMaterials.errorLoading'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedCentro, selectedGrupo, selectedMateria]);

  // Cargar períodos evaluativos de todos los grupos implicados
  useEffect(() => {
    if (!asignaturas || asignaturas.length === 0) { setPeriodos([]); return; }
    const grupoIds = [...new Set(asignaturas.map(a => a.grupoId).filter(Boolean))];
    if (grupoIds.length === 0) { setPeriodos([]); return; }

    const fetchAll = async () => {
      try {
        const results = await Promise.all(grupoIds.map(gid =>
          fetch(getApiUrl(`/api/periodo_evaluativos?grupo=${gid}&order[fechaInicio]=asc`), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
          }).then(r => r.ok ? r.json() : null)
        ));
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const byKey = new Map();
        results.forEach(r => {
          if (!r) return;
          const items = r['hydra:member'] || r.member || [];
          items.forEach(p => {
            if (!p.fechaFin || new Date(p.fechaFin) >= hoy) return;
            const key = `${p.tipo || ''}::${p.nombre || ''}`;
            if (!byKey.has(key)) byKey.set(key, { key, nombre: p.nombre, tipo: p.tipo, rangos: [] });
            byKey.get(key).rangos.push({ fechaInicio: p.fechaInicio, fechaFin: p.fechaFin });
          });
        });
        const merged = Array.from(byKey.values()).sort((a, b) => {
          const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
          const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
          if (aExtra !== bExtra) return aExtra - bExtra;
          const aMin = a.rangos.map(r => r.fechaInicio).sort()[0] || '';
          const bMin = b.rangos.map(r => r.fechaInicio).sort()[0] || '';
          return aMin.localeCompare(bMin);
        });
        setPeriodos(merged);
      } catch { /* no crítico */ }
    };
    fetchAll();
  }, [asignaturas]);

  const periodoRanges = useMemo(() => {
    if (!selectedPeriodo) return null;
    const p = periodos.find(pp => pp.key === selectedPeriodo);
    if (!p) return null;
    return p.rangos.map(r => {
      const ini = new Date(r.fechaInicio);
      const fin = new Date(r.fechaFin);
      fin.setHours(23, 59, 59, 999);
      return { ini, fin };
    });
  }, [selectedPeriodo, periodos]);

  const enPeriodo = (mat) => {
    if (!periodoRanges) return true;
    if (!mat.fechaSubida) return false;
    const d = new Date(mat.fechaSubida);
    return periodoRanges.some(r => d >= r.ini && d <= r.fin);
  };

  const renderMateriales = (asignatura) => {
    const filtrados = asignatura.materiales.filter(enPeriodo);
    if (filtrados.length === 0) {
      return <div className={styles.emptyState}>{t('studentMaterials.noMaterialsAvailable')}</div>;
    }

    return (
      <ul className={styles.list}>
        {filtrados.map(mat => (
          <li key={mat.id} className={styles.listItem}>
            <div className={styles.itemInfo}>
                <FileText size={20} className={styles.icon} />
                <span>{mat.titulo}</span>
                <span className={styles.date}>
                    {new Date(mat.fechaSubida).toLocaleDateString()}
                </span>
            </div>
            <div className={styles.itemActions}>
                <a 
                    href={getAssetUrl(`/uploads/materiales/${mat.id}/${mat.archivo}`)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.downloadLink}
                    download
                >
                    <Download size={18} />
                </a>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader title={t('studentMaterials.title')}
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
            {isSuperAdmin && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <ThemedSelect
                        value={selectedCentro}
                        onChange={setSelectedCentro}
                        minWidth={200}
                        ariaLabel={t('common.allCenters')}
                        options={[
                            { value: '', label: t('common.allCenters') },
                            ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                        ]}
                    />
                    {availableYears.length > 0 && (
                        <ThemedSelect
                            value={selectedYear}
                            onChange={(v) => { setSelectedYear(v); setSelectedGrupo(''); }}
                            disabled={!selectedCentro}
                            minWidth={140}
                            ariaLabel={t('grades.allYears')}
                            options={[
                                { value: '', label: t('grades.allYears') },
                                ...availableYears.map(y => ({ value: y, label: y })),
                            ]}
                        />
                    )}
                    <ThemedSelect
                        value={selectedGrupo}
                        onChange={setSelectedGrupo}
                        disabled={!selectedCentro}
                        minWidth={150}
                        ariaLabel={t('common.allGroups')}
                        options={[
                            { value: '', label: t('common.allGroups') },
                            ...grupos.map(g => ({ value: String(g.id), label: g.nombre })),
                        ]}
                    />
                    <ThemedSelect
                        value={selectedMateria}
                        onChange={setSelectedModulo}
                        disabled={!selectedGrupo}
                        minWidth={150}
                        ariaLabel={t('common.allModules')}
                        options={[
                            { value: '', label: t('common.allModules') },
                            ...modulos.map(m => ({ value: String(m.id), label: m.nombre })),
                        ]}
                    />
                </div>
            )}
            {periodos.length > 0 && (
                <ThemedSelect
                    value={selectedPeriodo}
                    onChange={setSelectedPeriodo}
                    minWidth={180}
                    ariaLabel={t('grades.allPeriods')}
                    options={[
                        { value: '', label: t('grades.allPeriods') },
                        ...periodos.map(p => ({ value: p.key, label: p.nombre })),
                    ]}
                />
            )}
        </CrudHeader>

        {loading ? (
          <LoadingView />
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                {isSuperAdmin && !selectedCentro 
                    ? t('studentMaterials.selectCenter')
                    : t('studentMaterials.noMaterials')}
            </div>
        ) : (
          <AccordionView
            data={asignaturas}
            renderItem={renderMateriales}
            renderHeader={(a) => {
              const count = (a.materiales || []).filter(enPeriodo).length;
              return (
                <span className="accordionHeaderWithCount">
                  <span className="accordionHeaderTitle">{a.title}</span>
                  <span className="accordionHeaderCount" aria-label={t('common.count', 'Total')}>{count}</span>
                </span>
              );
            }}
            canAdd={false}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
          />
        )}
      </div>
    </Layout>
  );
};

export default TemariosAlumno;
