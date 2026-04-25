import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, Trash2, Upload } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const TemariosProfesor = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const fileInputRef = useRef(null);
  
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  // Estados para filtros de SuperAdmin
  const [centros, setCentros] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('');
  const [allGrupos, setAllGrupos] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');

  // Estado Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImparticionId, setCurrentImparticionId] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    archivo: null
  });
  const [uploading, setUploading] = useState(false);

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
          })
          .catch(err => console.error("Error cargando grupos:", err));
      } else {
          setAllGrupos([]);
          setSelectedYear('');
          setSelectedGrupo('');
      }
  }, [selectedCentro, isSuperAdmin]);

  const availableYears = [...new Set(allGrupos.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
  const grupos = selectedYear ? allGrupos.filter(g => g.anioEscolar === selectedYear) : allGrupos;

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      let endpoint = '';
      if (isSuperAdmin) {
           // Lógica de filtrado para SuperAdmin
           let query = 'pagination=false';
           if (selectedGrupo) {
               query += `&grupo=${selectedGrupo}`;
           } else if (selectedCentro) {
               query += `&grupo.centro=${selectedCentro}`;
           }
           endpoint = getApiUrl(`/api/imparticions?${query}`);
      } else {
           // Profesor normal
           endpoint = getApiUrl(`/api/imparticions?profesor=${user.id}&pagination=false`);
      }

      // 1. Obtener imparticiones
      const impRes = await fetch(endpoint, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
      });
      const impData = await impRes.json();
      const imparticiones = impData['hydra:member'] || impData.member || [];

      // 2. Obtener materiales para cada impartición
      const asignaturasData = [];

      for (const imp of imparticiones) {
          const impId = imp.id || imp['@id'].split('/').pop();
          const matRes = await fetch(getApiUrl(`/api/materials?imparticion=${impId}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          });
          const matData = await matRes.json();
          const materiales = matData['hydra:member'] || matData.member || [];

          const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';
          let title = `${(imp.materia ?? imp.modulo).nombre} - ${imp.grupo.abreviatura || imp.grupo.nombre}`;
          if (isSuperAdmin && nombreProfesor) {
              title += ` (${nombreProfesor})`;
          }

          asignaturasData.push({
              id: impId,
              title: title,
              materiales: materiales
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

  useEffect(() => {
    fetchData();
  }, [user, selectedCentro, selectedGrupo]);

  const handleAddClick = (imparticionId) => {
    setCurrentImparticionId(imparticionId);
    setFormData({ titulo: '', archivo: null });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentImparticionId(null);
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'archivo') {
        setFormData(prev => ({ ...prev, archivo: files[0] }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.archivo || !formData.titulo) {
        toast.warning(t('teacherMaterials.fillAllFields'));
        return;
    }

    setUploading(true);

    try {
        const data = new FormData();
        data.append('file', formData.archivo);
        data.append('titulo', formData.titulo);
        data.append('imparticionId', currentImparticionId);

        const response = await fetch(getApiUrl('/api/temarios/upload'), {
            method: 'POST',
            body: data,
            credentials: 'include'
        });

        if (!response.ok) {
            const message = await parseErrorResponse(response, t('teacherMaterials.errorUpload'));
            throw new Error(message);
        }

        await fetchData();
        handleCloseModal();
        toast.success(t('teacherMaterials.uploadSuccess', { defaultValue: 'Material subido' }));

    } catch (err) {
        console.error("Error subiendo material:", err);
        toast.error(err.message, {
          description: t('teacherMaterials.errorUploadCtx', { defaultValue: 'No se ha podido subir el material' })
        });
    } finally {
        setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
      if (!(await confirm({ body: t('teacherMaterials.confirmDelete') }))) return;

      try {
          const response = await fetch(getApiUrl(`/api/materials/${materialId}`), {
              method: 'DELETE',
              credentials: 'include'
          });

          if (!response.ok) {
            const message = await parseErrorResponse(response, t('teacherMaterials.errorDelete'));
            throw new Error(message);
          }

          fetchData();
          toast.success(t('teacherMaterials.deletedSuccess', { defaultValue: 'Material eliminado' }));
      } catch (err) {
          console.error(err);
          toast.error(err.message, {
            description: t('teacherMaterials.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar el material' })
          });
      }
  };

  const renderMateriales = (asignatura) => {
    if (asignatura.materiales.length === 0) {
      return <div className={styles.emptyState}>{t('teacherMaterials.noMaterials')}</div>;
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
                    href={getAssetUrl(`/uploads/materiales/${mat.id}/${mat.archivo}`)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.downloadLink}
                    download
                >
                    <Download size={18} />
                </a>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(mat.id)}
                    title={t('common.delete')}
                >
                    <Trash2 size={18} />
                </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader title={t('teacherMaterials.title')}
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
                </div>
            )}
        </CrudHeader>

        {loading ? (
          <LoadingView />
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                {isSuperAdmin && !selectedCentro 
                    ? t('teacherMaterials.selectCenter')
                    : t('teacherMaterials.noSubjects')}
            </div>
        ) : (
          <AccordionView
            data={asignaturas}
            renderItem={renderMateriales}
            onAdd={handleAddClick}
            canAdd={true}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
          />
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={t('teacherMaterials.uploadTitle')}
            onSubmit={handleSubmit}
            isSubmitting={uploading}
            submitText={t('teacherMaterials.uploadBtn')}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teacherMaterials.titleLabel')}</label>
                <input 
                    type="text" 
                    name="titulo" 
                    value={formData.titulo} 
                    onChange={handleInputChange} 
                    className={styles.input} 
                    required 
                    placeholder={t('teacherMaterials.titlePlaceholder')}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teacherMaterials.fileLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input 
                        type="file" 
                        name="archivo" 
                        ref={fileInputRef}
                        onChange={handleInputChange} 
                        className={styles.fileInput}
                        style={{ display: 'none' }}
                        required 
                    />
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => fileInputRef.current.click()}
                    >
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        {formData.archivo ? t('common.changeFile') : t('common.selectFile')}
                    </Button>
                    {formData.archivo && (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {formData.archivo.name}
                        </span>
                    )}
                </div>
            </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default TemariosProfesor;
