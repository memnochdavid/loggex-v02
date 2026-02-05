import React, { useEffect, useState } from 'react';
import Button from './Button';
import UserAvatar from './UserAvatar'; // Asumiendo que podemos reutilizarlo o adaptar
import styles from '../pages/Usuarios.module.css'; // Reutilizar estilos de tabla/form
import { Check, X, Clock, AlertCircle, Save } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';

const AsistenciaModal = ({ imparticionId, fecha, hora, onClose }) => {
    const [alumnos, setAlumnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [imparticionId, fecha, hora]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Usar ruta personalizada
            const response = await fetch(getApiUrl(`/api/v1/asistencia/sheet?imparticion=${imparticionId}&fecha=${fecha}&hora=${hora}`), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                // Inicializar estado local
                const initializedData = data.map(a => ({
                    ...a,
                    estado: a.asistencia ? a.asistencia.estado : 'P', // Por defecto Presente
                    comentario: a.asistencia ? a.asistencia.comentario : ''
                }));
                setAlumnos(initializedData);
            }
        } catch (error) {
            console.error("Error cargando alumnos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEstadoChange = (alumnoId, nuevoEstado) => {
        setAlumnos(prev => prev.map(a => 
            a.id === alumnoId ? { ...a, estado: nuevoEstado } : a
        ));
    };

    const handleComentarioChange = (alumnoId, texto) => {
        setAlumnos(prev => prev.map(a => 
            a.id === alumnoId ? { ...a, comentario: texto } : a
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                imparticion: imparticionId,
                fecha: fecha,
                hora: hora,
                asistencias: alumnos.map(a => ({
                    alumnoId: a.id,
                    estado: a.estado,
                    comentario: a.comentario
                }))
            };

            // Usar ruta personalizada
            const response = await fetch(getApiUrl('/api/v1/asistencia/batch'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (response.ok) {
                onClose(); // Cerrar modal al guardar
            } else {
                alert("Error al guardar asistencia");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando lista...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>Alumno</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                            <th style={{ padding: '0.5rem' }}>Comentario</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alumnos.map(alumno => (
                            <tr key={alumno.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '0.8rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    {/* Avatar simple */}
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eee', overflow: 'hidden' }}>
                                        {alumno.foto ? (
                                            <img src={getAssetUrl(alumno.foto)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '12px' }}>
                                                {alumno.nombre.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '500' }}>{alumno.apellidos}, {alumno.nombre}</div>
                                    </div>
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        <button 
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'P')}
                                            title="Presente"
                                            style={{ 
                                                padding: '6px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
                                                backgroundColor: alumno.estado === 'P' ? '#dcfce7' : 'white',
                                                color: alumno.estado === 'P' ? '#166534' : '#64748b'
                                            }}
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'F')}
                                            title="Falta"
                                            style={{ 
                                                padding: '6px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
                                                backgroundColor: alumno.estado === 'F' ? '#fee2e2' : 'white',
                                                color: alumno.estado === 'F' ? '#991b1b' : '#64748b'
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'R')}
                                            title="Retraso"
                                            style={{ 
                                                padding: '6px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
                                                backgroundColor: alumno.estado === 'R' ? '#fef9c3' : 'white',
                                                color: alumno.estado === 'R' ? '#854d0e' : '#64748b'
                                            }}
                                        >
                                            <Clock size={16} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'J')}
                                            title="Justificada"
                                            style={{ 
                                                padding: '6px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
                                                backgroundColor: alumno.estado === 'J' ? '#dbeafe' : 'white',
                                                color: alumno.estado === 'J' ? '#1e40af' : '#64748b'
                                            }}
                                        >
                                            <AlertCircle size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input 
                                        type="text" 
                                        value={alumno.comentario || ''}
                                        onChange={(e) => handleComentarioChange(alumno.id, e.target.value)}
                                        placeholder="..."
                                        style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                    <Save size={18} style={{ marginRight: '8px' }} />
                    {saving ? 'Guardando...' : 'Guardar Asistencia'}
                </Button>
            </div>
        </div>
    );
};

export default AsistenciaModal;
