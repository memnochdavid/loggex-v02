import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import styles from './TablonWidget.module.css';
import crudStyles from '../pages/Crud.module.css';
import { Megaphone, Globe, Building2, Trash2, Edit2, Plus } from 'lucide-react';
import Button from './Button';
import ModalView from './ModalView';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import useConfirm from '../hooks/useConfirm';

const TablonWidget = forwardRef(({ hideHeader = false }, ref) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { toast } = useToast();
    const { isOpen: confirmOpen, message: confirmMessage, confirm, handleConfirm, handleCancel } = useConfirm();
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

    const listRef = useRef(null);

    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Exponer la función openModal al componente padre (Home.jsx)
    useImperativeHandle(ref, () => ({
        openModal: () => openModal()
    }));

    const fetchComunicados = async () => {
        setLoading(true);
        try {
            let url = getApiUrl('/api/comunicados?order[createdAt]=desc');
            const response = await fetch(url, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            if (!response.ok) throw new Error(t('bulletin.errorLoading'));
            const data = await response.json();
            let items = data['hydra:member'] || data['member'] || [];
            
            // Asegurar orden descendente (más nuevo primero) en el frontend
            items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setComunicados(items);
        } catch (err) {
            console.error(err);
            setError(t('bulletin.errorLoading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchComunicados();
    }, [user]);

    // Efecto para hacer scroll al inicio cuando cambian los comunicados
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [comunicados]);

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
                throw new Error(errorData['hydra:description'] || errorData.detail || t('bulletin.errorSave'));
            }

            setShowModal(false);
            setEditingComunicado(null);
            setFormData({ titulo: '', contenido: '', global: false });
            fetchComunicados();
        } catch (err) {
            if (err.message !== 'Failed to fetch') {
                toast.error(t('bulletin.errorSave') + err.message);
            }
            throw err;
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirm(t('bulletin.confirmDelete')))) return;
        try {
            const response = await fetch(getApiUrl(`/api/comunicados/${id}`), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error(t('bulletin.errorDelete'));
            fetchComunicados();
        } catch (err) {
            toast.error(err.message);
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

    if (loading) return <div className={styles.loading}>{t('bulletin.loading')}</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    return (
        <div className={styles.widget}>
            {!hideHeader && (
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <Megaphone size={20} />
                        <h3>{t('bulletin.title')}</h3>
                    </div>
                    {(isAdmin || isSuperAdmin) && (
                        <Button size="small" onClick={() => openModal()}>
                            <Plus size={18} style={{ marginRight: '4px' }} /> {t('bulletin.publish')}
                        </Button>
                    )}
                </div>
            )}

            <div className={styles.list} ref={listRef}>
                {comunicados.length === 0 ? (
                    <p className={styles.empty}>{t('bulletin.empty')}</p>
                ) : (
                    comunicados.map(comunicado => (
                        <div key={comunicado.id} className={`${styles.card} ${comunicado.global ? styles.global : ''}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardTitle}>{comunicado.titulo}</span>
                                <div className={styles.badges}>
                                    {comunicado.global ? (
                                        <span className={styles.badgeGlobal} title={t('bulletin.global')}><Globe size={14} /> {t('bulletin.global')}</span>
                                    ) : (
                                        <span className={styles.badgeCentro} title={comunicado.centro?.nombre || t('bulletin.defaultCenter')}>
                                            <Building2 size={14} /> {comunicado.centro?.nombre || t('bulletin.defaultCenter')}
                                        </span>
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
                                    <div className={crudStyles.actions}>
                                        <button className={crudStyles.iconButton} onClick={() => openModal(comunicado)} title={t('common.edit')}><Edit2 size={18} /></button>
                                        <button className={`${crudStyles.iconButton} ${crudStyles.danger}`} onClick={() => handleDelete(comunicado.id)} title={t('common.delete')}><Trash2 size={18} /></button>
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
                    title={editingComunicado ? t('bulletin.editTitle') : t('bulletin.newTitle')}
                    onSubmit={handleSave}
                    submitText={t('common.save')}
                    cancelText={t('common.cancel')}
                >
                    <div className={crudStyles.formGroup}>
                        <label className={crudStyles.label}>{t('bulletin.titleLabel')}</label>
                        <input 
                            type="text" 
                            value={formData.titulo} 
                            onChange={e => setFormData({...formData, titulo: e.target.value})} 
                            className={crudStyles.input}
                            required 
                        />
                    </div>
                    <div className={crudStyles.formGroup}>
                        <label className={crudStyles.label}>{t('bulletin.contentLabel')}</label>
                        <textarea 
                            value={formData.contenido} 
                            onChange={e => setFormData({...formData, contenido: e.target.value})} 
                            className={crudStyles.input}
                            required 
                            rows={5}
                        />
                    </div>
                    {isSuperAdmin && (
                        <div className={crudStyles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="checkbox" 
                                id="global-check"
                                checked={formData.global} 
                                onChange={e => setFormData({...formData, global: e.target.checked})} 
                            />
                            <label htmlFor="global-check" className={crudStyles.label} style={{ marginBottom: 0 }}>
                                {t('bulletin.globalCheckbox')}
                            </label>
                        </div>
                    )}
                </ModalView>
            )}

            <ConfirmDialog
                isOpen={confirmOpen}
                message={confirmMessage}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
});

export default TablonWidget;
