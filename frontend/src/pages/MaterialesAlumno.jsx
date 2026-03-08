import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { FileText, Download } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from "../../public/book.json";

const MaterialesAlumno = () => {
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  // Estados para filtros de SuperAdmin
  const [centros, setCentros] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [modulos, setModulos] = useState([]); // NUEVO
  const [selectedModulo, setSelectedModulo] = useState(''); // NUEVO

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
              setGrupos(items);
              setSelectedGrupo(''); // Resetear grupo al cambiar centro
              setModulos([]); // Resetear módulos
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando grupos:", err));
      } else {
          setGrupos([]);
          setSelectedGrupo('');
          setModulos([]);
          setSelectedModulo('');
      }
  }, [selectedCentro, isSuperAdmin]);

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
              setModulos(uniqueModulos);
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando módulos:", err));
      } else {
          setModulos([]);
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
            if (selectedModulo) {
                query += `&modulo=${selectedModulo}`;
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
            const title = `${imp.modulo.nombre} (${imp.grupo.nombre}) - ${nombreProfesor}`;

            asignaturasData.push({
                id: impId,
                title: title,
                profesor: nombreProfesor,
                materiales: materiales
            });
        }

        setAsignaturas(asignaturasData);

      } catch (err) {
        console.error("Error cargando materiales:", err);
        setError("No se pudieron cargar los apuntes.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedCentro, selectedGrupo, selectedModulo]);

  const renderMateriales = (asignatura) => {
    if (asignatura.materiales.length === 0) {
      return <div className={styles.emptyState}>No hay apuntes disponibles.</div>;
    }

    return (
      <ul className={styles.list}>
        {asignatura.materiales.map(mat => (
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
                    href={getAssetUrl(`/uploads/materiales/${mat.archivo}`)}
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
        <CrudHeader title="Mis Apuntes"
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
            {isSuperAdmin && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select 
                        className={styles.select}
                        value={selectedCentro}
                        onChange={(e) => setSelectedCentro(e.target.value)}
                        style={{ minWidth: '200px' }}
                    >
                        <option value="">Todos los Centros</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>

                    <select 
                        className={styles.select}
                        value={selectedGrupo}
                        onChange={(e) => setSelectedGrupo(e.target.value)}
                        disabled={!selectedCentro}
                        style={{ minWidth: '150px' }}
                    >
                        <option value="">Todos los Grupos</option>
                        {grupos.map(g => (
                            <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                    </select>

                    <select 
                        className={styles.select}
                        value={selectedModulo}
                        onChange={(e) => setSelectedModulo(e.target.value)}
                        disabled={!selectedGrupo}
                        style={{ minWidth: '150px' }}
                    >
                        <option value="">Todos los Módulos</option>
                        {modulos.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
        </CrudHeader>

        {loading ? (
          <div className={styles.loadingContainer}>Cargando...</div>
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                {isSuperAdmin && !selectedCentro 
                    ? "Selecciona un centro para ver los materiales." 
                    : "No se encontraron apuntes."}
            </div>
        ) : (
          <AccordionView 
            data={asignaturas} 
            renderItem={renderMateriales} 
            canAdd={false}
          />
        )}
      </div>
    </Layout>
  );
};

export default MaterialesAlumno;
