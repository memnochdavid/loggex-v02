import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import styles from './Perfil.module.css';
import { User, Mail, Phone, Lock, Image as ImageIcon, GraduationCap, Building, Camera, BookOpen, PenLine, Trash2 } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import ModalView from '../components/ModalView';
import LiquidSignaturePad from '../components/LiquidSignaturePad';
import Button from '../components/Button';
import ModuloLabel from '../components/ModuloLabel';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const Perfil = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const { user, checkAuth } = useAuth();
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [isSignModalOpen, setIsSignModalOpen] = useState(false);
    const [draftSvg, setDraftSvg] = useState(null);
    const [savingFirma, setSavingFirma] = useState(false);
    
    // Estados para información académica
    const [matriculas, setMatriculas] = useState([]);
    const [imparticiones, setImparticiones] = useState([]);

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path;
        return getAssetUrl(path);
    };

    useEffect(() => {
        if (user) {
            setAvatarPreview(user.foto ? getImageUrl(user.foto) : null);

            // Cargar datos académicos según el rol
            if (user.roles?.includes('ROLE_ALUMNO')) {
                fetchMatriculas();
            }
            if (user.roles?.includes('ROLE_PROFESOR')) {
                fetchImparticiones();
            }
        }
    }, [user]);

    const fetchMatriculas = async () => {
        try {
            const response = await fetch(getApiUrl('/api/v1/alumno/matriculas'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setMatriculas(data);
            }
        } catch (error) {
            console.error("Error cargando matrículas:", error);
        }
    };

    const fetchImparticiones = async () => {
        try {
            const response = await fetch(getApiUrl('/api/v1/profesor/imparticiones'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setImparticiones(data);
            }
        } catch (error) {
            console.error("Error cargando imparticiones:", error);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview inmediato
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);

        // Subida
        setUploading(true);
        try {
            const data = new FormData();
            data.append('nombre', user.nombre); 
            data.append('avatar', file);

            const response = await fetch(getApiUrl('/api/user/update'), {
                method: 'POST',
                body: data,
                credentials: 'include'
            });

            if (response.ok) {
                await checkAuth(); // Recargar usuario
                toast.success(t('profile.avatarUpdated', { defaultValue: 'Avatar actualizado' }));
            } else {
                const message = await parseErrorResponse(response, t('profile.avatarErrorCtx', { defaultValue: 'No se ha podido actualizar el avatar' }));
                toast.error(message, {
                    description: t('profile.avatarErrorCtx', { defaultValue: 'No se ha podido actualizar el avatar' })
                });
            }
        } catch (error) {
            console.error(error);
            toast.error(t('common.connectionError', { defaultValue: 'Error de conexión' }));
        } finally {
            setUploading(false);
        }
    };

    const handleSaveFirma = async () => {
        if (!draftSvg || !draftSvg.png) {
            toast.warning(t('profile.signatureDrawFirst', { defaultValue: 'Dibuja la firma primero' }));
            return;
        }
        setSavingFirma(true);
        try {
            const res = await fetch(getApiUrl('/api/user/firma'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ png: draftSvg.png, svg: draftSvg.svg }),
                credentials: 'include',
            });
            if (!res.ok) {
                const message = await parseErrorResponse(res, t('profile.signatureSaveError', { defaultValue: 'Error al guardar la firma' }));
                throw new Error(message);
            }
            await checkAuth();
            setIsSignModalOpen(false);
            setDraftSvg(null);
            toast.success(t('profile.signatureSaved', { defaultValue: 'Firma guardada' }));
        } catch (err) {
            toast.error(err.message, {
                description: t('profile.signatureSaveErrorCtx', { defaultValue: 'No se ha podido guardar la firma' })
            });
        } finally {
            setSavingFirma(false);
        }
    };

    const handleDeleteFirma = async () => {
        if (!(await confirm({ body: '¿Eliminar tu firma registrada?' }))) return;
        try {
            const res = await fetch(getApiUrl('/api/user/firma'), { method: 'DELETE', credentials: 'include' });
            if (!res.ok) {
                const message = await parseErrorResponse(res, t('profile.signatureDeleteError', { defaultValue: 'Error al eliminar la firma' }));
                throw new Error(message);
            }
            await checkAuth();
            toast.success(t('profile.signatureDeleted', { defaultValue: 'Firma eliminada' }));
        } catch (err) {
            toast.error(err.message, {
                description: t('profile.signatureDeleteErrorCtx', { defaultValue: 'No se ha podido eliminar la firma' })
            });
        }
    };

    if (!user) return null;

    const isAdminLike = user.roles?.includes('ROLE_ADMIN') || user.roles?.includes('ROLE_SUPERADMIN');
    const firmaUrl = user.firma && user.id ? getAssetUrl(`/uploads/firmas/${user.id}/${user.firma}`) : null;

    const fullName = `${user.nombre} ${user.apellidos || ''}`.trim();
    const roles = user.roles 
        ? user.roles.filter(r => r !== 'ROLE_USER').map(r => r.replace('ROLE_', '')).join(', ') 
        : 'Usuario';

    const isAlumnoOnly = user.roles.includes('ROLE_ALUMNO') && !user.roles.includes('ROLE_PROFESOR') && !user.roles.includes('ROLE_ADMIN') && !user.roles.includes('ROLE_SUPERADMIN');
    const canEditAvatar = !isAlumnoOnly;

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.header}>
                        <div className={styles.avatarContainer}>
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className={styles.avatar} />
                            ) : (
                                <div className={`${styles.avatar} ${styles.placeholderAvatar}`}>
                                    <User size={64} color="#cbd5e1" />
                                </div>
                            )}
                            
                            {canEditAvatar && (
                                <label className={styles.avatarUpload} title={t('profile.changePhoto')}>
                                    <Camera size={16} />
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className={styles.hiddenInput}
                                        onChange={handleAvatarChange}
                                        disabled={uploading}
                                    />
                                </label>
                            )}
                        </div>
                        <div className={styles.headerInfo}>
                            <h1 className={styles.name}>{fullName}</h1>
                            <span className={styles.roleBadge}>{roles}</span>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <User size={20} /> {t('profile.personalInfo')}
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.firstName')}</span>
                                    <span className={styles.value}>{user.nombre}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.lastName')}</span>
                                    <span className={styles.value}>{user.apellidos || <span className={styles.emptyValue}>{t('common.notDefined')}</span>}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.nif')}</span>
                                    <span className={styles.value}>{user.nif || <span className={styles.emptyValue}>{t('common.notDefined')}</span>}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Mail size={20} /> {t('profile.contact')}
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.email')}</span>
                                    <span className={styles.value}>{user.email}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.phone')}</span>
                                    <span className={styles.value}>{user.telefono || <span className={styles.emptyValue}>{t('common.notDefined')}</span>}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Building size={20} /> {t('profile.academicInfo')}
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.center')}</span>
                                    <span className={styles.value}>{user.centro ? user.centro.nombre : <span className={styles.emptyValue}>{t('common.noCenter')}</span>}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>{t('profile.appRole')}</span>
                                    <span className={styles.value}>{user.rol_app || roles}</span>
                                </div>
                            </div>

                            {/* Matrículas para Alumnos */}
                            {matriculas.length > 0 && (
                                <div className={styles.section} style={{ marginTop: '2rem' }}>
                                    <h3 className={styles.sectionTitle}>
                                        <GraduationCap size={20} /> {t('profile.activeEnrollments')}
                                    </h3>
                                    {matriculas.map(matricula => (
                                        <div key={matricula.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.cycle')}</span>
                                                <span className={styles.value}>{matricula.grupo?.itinerario?.nombre || t('profile.unknownCycle')}</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.course')}</span>
                                                <span className={styles.value}>{matricula.grupo?.curso}º</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.schoolYear')}</span>
                                                <span className={styles.value}>{matricula.grupo?.anioEscolar}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Imparticiones para Profesores */}
                            {imparticiones.length > 0 && (
                                <div className={styles.section} style={{ marginTop: '2rem' }}>
                                    <h3 className={styles.sectionTitle}>
                                        <BookOpen size={20} /> {t('profile.taughtSubjects')}
                                    </h3>
                                    {imparticiones.map(imp => (
                                        <div key={imp.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.module')}</span>
                                                <span className={styles.value}>
                                                    {(imp.materia ?? imp.modulo)
                                                        ? <ModuloLabel modulo={(imp.materia ?? imp.modulo)} />
                                                        : t('profile.unknownModule')}
                                                </span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.group')}</span>
                                                <span className={styles.value}>{imp.grupo?.abreviatura || imp.grupo?.nombre}</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>{t('profile.course')}</span>
                                                <span className={styles.value}>{imp.grupo?.curso}º</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isAdminLike && (
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>
                                    <PenLine size={20} /> Firma para boletines
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
                                    {firmaUrl ? (
                                        <img
                                            src={firmaUrl}
                                            alt="Tu firma"
                                            style={{ maxHeight: '80px', maxWidth: '260px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: '#fff' }}
                                        />
                                    ) : (
                                        <span className={styles.emptyValue}>Aún no tienes firma registrada.</span>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button onClick={() => { setDraftSvg(null); setIsSignModalOpen(true); }}>
                                            <PenLine size={16} style={{ marginRight: '6px' }} />
                                            {firmaUrl ? 'Reemplazar firma' : 'Registrar firma'}
                                        </Button>
                                        {firmaUrl && (
                                            <Button variant="danger" onClick={handleDeleteFirma}>
                                                <Trash2 size={16} style={{ marginRight: '6px' }} />
                                                Eliminar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ModalView
                isOpen={isSignModalOpen}
                onClose={() => { setIsSignModalOpen(false); setDraftSvg(null); }}
                title="Dibuja tu firma"
                onSubmit={(e) => { e.preventDefault(); handleSaveFirma(); }}
                isSubmitting={savingFirma}
                submitText="Guardar firma"
            >
                <p style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
                    Dibuja dentro del recuadro con el ratón, dedo o stylus. Se guardará como SVG y aparecerá en los boletines que emitas.
                </p>
                <LiquidSignaturePad onChange={setDraftSvg} />
            </ModalView>
        </Layout>
    );
};

export default Perfil;
