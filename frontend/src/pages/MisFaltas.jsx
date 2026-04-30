import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Clock, XCircle, CheckCircle } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import ShowProgress from '../components/ShowProgress'; // Importar el nuevo componente
import Lottie from 'lottie-react';
import checkAnimation from '../../public/check.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';
import { formatGrupoNombre } from '../utils/grupo';


const MisFaltas = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [asignaturasConFaltas, setAsignaturasConFaltas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Estados para filtros de SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [allGrupos, setAllGrupos] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
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
                setAllGrupos(data['hydra:member'] || data.member || []);
                setSelectedYear('');
                setSelectedGrupo('');
                setAlumnos([]);
                setSelectedAlumno('');
            })
            .catch(err => console.error("Error cargando grupos:", err));
        } else {
            setAllGrupos([]);
            setSelectedYear('');
            setSelectedGrupo('');
            setAlumnos([]);
            setSelectedAlumno('');
        }
    }, [selectedCentro, isSuperAdmin]);

    // Años disponibles y grupos filtrados por año
    const availableYears = [...new Set(allGrupos.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
    const grupos = selectedYear ? allGrupos.filter(g => g.anioEscolar === selectedYear) : allGrupos;

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
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
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
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
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
 subtitle={t('myAbsences.subtitle')}
                            logo={<Lottie animationData={checkAnimation} loop={true} style={{ width: 56, height: 56 }} />}
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
                                    ...grupos.map(g => ({ value: String(g.id), label: formatGrupoNombre(g) })),
                                ]}
                            />
                            <ThemedSelect
                                value={selectedAlumno}
                                onChange={setSelectedAlumno}
                                disabled={!selectedGrupo}
                                minWidth={200}
                                ariaLabel={t('myAbsences.selectStudent')}
                                options={[
                                    { value: '', label: t('myAbsences.selectStudent') },
                                    ...alumnos.map(a => ({ value: String(a.id), label: `${a.nombre} ${a.apellidos}` })),
                                ]}
                            />
                        </div>
                    )}
                </CrudHeader>
                
                {loading ? (
                    <LoadingView />
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
                        expandedId={expandedId}
                        onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisFaltas;
