import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { FileText, Download } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl, getAssetUrl } from '../config/api';
import bookAnimation from "../../public/book.json";

const MaterialesAlumno = () => {
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

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

        // Filtrar por año escolar actual (opcional, por ahora todas)
        const matriculasActivas = matriculas;

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
            const impRes = await fetch(getApiUrl(`/api/imparticions?grupo=${grupoId}&pagination=false`), {
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
            const matRes = await fetch(getApiUrl(`/api/materials?imparticion=${impId}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const matData = await matRes.json();
            const materiales = matData['hydra:member'] || matData.member || [];

            asignaturasData.push({
                id: impId,
                title: `${imp.modulo.nombre} (${imp.grupo.nombre})`,
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
            <a 
                href={getAssetUrl(`/uploads/materiales/${mat.archivo}`)}
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
        <CrudHeader title="Mis Apuntes"
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        />

        {loading ? (
          <div className={styles.loadingContainer}>Cargando...</div>
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
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
