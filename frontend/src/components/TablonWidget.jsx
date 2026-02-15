import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import styles from './TablonWidget.module.css';
import { Megaphone, Globe, Building2, Trash2, Edit, Plus } from 'lucide-react';
import Button from './Button';
import ModalView from './ModalView';

const TablonWidget = ({ hideHeader = false }) => {
    const { user } = useAuth();
    const [comunicados, setComunicados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingComunicado, setEditingComunicado] = useState(null);
    const [formData, setFormData] = useState({
        titulo: '',
        contenido: '',
        global: false
    });

    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN');

    const fetchComunicados = async () => {
        setLoading(true);
        try {
            let url = getApiUrl('/api/comunicados?order[createdAt]=desc');
            
            const response = await fetch(url, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('Error al cargar comunicados');
            
            const data = await response.json();
            // API Platform 4 puede devolver 'member' en lugar de 'hydra:member' según configuración
            const items = data['hydra:member'] || data['member'] || [];
            setComunicados(items);
        } catch (err) {
            console.error(err);
            setError('No se pudieron cargar los comunicados.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchComunicados();
    }, [user]);

    const handleSave = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            const method = editingComunicado ? 'PUT' : 'POST';
            const url = editingComunicado 
                ? getApiUrl(`/api/comunicados/${editingComunicado.id}`)
                : getApiUrl('/api/comunicados');

            const payload = {
                titulo: formData.titulo,
                contenido: formData.contenido,
                global: formData.global
            };
            
            if (isSuperAdmin) {
                payload.centro = formData.global ? null : (user.centro ? `/api/centros/${user.centro.id}` : null);
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/ld+json',
                    'Accept': 'application/ld+json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData['hydra:description'] || errorData.detail || 'Error al guardar');
            }

            setShowModal(false);
            setEditingComunicado(null);
            setFormData({ titulo: '', contenido: '', global: false });
            fetchComunicados();
        } catch (err) {
            if (err.message !== 'Failed to fetch') {
                alert("Error al guardar: " + err.message);
            }
            throw err;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que quieres borrar este comunicado?')) return;
        try {
            const response = await fetch(getApiUrl(`/api/comunicados/${id}`), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al borrar');
            fetchComunicados();
        } catch (err) {
            alert(err.message);
        }
    };

    const openModal = (comunicado = null) => {
        if (comunicado) {
            setEditingComunicado(comunicado);
            setFormData({
                titulo: comunicado.titulo,
                contenido: comunicado.contenido,
                global: comunicado.global
            });
        } else {
            setEditingComunicado(null);
            setFormData({ titulo: '', contenido: '', global: false });
        }
        setShowModal(true);
    };

    const canEdit = (comunicado) => {
        if (isSuperAdmin) return true;
        if (isAdmin && !comunicado.global && comunicado.centro?.id === user.centro?.id) return true;
        return false;
    };

    if (loading) return <div className={styles.loading}>Cargando tablón...</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    return (
        <div className={styles.widget}>
            {!hideHeader && (
                <div className={styles.header}>
                    <h3><Megaphone size={20} /> Tablón de Anuncios</h3>
                    {(isAdmin || isSuperAdmin) && (
                        <Button size="small" onClick={() => openModal()}>
                            <Plus size={16} /> Nuevo
                        </Button>
                    )}
                </div>
            )}
            
            {hideHeader && (isAdmin || isSuperAdmin) && (
                 <div className={styles.floatingAction}>
                    <Button size="small" variant="secondary" onClick={() => openModal()}>
                        <Plus size={16} /> Publicar Anuncio
                    </Button>
                 </div>
            )}

            <div className={styles.list}>
                {comunicados.length === 0 ? (
                    <p className={styles.empty}>No hay comunicados recientes.</p>
                ) : (
                    comunicados.map(comunicado => (
                        <div key={comunicado.id} className={`${styles.card} ${comunicado.global ? styles.global : ''}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardTitle}>{comunicado.titulo}</span>
                                <div className={styles.badges}>
                                    {comunicado.global ? (
                                        <span className={styles.badgeGlobal} title="Comunicado Global"><Globe size={14} /> Global</span>
                                    ) : (
                                        <span className={styles.badgeCentro} title="Comunicado de Centro"><Building2 size={14} /> Centro</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                {comunicado.contenido}
                            </div>
                            <div className={styles.cardFooter}>
                                <span className={styles.author}>
                                    Por: {comunicado.autor?.nombre} {comunicado.autor?.apellidos} 
                                    <span className={styles.date}> • {new Date(comunicado.createdAt).toLocaleDateString()}</span>
                                </span>
                                {canEdit(comunicado) && (
                                    <div className={styles.actions}>
                                        <button onClick={() => openModal(comunicado)} className={styles.actionBtn}><Edit size={16}/></button>
                                        <button onClick={() => handleDelete(comunicado.id)} className={styles.actionBtn}><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <ModalView 
                    isOpen={showModal} 
                    onClose={() => setShowModal(false)} 
                    title={editingComunicado ? "Editar Comunicado" : "Nuevo Comunicado"}
                    onSubmit={handleSave}
                    submitText="Guardar"
                    cancelText="Cancelar"
                >
                    <div className={styles.formGroup}>
                        <label>Título</label>
                        <input 
                            type="text" 
                            value={formData.titulo} 
                            onChange={e => setFormData({...formData, titulo: e.target.value})} 
                            required 
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Contenido</label>
                        <textarea 
                            value={formData.contenido} 
                            onChange={e => setFormData({...formData, contenido: e.target.value})} 
                            required 
                            rows={5}
                        />
                    </div>
                    {isSuperAdmin && (
                        <div className={styles.formGroupCheckbox}>
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={formData.global} 
                                    onChange={e => setFormData({...formData, global: e.target.checked})} 
                                />
                                Es un comunicado global (para todos los centros)
                            </label>
                        </div>
                    )}
                </ModalView>
            )}
        </div>
    );
};

export default TablonWidget;
