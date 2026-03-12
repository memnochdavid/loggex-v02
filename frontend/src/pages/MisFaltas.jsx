import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Clock, XCircle, CheckCircle } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import ShowProgress from '../components/ShowProgress'; // Importar el nuevo componente
import Lottie from 'lottie-react';
import checkAnimation from '../../public/check.json';
import { useTranslation } from 'react-i18next';


const MisFaltas = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [asignaturasConFaltas, setAsignaturasConFaltas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Estados para filtros de SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [grupos, setGrupos] = useState([]);
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [alumnos, setAlumnos] = useState([]); // CAMBIADO: Alumnos en lugar de módulos
    const [selectedAlumno, setSelectedAlumno] = useState(''); // CAMBIADO

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
                setSelectedGrupo('');
                setAlumnos([]);
                setSelectedAlumno('');
            })
            .catch(err => console.error("Error cargando grupos:", err));
        } else {
            setGrupos([]);
            setSelectedGrupo('');
            setAlumnos([]);
            setSelectedAlumno('');
        }
    }, [selectedCentro, isSuperAdmin]);

    // Cargar alumnos cuando cambia el grupo seleccionado (CAMBIADO)
    useEffect(() => {
        if (isSuperAdmin && selectedGrupo) {
            // Obtener matrículas del grupo para sacar los alumnos
            fetch(getApiUrl(`/api/matriculas?grupo=${selectedGrupo}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                const alumnosList = items.map(m => m.alumno).filter(a => a); // Extraer alumnos
                // Ordenar por nombre
                alumnosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
                setAlumnos(alumnosList);
                setSelectedAlumno('');
            })
            .catch(err => console.error("Error cargando alumnos:", err));
        } else {
            setAlumnos([]);
            setSelectedAlumno('');
        }
    }, [selectedGrupo, isSuperAdmin]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, selectedCentro, selectedGrupo, selectedAlumno]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/v1/asistencia/alumno/summary';
            
            if (isSuperAdmin) {
                if (!selectedAlumno) {
                    setAsignaturasConFaltas([]);
                    setLoading(false);
                    return;
                }
                // Usar el parámetro alumnoId para ver las faltas de otro alumno
                url += `?alumnoId=${selectedAlumno}`;
            }

            const response = await fetch(getApiUrl(url), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setAsignaturasConFaltas(data);
            } else {
                console.error("Error fetching summary:", response.status);
                setError(t('myAbsences.errorLoading'));
            }
        } catch (err) {
            console.error("Error de conexión:", err);
            setError(t('myAbsences.errorConnection'));
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (estado) => {
        switch (estado) {
            case 'F': return <XCircle size={18} color="#ef4444" />;
            case 'R': return <Clock size={18} color="#eab308" />;
            case 'J': return <CheckCircle size={18} color="#3b82f6" />;
            default: return <AlertCircle size={18} color="#64748b" />;
        }
    };

    const getStatusLabel = (estado) => {
        switch (estado) {
            case 'F': return t('myAbsences.unjustified');
            case 'R': return t('myAbsences.late');
            case 'J': return t('myAbsences.justified');
            default: return estado;
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        // Si viene como fecha completa ISO
        if (timeStr.includes('T')) {
            return new Date(timeStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        // Si viene como HH:MM:SS
        if (timeStr.includes(':')) {
            return timeStr.substring(0, 5);
        }
        return timeStr;
    };

    const renderHeader = (item, isOpen) => {
        return (
            <div style={{ width: '100%', paddingRight: '1rem' }}>
                <div className={styles.accordionHeaderContentAttendance}>
                    <span style={{ flex: 1 }}>{item.title}</span>
                    {/* Mostrar barra solo si hay porcentaje calculado (Alumno normal y Superadmin ahora) */}
                    {item.porcentajeFaltas !== undefined && (
                        <ShowProgress percentage={item.porcentajeFaltas} height="15px" showLabel={true} />
                    )}
                </div>
            </div>
        );
    };

    const renderDetalles = (item) => {
        if (!item.detalles || item.detalles.length === 0) {
            return <div className={styles.emptyState}>{t('myAbsences.noAbsencesAny')}</div>;
        }

        return (
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>{t('myAbsences.absencesCount')} <b>{item.faltas}</b></span>
                    <span>{t('myAbsences.lateCount')} <b>{item.retrasos}</b></span>
                    <span>{t('myAbsences.justifiedCount')} <b>{item.justificadas}</b></span>
                    {item.totalHoras > 0 && (
                        <span>{t('myAbsences.totalHours')} <b>{item.totalHoras}</b></span>
                    )}
                </div>
                <ul className={styles.list}>
                    {item.detalles.map(detalle => (
                        <li key={detalle.id} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                            <div className={styles.itemInfo}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                                    {getStatusIcon(detalle.estado)}
                                    <span>{getStatusLabel(detalle.estado)}</span>
                                </div>
                                <span className={styles.date}>
                                    {new Date(detalle.fecha).toLocaleDateString()} a las {formatTime(detalle.hora)}
                                </span>
                                {detalle.comentario && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                        "{detalle.comentario}"
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title={t('myAbsences.title')}
                            logo={<Lottie animationData={checkAnimation} loop={true} style={{ width: 60, height: 60 }} />}
                >
                    {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select 
                                className={styles.select}
                                value={selectedCentro}
                                onChange={(e) => setSelectedCentro(e.target.value)}
                                style={{ minWidth: '200px' }}
                            >
                                <option value="">{t('common.allCenters')}</option>
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
                                <option value="">{t('common.allGroups')}</option>
                                {grupos.map(g => (
                                    <option key={g.id} value={g.id}>{g.nombre}</option>
                                ))}
                            </select>

                            <select 
                                className={styles.select}
                                value={selectedAlumno}
                                onChange={(e) => setSelectedAlumno(e.target.value)}
                                disabled={!selectedGrupo}
                                style={{ minWidth: '200px' }}
                            >
                                <option value="">{t('myAbsences.selectStudent')}</option>
                                {alumnos.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </CrudHeader>
                
                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : error ? (
                    <div className={styles.errorContainer}>{error}</div>
                ) : asignaturasConFaltas.length === 0 ? (
                    <div className={styles.emptyState}>
                        {isSuperAdmin && !selectedAlumno 
                            ? t('myAbsences.selectStudentMsg')
                            : t('myAbsences.noAbsences')}
                    </div>
                ) : (
                    <AccordionView 
                        data={asignaturasConFaltas}
                        renderItem={renderDetalles}
                        renderHeader={renderHeader}
                        canAdd={false}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisFaltas;
