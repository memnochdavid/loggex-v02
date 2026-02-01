import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../utils/theme';
import styles from './Configuracion.module.css';
import { Save, RotateCcw, Palette, Layout as LayoutIcon, Type, MousePointer, Scroll, Calendar, Clock } from 'lucide-react';

const Configuracion = () => {
    const { user, checkAuth } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    
    const defaultColors = {
        primaryColor: '#6366f1',
        secondaryColor: '#64748b',
        sidebarColor: '#1e293b',
        sidebarActiveColor: '#334155',
        sidebarActiveTextColor: '#ffffff',
        sidebarHoverColor: '#334155',
        sidebarHoverTextColor: '#ffffff',
        textMainColor: '#334155',
        textSecondaryColor: '#64748b',
        buttonPrimaryColor: '#6366f1',
        buttonPrimaryTextColor: '#ffffff',
        buttonSecondaryColor: '#ffffff',
        buttonSecondaryTextColor: '#334155',
        headerFooterColor: '#1e293b',
        headerFooterTextColor: '#ffffff',
        scrollbarThumbColor: '#cbd5e1',
        scrollbarTrackColor: '#f1f5f9',
        scrollbarHoverColor: '#94a3b8',
        calendarSelectedBgColor: '#6366f1',
        calendarSelectedTextColor: '#ffffff',
        calendarWeekendBgColor: '#f1f5f9',
        calendarWeekendTextColor: '#64748b',
        timetableHeaderBgColor: '#f1f5f9',
        timetableHeaderTextColor: '#334155',
        timetableHoursBgColor: '#f8fafc',
        timetableHoursTextColor: '#64748b'
    };

    const [colors, setColors] = useState(defaultColors);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (user) {
            if (user.centro && user.centro.personalizacion) {
                setColors({ ...defaultColors, ...user.centro.personalizacion });
            } else if (isSuperAdmin && user.centro && user.centro.id === 'global' && user.centro.personalizacion) {
                setColors({ ...defaultColors, ...user.centro.personalizacion });
            }
        }
    }, [user, isSuperAdmin]);

    useEffect(() => {
        applyTheme(colors);
    }, [colors]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setColors(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleReset = () => {
        setColors(defaultColors);
        applyTheme(defaultColors);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('https://localhost:9443/api/configuracion/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(colors),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setMessage({ type: 'success', text: data.message });
                await checkAuth();
            } else {
                const errorData = await response.json();
                setMessage({ type: 'error', text: errorData.message || 'Error al guardar configuración' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
        } finally {
            setLoading(false);
        }
    };

    if (!user || (!user.centro && !isSuperAdmin)) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.card}>
                        <p>Esta configuración solo está disponible para usuarios asignados a un centro o administradores globales.</p>
                    </div>
                </div>
            </Layout>
        );
    }

    const renderColorInput = (label, name) => (
        <div className={styles.colorItem}>
            <label className={styles.label}>{label}</label>
            <div className={styles.colorInputContainer}>
                <input
                    type="color"
                    name={name}
                    value={colors[name] || '#000000'}
                    onChange={handleChange}
                    className={styles.colorInput}
                />
                <input
                    type="text"
                    name={name}
                    value={colors[name] || ''}
                    onChange={handleChange}
                    className={styles.colorTextInput}
                    maxLength={7}
                />
            </div>
        </div>
    );

    const tabs = [
        { id: 'general', label: 'General', icon: <Palette size={18} /> },
        { id: 'sidebar', label: 'Barra Lateral', icon: <LayoutIcon size={18} /> },
        { id: 'text', label: 'Textos', icon: <Type size={18} /> },
        { id: 'buttons', label: 'Botones', icon: <MousePointer size={18} /> },
        { id: 'scrollbar', label: 'Scrollbar', icon: <Scroll size={18} /> },
        { id: 'calendar', label: 'Calendario', icon: <Calendar size={18} /> },
        { id: 'timetable', label: 'Horario', icon: <Clock size={18} /> },
    ];

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Personalización</h1>
                    <span className={styles.subtitle}>
                        {user.centro && user.centro.id !== 'global' 
                            ? `Ajusta la apariencia para ${user.centro.nombre}` 
                            : 'Ajusta la apariencia global del sistema'}
                    </span>
                </div>

                {message && (
                    <div className={`${styles.message} ${styles[message.type]}`}>
                        {message.text}
                    </div>
                )}

                <div className={styles.layout}>
                    <div className={styles.sidebar}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                        
                        <div className={styles.actions}>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={handleReset}
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <RotateCcw size={18} style={{ marginRight: '8px' }} />
                                Restablecer
                            </Button>
                            <Button 
                                onClick={handleSubmit} 
                                disabled={loading}
                                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                            >
                                <Save size={18} style={{ marginRight: '8px' }} />
                                {loading ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.formSection}>
                            {activeTab === 'general' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Color Principal', 'primaryColor')}
                                    {renderColorInput('Color Secundario', 'secondaryColor')}
                                    {renderColorInput('Fondo Header/Footer', 'headerFooterColor')}
                                    {renderColorInput('Texto Header/Footer', 'headerFooterTextColor')}
                                </div>
                            )}

                            {activeTab === 'sidebar' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Barra Lateral', 'sidebarColor')}
                                    {renderColorInput('Fondo Elemento Activo', 'sidebarActiveColor')}
                                    {renderColorInput('Texto Elemento Activo', 'sidebarActiveTextColor')}
                                    {renderColorInput('Fondo Hover', 'sidebarHoverColor')}
                                    {renderColorInput('Texto Hover', 'sidebarHoverTextColor')}
                                </div>
                            )}

                            {activeTab === 'text' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Texto Principal', 'textMainColor')}
                                    {renderColorInput('Texto Secundario', 'textSecondaryColor')}
                                </div>
                            )}

                            {activeTab === 'buttons' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Botón Primario', 'buttonPrimaryColor')}
                                    {renderColorInput('Texto Botón Primario', 'buttonPrimaryTextColor')}
                                    {renderColorInput('Fondo Botón Secundario', 'buttonSecondaryColor')}
                                    {renderColorInput('Texto Botón Secundario', 'buttonSecondaryTextColor')}
                                </div>
                            )}

                            {activeTab === 'scrollbar' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Color Barra (Thumb)', 'scrollbarThumbColor')}
                                    {renderColorInput('Color Fondo (Track)', 'scrollbarTrackColor')}
                                    {renderColorInput('Color Hover', 'scrollbarHoverColor')}
                                </div>
                            )}

                            {activeTab === 'calendar' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Día Seleccionado', 'calendarSelectedBgColor')}
                                    {renderColorInput('Texto Día Seleccionado', 'calendarSelectedTextColor')}
                                    {renderColorInput('Fondo Fin de Semana', 'calendarWeekendBgColor')}
                                    {renderColorInput('Texto Fin de Semana', 'calendarWeekendTextColor')}
                                </div>
                            )}

                            {activeTab === 'timetable' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Cabecera', 'timetableHeaderBgColor')}
                                    {renderColorInput('Texto Cabecera', 'timetableHeaderTextColor')}
                                    {renderColorInput('Fondo Horas', 'timetableHoursBgColor')}
                                    {renderColorInput('Texto Horas', 'timetableHoursTextColor')}
                                </div>
                            )}
                        </div>

                        <div className={styles.previewContainer}>
                            <h3 className={styles.previewTitle}>Vista Previa de Componentes</h3>
                            
                            <div className={styles.previewBox}>
                                <div className={styles.previewRow}>
                                    <button 
                                        className={styles.previewBtn}
                                        style={{ backgroundColor: colors.buttonPrimaryColor, color: colors.buttonPrimaryTextColor }}
                                    >
                                        Botón Primario
                                    </button>
                                    <button 
                                        className={styles.previewBtn}
                                        style={{ 
                                            backgroundColor: colors.buttonSecondaryColor, 
                                            color: colors.buttonSecondaryTextColor,
                                            border: `1px solid ${colors.textSecondaryColor}`
                                        }}
                                    >
                                        Botón Secundario
                                    </button>
                                </div>

                                <div className={styles.previewRow}>
                                    <div style={{ color: colors.textMainColor, fontWeight: 'bold' }}>Texto Principal</div>
                                    <div style={{ color: colors.textSecondaryColor }}>Texto Secundario</div>
                                </div>

                                <div className={styles.previewSidebarMock}>
                                    <div style={{ backgroundColor: colors.sidebarColor, padding: '10px', borderRadius: '4px', color: '#fff' }}>
                                        <div style={{ marginBottom: '5px', opacity: 0.7 }}>Menú</div>
                                        <div style={{ 
                                            backgroundColor: colors.sidebarActiveColor, 
                                            color: colors.sidebarActiveTextColor,
                                            padding: '5px', 
                                            borderRadius: '4px',
                                            marginBottom: '5px'
                                        }}>
                                            Activo
                                        </div>
                                        <div style={{ 
                                            backgroundColor: colors.sidebarHoverColor, 
                                            color: colors.sidebarHoverTextColor,
                                            padding: '5px', 
                                            borderRadius: '4px'
                                        }}>
                                            Hover
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Scrollbar */}
                                <div style={{ 
                                    height: '100px', 
                                    overflowY: 'scroll', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '10px',
                                    backgroundColor: '#fff'
                                }}>
                                    <div style={{ height: '200px' }}>
                                        <p style={{ color: colors.textMainColor }}>Contenido con scroll para probar la barra de desplazamiento personalizada.</p>
                                        <p style={{ color: colors.textSecondaryColor }}>Desplázate hacia abajo...</p>
                                    </div>
                                </div>

                                {/* Preview Calendar Day */}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ 
                                        width: '30px', height: '30px', borderRadius: '50%', 
                                        backgroundColor: colors.calendarSelectedBgColor, 
                                        color: colors.calendarSelectedTextColor,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px', fontWeight: 'bold'
                                    }}>
                                        23
                                    </div>
                                    <div style={{ 
                                        width: '30px', height: '30px', borderRadius: '50%', 
                                        backgroundColor: colors.calendarWeekendBgColor, 
                                        color: colors.calendarWeekendTextColor,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px'
                                    }}>
                                        S
                                    </div>
                                </div>

                                {/* Preview Timetable Header */}
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <div style={{ 
                                        backgroundColor: colors.timetableHeaderBgColor, 
                                        color: colors.timetableHeaderTextColor,
                                        padding: '5px 10px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                    }}>
                                        Lunes
                                    </div>
                                    <div style={{ 
                                        backgroundColor: colors.timetableHoursBgColor, 
                                        color: colors.timetableHoursTextColor,
                                        padding: '5px 10px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                    }}>
                                        8:30
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Configuracion;
