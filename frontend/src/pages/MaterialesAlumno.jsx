import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import { useAuth } from '../context/AuthContext';
import { FileText, Download } from 'lucide-react';
import styles from './Materiales.module.css';

const MaterialesAlumno = () => {
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // const getCurrentSchoolYear = () => {
  //   const now = new Date();
  //   const year = now.getFullYear();
  //   const month = now.getMonth(); // 0-11
  //   // Si estamos en Septiembre (8) o después, el curso es YYYY/YYYY+1
  //   // Si estamos antes de Septiembre, el curso es YYYY-1/YYYY
  //   if (month >= 8) {
  //       return `${year}/${year + 1}`;
  //   } else {
  //       return `${year - 1}/${year}`;
  //   }
  // };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // 1. Obtener matrículas del alumno
        const matriculasRes = await fetch(`https://localhost:9443/api/matriculas?alumno=${user.id}&pagination=false`, {
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

        // Filtrar por año escolar actual
        // const currentYear = getCurrentSchoolYear();
        // Nota: Asumimos que el grupo viene embebido. Si no, habría que hacer fetch.
        // Pero según la entidad Grupo, anioEscolar está en matricula:read
        const matriculasActivas = matriculas.filter(m => {
            if (m.grupo && m.grupo.anioEscolar) {
                return m.grupo.anioEscolar === currentYear;
            }
            return true; // Si no podemos determinar el año, lo incluimos por si acaso (o false para ser estrictos)
        });

        // Si no hay matrículas activas, mostramos mensaje o nada
        if (matriculasActivas.length === 0 && matriculas.length > 0) {
             // Opcional: Mostrar las de otros años si no hay activas, o mostrar mensaje.
             // Por ahora mostramos solo activas.
        }

        // 2. Obtener grupos de las matrículas activas
        const grupoIds = matriculasActivas.map(m => {
            if (typeof m.grupo === 'string') return m.grupo.split('/').pop();
            return m.grupo.id;
        });

        // Eliminar duplicados
        const uniqueGrupoIds = [...new Set(grupoIds)];

        // 3. Obtener imparticiones de esos grupos
        let allImparticiones = [];
        for (const grupoId of uniqueGrupoIds) {
            const impRes = await fetch(`https://localhost:9443/api/imparticions?grupo=${grupoId}&pagination=false`, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const impData = await impRes.json();
            const imps = impData['hydra:member'] || impData.member || [];
            allImparticiones = [...allImparticiones, ...imps];
        }

        // 4. Obtener materiales para esas imparticiones
        const asignaturasData = [];

        for (const imp of allImparticiones) {
            const impId = imp.id || imp['@id'].split('/').pop();
            const matRes = await fetch(`https://localhost:9443/api/materials?imparticion=${impId}&pagination=false`, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const matData = await matRes.json();
            const materiales = matData['hydra:member'] || matData.member || [];

            asignaturasData.push({
                id: impId,
                title: `${imp.modulo.nombre} (${imp.grupo.nombre})`, // Añadido nombre del grupo
                profesor: `${imp.profesor.nombre} ${imp.profesor.apellidos}`,
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
  }, [user]);

  const renderMateriales = (asignatura) => {
    if (asignatura.materiales.length === 0) {
      return <p className={styles.emptyMessage}>No hay apuntes disponibles.</p>;
    }

    return (
      <ul className={styles.materialList}>
        {asignatura.materiales.map(mat => (
          <li key={mat.id} className={styles.materialItem}>
            <div className={styles.materialInfo}>
                <FileText size={20} className={styles.icon} />
                <span>{mat.titulo}</span>
                <span className={styles.date}>
                    {new Date(mat.fechaSubida).toLocaleDateString()}
                </span>
            </div>
            <a 
                href={`https://localhost:9443/uploads/materiales/${mat.archivo}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.downloadLink}
                download
            >
                <Download size={18} />
            </a>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Mis Apuntes</h1>
        {loading ? (
          <p>Cargando...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
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
