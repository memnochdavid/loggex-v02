import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Usuarios.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';

const Usuarios = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const avatarInputRef = useRef(null);

  const [usuarios, setUsuarios] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = usePagination('usuarios'); 
  
  // Búsqueda y Ordenación
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Control de debounce y estado previo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  const searchFields = [
      { value: 'nombre', label: 'Nombre' },
      { value: 'apellidos', label: 'Apellidos' },
      { value: 'email', label: 'Email' },
      { value: 'telefono', label: 'Teléfono' },
      { value: 'nif', label: 'NIF' }
  ];

  // Estado Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    nif: '',
    password: '',
    roles: ['ROLE_ALUMNO'],
    centro: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Cargar centros (solo SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
        fetch(getApiUrl('/api/centros?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' },
            credentials: 'include'
        })
        .then(res => res.ok ? res.json() : Promise.reject("Error cargando centros"))
        .then(data => {
            const items = data['hydra:member'] || data.member || [];
            setCentros(items);
        })
        .catch(err => console.error(err));
    }
  }, [isSuperAdmin]);

  // Función de carga de datos
  const fetchUsuariosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/users?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
      }
      
      if (params.isSuperAdmin && params.selectedCentro) {
          url += `&centro=${params.selectedCentro}`;
      }
      
      if (params.sortColumn) {
          url += `&order[${params.sortColumn}]=${params.sortDirection}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
        signal: abortController.current.signal
      });

      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setUsuarios(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') {
          return;
      }
      console.error("Error fetching usuarios:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Efecto ÚNICO
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
          sortDirection,
          isSuperAdmin
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchUsuariosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchUsuariosData(params);
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
      isSuperAdmin,
      fetchUsuariosData
  ]);

  // Manejadores
  const handleSearchChange = (val) => {
      setSearchTerm(val);
      setCurrentPage(1); 
  };

  const handleCentroChange = (val) => {
      setSelectedCentro(val);
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

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getUserId = (u) => {
    if (u.id) return u.id;
    if (u['@id']) return u['@id'].split('/').pop();
    return null;
  };

  const getAvatarUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return getAssetUrl(path);
  }, []);

  const handleOpenModal = useCallback((usuario = null) => {
    setAvatarFile(null);
    if (usuario) {
      setCurrentUser(usuario);
      setFormData({
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        email: usuario.email,
        telefono: usuario.telefono || '',
        nif: usuario.nif || '',
        password: '',
        roles: usuario.roles || ['ROLE_ALUMNO'],
        centro: usuario.centro ? (usuario.centro.id || usuario.centro.split('/').pop()) : ''
      });
      setAvatarPreview(usuario.foto ? getAvatarUrl(usuario.foto) : null);
    } else {
      setCurrentUser(null);
      setFormData({
        nombre: '',
        apellidos: '',
        email: '',
        telefono: '',
        nif: '',
        password: '',
        roles: ['ROLE_ALUMNO'],
        centro: isSuperAdmin ? '' : (user.centro ? user.centro.id : '')
      });
      setAvatarPreview(null);
    }
    setIsModalOpen(true);
  }, [isSuperAdmin, user.centro, getAvatarUrl]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (role) => {
      setFormData(prev => {
          let newRoles = [...prev.roles];
          if (role === 'ROLE_ALUMNO') {
              return { ...prev, roles: ['ROLE_ALUMNO'] };
          } else {
              newRoles = newRoles.filter(r => r !== 'ROLE_ALUMNO');
              if (newRoles.includes(role)) {
                  newRoles = newRoles.filter(r => r !== role);
              } else {
                  newRoles.push(role);
              }
              if (newRoles.length === 0) newRoles = ['ROLE_ALUMNO'];
              return { ...prev, roles: newRoles };
          }
      });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = currentUser ? getUserId(currentUser) : null;
      const url = currentUser 
        ? getApiUrl(`/api/admin/user/${id}/update`)
        : getApiUrl('/api/admin/user/create');
      
      const data = new FormData();
      data.append('nombre', formData.nombre);
      data.append('apellidos', formData.apellidos);
      data.append('email', formData.email);
      data.append('telefono', formData.telefono);
      data.append('nif', formData.nif);
      data.append('roles', JSON.stringify(formData.roles));
      if (formData.centro) data.append('centro', formData.centro);
      if (formData.password) data.append('password', formData.password);
      if (avatarFile) data.append('avatar', avatarFile);

      const response = await fetch(url, {
        method: 'POST',
        body: data,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.detail || 'Error al guardar');
      }

      // Recargar datos actuales
      fetchUsuariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      handleCloseModal();
    } catch (err) {
      console.error("Error saving usuario:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (usuario) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;
    const id = getUserId(usuario);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('No se pudo eliminar el usuario');
      // Recargar datos actuales
      fetchUsuariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
    } catch (err) {
      console.error("Error deleting usuario:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchUsuariosData]);

  const columns = useMemo(() => [
    {
        header: 'Avatar',
        accessor: (row) => (
            <div className={styles.userAvatarCell} style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', backgroundColor: '#f3f4f6' }}>
                {row.foto ? (
                    <img src={getAvatarUrl(row.foto)} alt={row.nombre} className={styles.userAvatarImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div className={styles.userAvatarPlaceholder} style={{ display: row.foto ? 'none' : 'flex', fontWeight: 'bold', color: '#6b7280' }}>
                    {row.nombre.charAt(0)}
                </div>
            </div>
        ),
        className: styles.userColAvatar,
        sortable: false
    },
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Apellidos', accessor: 'apellidos', sortable: true, sortKey: 'apellidos' },
    { header: 'Email', accessor: 'email', sortable: true, sortKey: 'email' },
    { header: 'Teléfono', accessor: 'telefono', sortable: true, sortKey: 'telefono' },
    { header: 'NIF', accessor: 'nif', sortable: true, sortKey: 'nif' },
    { header: 'Roles', accessor: (row) => row.roles.map(r => r.replace('ROLE_', '')).join(', '), sortable: false },
    { 
        header: 'Acciones',
        accessor: (row) => (
            <div className={styles.actions}>
                <button className={styles.iconButton} onClick={() => handleOpenModal(row)} title="Editar"><Edit2 size={18} /></button>
                <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(row)} title="Eliminar"><Trash2 size={18} /></button>
            </div>
        ),
        sortable: false
    }
  ], [getAvatarUrl, handleOpenModal, handleDelete]);

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title="Gestión de Usuarios">
            {isSuperAdmin && (
                <select className={styles.select} value={selectedCentro} onChange={(e) => handleCentroChange(e.target.value)} style={{ width: '200px' }}>
                    <option value="">Todos los centros</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
            )}
            <SearchBar 
                value={searchTerm} 
                onChange={handleSearchChange} 
                placeholder="Buscar..." 
                fields={searchFields}
                selectedField={searchField}
                onFieldChange={setSearchField}
            />
            <Button onClick={() => handleOpenModal()}><Plus size={18} style={{ marginRight: '8px' }} /> Nuevo</Button>
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchUsuariosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={usuarios}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            mobileBreakpoint={'980px'}
            mobileHeaderColumns={3}
        />

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            {/* ... Contenido del modal ... */}
            <div className={styles.formGroup}>
                <label className={styles.label}>Avatar</label>
                <div className={styles.avatarPreviewContainer}>
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Previsualización" className={styles.avatarPreview} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div className={styles.avatarPreview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f3f4f6' }}>
                            <ImageIcon size={24} color="#cbd5e1" />
                        </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleFileChange} ref={avatarInputRef} className={styles.fileInput} style={{ display: 'none' }} />
                    <Button type="button" variant="secondary" onClick={() => avatarInputRef.current.click()} style={{ marginLeft: '1rem' }}><Upload size={16} style={{ marginRight: '8px' }} /> Cambiar</Button>
                </div>
            </div>
            <div className={styles.formGroup}><label className={styles.label}>Nombre</label><input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} className={styles.input} required /></div>
            <div className={styles.formGroup}><label className={styles.label}>Apellidos</label><input type="text" name="apellidos" value={formData.apellidos} onChange={handleInputChange} className={styles.input} required /></div>
            <div className={styles.formGroup}><label className={styles.label}>Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={styles.input} required /></div>
            <div className={styles.formGroup}><label className={styles.label}>Teléfono</label><input type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.label}>NIF</label><input type="text" name="nif" value={formData.nif} onChange={handleInputChange} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.label}>Contraseña {currentUser && '(Dejar en blanco para no cambiar)'}</label><input type="password" name="password" value={formData.password} onChange={handleInputChange} className={styles.input} required={!currentUser} /></div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Roles</label>
                <div className={styles.rolesContainer}>
                    <label className={styles.checkboxLabel}><input type="checkbox" checked={formData.roles.includes('ROLE_ALUMNO')} onChange={() => handleRoleChange('ROLE_ALUMNO')} /> Alumno</label>
                    <label className={styles.checkboxLabel}><input type="checkbox" checked={formData.roles.includes('ROLE_PROFESOR')} onChange={() => handleRoleChange('ROLE_PROFESOR')} /> Profesor</label>
                    <label className={styles.checkboxLabel}><input type="checkbox" checked={formData.roles.includes('ROLE_ADMIN')} onChange={() => handleRoleChange('ROLE_ADMIN')} /> Administrador</label>
                    {isSuperAdmin && <label className={styles.checkboxLabel}><input type="checkbox" checked={formData.roles.includes('ROLE_SUPERADMIN')} onChange={() => handleRoleChange('ROLE_SUPERADMIN')} /> SuperAdmin</label>}
                </div>
            </div>
            {isSuperAdmin && (
                <div className={styles.formGroup}>
                    <label className={styles.label}>Centro</label>
                    <select name="centro" value={formData.centro} onChange={handleInputChange} className={styles.select} required={!formData.roles.includes('ROLE_SUPERADMIN')}>
                        <option value="">Seleccionar centro...</option>
                        {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>
            )}
        </ModalView>
        </div>
    </Layout>
  );
};

export default Usuarios;
