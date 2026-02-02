import React, { useEffect, useState, useMemo } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import {usePagination} from "../hooks/usePagination.js";

const Imparticiones = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [imparticiones, setImparticiones] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [allModulos, setAllModulos] = useState([]); // Todos los módulos cargados
  const [allGrupos, setAllGrupos] = useState([]);   // Todos los grupos cargados
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  // const [itemsPerPage, setItemsPerPage] = useState(20);
const [itemsPerPage, setItemsPerPage] = usePagination('imparticiones');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('profesor.nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'profesor.nombre', label: 'Profesor' },
      { value: 'modulo.nombre', label: 'Módulo' },
      { value: 'grupo.nombre', label: 'Grupo' }
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
      if (!formData.grupo) return []; // Si no hay grupo, no mostrar módulos (forzar orden)
      
      const selectedGrupo = allGrupos.find(g => String(g.id || g['@id'].split('/').pop()) === String(formData.grupo));
      if (!selectedGrupo) return [];

      // Filtrar módulos que coincidan en Ciclo y Curso con el grupo seleccionado
      return allModulos.filter(m => {
          // Comparar curso
          if (m.curso !== selectedGrupo.curso) return false;
          
          // Comparar ciclo (puede venir como objeto o IRI)
          const modCicloId = typeof m.ciclo === 'object' ? (m.ciclo.id || m.ciclo['@id']) : m.ciclo;
          const grupCicloId = typeof selectedGrupo.ciclo === 'object' ? (selectedGrupo.ciclo.id || selectedGrupo.ciclo['@id']) : selectedGrupo.ciclo;
          
          // Normalizar IDs para comparar
          const modCicloIdStr = String(modCicloId).split('/').pop();
          const grupCicloIdStr = String(grupCicloId).split('/').pop();

          return modCicloIdStr === grupCicloIdStr;
      });
  }, [allModulos, allGrupos, formData.grupo]);

  // Cargar centros (solo SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
        fetch('https://localhost:9443/api/centros?pagination=false', {
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
    let urlProfesores = 'https://localhost:9443/api/users?itemsPerPage=100&rol_app=profesor';
    let urlModulos = 'https://localhost:9443/api/modulos?itemsPerPage=100';
    let urlGrupos = 'https://localhost:9443/api/grupos?itemsPerPage=100';
    
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

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchImparticiones(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCentro, searchField]);

  // Fetch al cambiar página u orden
  useEffect(() => {
    fetchImparticiones(currentPage);
  }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getImparticionId = (i) => {
    if (i.id) return i.id;
    if (i['@id']) {
        const parts = i['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchImparticiones = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/imparticions?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (sortColumn) {
          url += `&order[${sortColumn}]=${sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include'
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
      console.error("Error fetching imparticiones:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (columnKey) => {
      if (sortColumn === columnKey) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(columnKey);
          setSortDirection('asc');
      }
  };

  const handleOpenModal = (imparticion = null) => {
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
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentImparticion(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        // Si cambiamos grupo, reseteamos módulo porque la lista de módulos disponibles cambiará
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
        ? `https://localhost:9443/api/imparticions/${id}`
        : 'https://localhost:9443/api/imparticions';
      
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
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || 'Error al guardar';
        throw new Error(errorMessage);
      }

      await fetchImparticiones(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving imparticion:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (imparticion) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta asignación?')) {
      return;
    }

    const id = getImparticionId(imparticion);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/imparticions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar la asignación');
      }

      fetchImparticiones(currentPage);

    } catch (err) {
      console.error("Error deleting imparticion:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { 
        header: 'Profesor', 
        accessor: (row) => row.profesor ? `${row.profesor.nombre} ${row.profesor.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'profesor.nombre' 
    },
    { 
        header: 'Módulo', 
        accessor: (row) => row.modulo ? row.modulo.nombre : '-', 
        sortable: true, 
        sortKey: 'modulo.nombre' 
    },
    { 
        header: 'Grupo', 
        accessor: (row) => row.grupo ? (row.grupo.abreviatura || row.grupo.nombre) : '-', 
        sortable: true, 
        sortKey: 'grupo.nombre' 
    },
    { 
        header: 'Acciones',
        accessor: (row) => (
            <div className={styles.actions}>
                <button 
                    className={styles.iconButton} 
                    onClick={() => handleOpenModal(row)}
                    title="Editar"
                >
                    <Edit2 size={18} />
                </button>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(row)}
                    title="Eliminar"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ),
        sortable: false
    }
  ];

  return (
    <Layout>
        <div className={styles.container}>
        <div className={styles.header}>
            <h1 className={styles.pageTitle}>Asignación de Docencia</h1>
            
            <div className={styles.controls}>
                {isSuperAdmin && (
                    <select 
                        className={styles.select} 
                        value={selectedCentro} 
                        onChange={(e) => setSelectedCentro(e.target.value)}
                        style={{ width: '200px' }}
                    >
                        <option value="">Todos los centros</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                )}
                
                <SearchBar 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    placeholder="Buscar..." 
                    fields={searchFields}
                    selectedField={searchField}
                    onFieldChange={setSearchField}
                />
                
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nueva Asignación
                </Button>
            </div>
        </div>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchImparticiones(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
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

        {/* Modal */}
        {isModalOpen && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                    {currentImparticion ? 'Editar Asignación' : 'Nueva Asignación'}
                </h3>
                <button className={styles.closeButton} onClick={handleCloseModal}>
                    <X size={20} />
                </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Profesor ({profesores.length})</label>
                        <select
                            name="profesor"
                            value={formData.profesor}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                        >
                            <option value="">Seleccionar profesor...</option>
                            {profesores.map(p => (
                                <option key={p.id || p['@id']} value={String(p.id || p['@id'].split('/').pop())}>
                                    {p.nombre} {p.apellidos}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Grupo ({allGrupos.length})</label>
                        <select
                            name="grupo"
                            value={formData.grupo}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                        >
                            <option value="">Seleccionar grupo...</option>
                            {allGrupos.map(g => (
                                <option key={g.id || g['@id']} value={String(g.id || g['@id'].split('/').pop())}>
                                    {g.abreviatura || g.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Módulo ({filteredModulos.length})</label>
                        <select
                            name="modulo"
                            value={formData.modulo}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                            disabled={!formData.grupo} // Deshabilitar si no hay grupo
                        >
                            <option value="">
                                {formData.grupo ? "Seleccionar módulo..." : "Selecciona un grupo primero"}
                            </option>
                            {filteredModulos.map(m => (
                                <option key={m.id || m['@id']} value={String(m.id || m['@id'].split('/').pop())}>
                                    {m.nombre} ({m.codigoOficial}) - {m.curso}º
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <Button type="button" variant="secondary" onClick={handleCloseModal}>
                    Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    </Layout>
  );
};

export default Imparticiones;
