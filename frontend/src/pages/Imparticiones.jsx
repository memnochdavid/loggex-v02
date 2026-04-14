import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { usePagination } from "../hooks/usePagination.js";
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';


const Imparticiones = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [imparticiones, setImparticiones] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [allModulos, setAllModulos] = useState([]);
  const [allGrupos, setAllGrupos] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = usePagination('imparticiones');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('profesor.nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  // Campos buscables
  const searchFields = [
      { value: 'profesor.nombre', label: t('teaching.teacher') },
      { value: 'modulo.nombre', label: t('teaching.module') },
      { value: 'grupo.nombre', label: t('teaching.group') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImparticion, setCurrentImparticion] = useState(null);
  const [formData, setFormData] = useState({
    profesor: '',
    modulo: '',
    grupo: ''
  });
  const [saving, setSaving] = useState(false);

  // Listas filtradas para el modal
  const filteredModulos = useMemo(() => {
      if (!formData.grupo) return [];
      
      const selectedGrupo = allGrupos.find(g => String(g.id || g['@id'].split('/').pop()) === String(formData.grupo));
      if (!selectedGrupo) return [];

      return allModulos.filter(m => {
          if (m.curso !== selectedGrupo.curso) return false;
          
          const modCicloId = typeof m.ciclo === 'object' ? (m.ciclo.id || m.ciclo['@id']) : m.ciclo;
          const grupCicloId = typeof selectedGrupo.ciclo === 'object' ? (selectedGrupo.ciclo.id || selectedGrupo.ciclo['@id']) : selectedGrupo.ciclo;
          
          const modCicloIdStr = String(modCicloId).split('/').pop();
          const grupCicloIdStr = String(grupCicloId).split('/').pop();

          return modCicloIdStr === grupCicloIdStr;
      });
  }, [allModulos, allGrupos, formData.grupo]);

  // Cargar centros (solo SuperAdmin)
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

  // Cargar datos auxiliares (filtrados por centro)
  useEffect(() => {
    let urlProfesores = getApiUrl('/api/users?itemsPerPage=100&rol_app=profesor');
    let urlModulos = getApiUrl('/api/modulos?itemsPerPage=100');
    let urlGrupos = getApiUrl('/api/grupos?itemsPerPage=100');
    
    if (isSuperAdmin && selectedCentro) {
        urlProfesores += `&centro=${selectedCentro}`;
        urlModulos += `&ciclo.centro=${selectedCentro}`;
        urlGrupos += `&centro=${selectedCentro}`;
    }
    
    const fetchData = async () => {
        try {
            const [resProf, resMod, resGrup] = await Promise.all([
                fetch(urlProfesores, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }),
                fetch(urlModulos, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }),
                fetch(urlGrupos, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
            ]);

            const dataProf = await resProf.json();
            const dataMod = await resMod.json();
            const dataGrup = await resGrup.json();

            setProfesores(dataProf['hydra:member'] || dataProf.member || []);
            setAllModulos(dataMod['hydra:member'] || dataMod.member || []);
            setAllGrupos(dataGrup['hydra:member'] || dataGrup.member || []);
        } catch (err) {
            console.error("Error cargando datos auxiliares:", err);
        }
    };

    fetchData();
  }, [selectedCentro, isSuperAdmin]);

  const getImparticionId = (i) => {
    if (i.id) return i.id;
    if (i['@id']) {
        const parts = i['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchImparticionesData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/imparticions?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.selectedCentro) {
          url += `&grupo.centro=${params.selectedCentro}`;
      }

      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`;
      }

      if (params.sortColumn) {
          url += `&order[${params.sortColumn}]=${params.sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include',
        signal: abortController.current.signal
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setImparticiones(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching imparticiones:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Efecto ÚNICO para cambios
  useEffect(() => {
      const searchChanged = searchTerm !== prevSearchTerm.current || searchField !== prevSearchField.current;
      
      prevSearchTerm.current = searchTerm;
      prevSearchField.current = searchField;

      const params = {
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchImparticionesData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchImparticionesData(params);
      }

      return () => {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      };
  }, [
      currentPage,
      itemsPerPage,
      searchTerm,
      searchField,
      selectedCentro,
      sortColumn,
      sortDirection,
      fetchImparticionesData
  ]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const handleSort = useCallback((columnKey) => {
      if (sortColumn === columnKey) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(columnKey);
          setSortDirection('asc');
      }
  }, [sortColumn]);

  const handleOpenModal = useCallback((imparticion = null) => {
    if (imparticion) {
      setCurrentImparticion(imparticion);
      
      const getId = (obj) => {
          if (!obj) return '';
          if (typeof obj === 'object') {
              return String(obj.id || (obj['@id'] ? obj['@id'].split('/').pop() : ''));
          }
          if (typeof obj === 'string') {
              return String(obj.split('/').pop());
          }
          return String(obj);
      };

      setFormData({
        profesor: getId(imparticion.profesor),
        modulo: getId(imparticion.modulo),
        grupo: getId(imparticion.grupo)
      });
    } else {
      setCurrentImparticion(null);
      setFormData({
        profesor: '',
        modulo: '',
        grupo: ''
      });
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentImparticion(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        if (name === 'grupo') {
            newData.modulo = ''; 
        }

        return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const id = currentImparticion ? getImparticionId(currentImparticion) : null;
      const url = currentImparticion 
        ? getApiUrl(`/api/imparticions/${id}`)
        : getApiUrl('/api/imparticions');
      
      const method = currentImparticion ? 'PUT' : 'POST';

      const profesorValue = String(formData.profesor);
      const moduloValue = String(formData.modulo);
      const grupoValue = String(formData.grupo);

      const payload = {
        profesor: profesorValue.includes('/api/') ? profesorValue : `/api/users/${profesorValue}`,
        modulo: moduloValue.includes('/api/') ? moduloValue : `/api/modulos/${moduloValue}`,
        grupo: grupoValue.includes('/api/') ? grupoValue : `/api/grupos/${grupoValue}`
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/ld+json',
          'Accept': 'application/ld+json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || t('common.errorSaving', { message: 'Error desconocido' });
        throw new Error(errorMessage);
      }

      // Recargar datos
      fetchImparticionesData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });
      handleCloseModal();

    } catch (err) {
      console.error("Error saving imparticion:", err);
      alert(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (imparticion) => {
    if (!window.confirm(t('teaching.confirmDelete'))) {
      return;
    }

    const id = getImparticionId(imparticion);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/imparticions/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('teaching.errorDelete'));
      }

      fetchImparticionesData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });

    } catch (err) {
      console.error("Error deleting imparticion:", err);
      alert(t('common.errorDeletingMsg', { message: err.message }));
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, fetchImparticionesData]);

  const columns = useMemo(() => [
    { 
        header: t('teaching.teacher'), 
        accessor: (row) => row.profesor ? `${row.profesor.nombre} ${row.profesor.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'profesor.nombre' 
    },
    { 
        header: t('teaching.module'), 
        accessor: (row) => row.modulo ? row.modulo.nombre : '-', 
        sortable: true, 
        sortKey: 'modulo.nombre' 
    },
    { 
        header: t('teaching.group'), 
        accessor: (row) => row.grupo ? (row.grupo.abreviatura || row.grupo.nombre) : '-', 
        sortable: true, 
        sortKey: 'grupo.nombre' 
    },
    { 
        header: t('common.actions'), 
        accessor: (row) => (
            <div className={styles.actions}>
                <button 
                    className={styles.iconButton} 
                    onClick={() => handleOpenModal(row)}
                    title={t('common.edit')}
                >
                    <Edit2 size={18} />
                </button>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(row)}
                    title={t('common.delete')}
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ),
        sortable: false
    }
  ], [handleOpenModal, handleDelete]);

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title={t('teaching.title')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
            {isSuperAdmin && (
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
            )}
            
            <SearchBar 
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder={t('common.search')}
                fields={searchFields}
                selectedField={searchField}
                onFieldChange={setSearchField}
            />
            
            <Button onClick={() => handleOpenModal()}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                {t('common.new')}
            </Button>
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchImparticionesData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={imparticiones}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            mobileBreakpoint={'600px'}
        />

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentImparticion ? t('teaching.editTitle') : t('teaching.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.teacherCount', { count: profesores.length })}</label>
                <select
                    name="profesor"
                    value={formData.profesor}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                >
                    <option value="">{t('common.selectTeacher')}</option>
                    {profesores.map(p => (
                        <option key={p.id || p['@id']} value={String(p.id || p['@id'].split('/').pop())}>
                            {p.nombre} {p.apellidos}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.groupCount', { count: allGrupos.length })}</label>
                <select
                    name="grupo"
                    value={formData.grupo}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                >
                    <option value="">{t('common.selectGroup')}</option>
                    {allGrupos.map(g => (
                        <option key={g.id || g['@id']} value={String(g.id || g['@id'].split('/').pop())}>
                            {g.abreviatura || g.nombre}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.moduleCount', { count: filteredModulos.length })}</label>
                <select
                    name="modulo"
                    value={formData.modulo}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                    disabled={!formData.grupo} // Deshabilitar si no hay grupo
                >
                    <option value="">
                        {formData.grupo ? t('common.selectModule') : t('teaching.selectGroupFirst')}
                    </option>
                    {filteredModulos.map(m => (
                        <option key={m.id || m['@id']} value={String(m.id || m['@id'].split('/').pop())}>
                            {m.nombre} ({m.codigoOficial}) - {m.curso}º
                        </option>
                    ))}
                </select>
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Imparticiones;
