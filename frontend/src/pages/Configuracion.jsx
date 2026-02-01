import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../utils/theme';
import styles from './Configuracion.module.css';
import { Save, RotateCcw, Palette, Layout as LayoutIcon, Type, MousePointer, Scroll, Calendar, Clock, Table, List } from 'lucide-react';

const Configuracion = () => {
    const { user, checkAuth } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    
    const defaultSettings = {
        // Colores Generales
        primaryColor: '#6366f1',
        secondaryColor: '#64748b',
        
        // Sidebar
        sidebarColor: '#1e293b',
        sidebarActiveColor: '#334155',
        sidebarActiveTextColor: '#ffffff',
        sidebarHoverColor: '#334155',
        sidebarHoverTextColor: '#ffffff',
        
        // Textos
        textMainColor: '#334155',
        textSecondaryColor: '#64748b',
        
        // Botones
        buttonPrimaryColor: '#6366f1',
        buttonPrimaryTextColor: '#ffffff',
        buttonSecondaryColor: '#ffffff',
        buttonSecondaryTextColor: '#334155',
        
        // Header/Footer
        headerFooterColor: '#1e293b',
        headerFooterTextColor: '#ffffff',
        
        // Scrollbar
        scrollbarThumbColor: '#cbd5e1',
        scrollbarTrackColor: '#f1f5f9',
        scrollbarHoverColor: '#94a3b8',
        
        // Calendario
        calendarSelectedBgColor: '#6366f1',
        calendarSelectedTextColor: '#ffffff',
        calendarWeekendBgColor: '#f1f5f9',
        calendarWeekendTextColor: '#64748b',
        
        // Horario
        timetableHeaderBgColor: '#f1f5f9',
        timetableHeaderTextColor: '#334155',
        timetableHoursBgColor: '#f8fafc',
        timetableHoursTextColor: '#64748b',
        
        // DataTable
        datatableHeaderBgColor: '#f8fafc',
        datatableHeaderTextColor: '#64748b',
        datatableHeaderHoverBgColor: '#f1f5f9',
        datatableHeaderHoverTextColor: '#334155',
        datatableHeaderActiveBgColor: '#e2e8f0',
        datatableHeaderActiveTextColor: '#1e293b',
        datatablePaginationBgColor: '#f8fafc',
        datatablePaginationTextColor: '#64748b',
        datatablePaginationButtonBgColor: '#ffffff',
        datatablePaginationButtonTextColor: '#64748b',
        datatablePaginationButtonHoverBgColor: '#f1f5f9',
        datatablePaginationButtonHoverTextColor: '#334155',
        datatablePaginationButtonActiveBgColor: '#e2e8f0',
        datatablePaginationButtonActiveTextColor: '#1e293b',

        // Paginación (Items Per Page)
        itemsPerPageUsuarios: 20,
        itemsPerPageCentros: 20,
        itemsPerPageCiclos: 20,
        itemsPerPageGrupos: 20,
        itemsPerPageModulos: 20,
        itemsPerPageMatriculas: 20,
        itemsPerPageImparticiones: 20,
        itemsPerPageHorarios: 20
    };

    const [settings, setSettings] = useState(defaultSettings);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (user) {
            if (user.centro && user.centro.personalizacion) {
                setSettings({ ...defaultSettings, ...user.centro.personalizacion });
            } else if (isSuperAdmin && user.centro && user.centro.id === 'global' && user.centro.personalizacion) {
                setSettings({ ...defaultSettings, ...user.centro.personalizacion });
            }
        }
    }, [user, isSuperAdmin]);

    useEffect(() => {
        applyTheme(settings);
    }, [settings]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value) : value
        }));
    };

    const handleReset = () => {
        setSettings(defaultSettings);
        applyTheme(defaultSettings);
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
                body: JSON.stringify(settings),
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
                    value={settings[name] || '#000000'}
                    onChange={handleChange}
                    className={styles.colorInput}
                />
                <input
                    type="text"
                    name={name}
                    value={settings[name] || ''}
                    onChange={handleChange}
                    className={styles.colorTextInput}
                    maxLength={7}
                />
            </div>
        </div>
    );

    const renderNumberInput = (label, name) => (
        <div className={styles.colorItem}>
            <label className={styles.label}>{label}</label>
            <input
                type="number"
                name={name}
                value={settings[name] || 20}
                onChange={handleChange}
                className={styles.colorTextInput} // Reutilizamos estilo de input texto
                min="1"
                max="100"
            />
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
        { id: 'datatable', label: 'Tablas', icon: <Table size={18} /> },
        { id: 'pagination', label: 'Paginación', icon: <List size={18} /> },
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

                            {activeTab === 'datatable' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Cabecera', 'datatableHeaderBgColor')}
                                    {renderColorInput('Texto Cabecera', 'datatableHeaderTextColor')}
                                    {renderColorInput('Fondo Cabecera Hover', 'datatableHeaderHoverBgColor')}
                                    {renderColorInput('Texto Cabecera Hover', 'datatableHeaderHoverTextColor')}
                                    {renderColorInput('Fondo Cabecera Activa', 'datatableHeaderActiveBgColor')}
                                    {renderColorInput('Texto Cabecera Activa', 'datatableHeaderActiveTextColor')}
                                    
                                    {renderColorInput('Fondo Paginación', 'datatablePaginationBgColor')}
                                    {renderColorInput('Texto Paginación', 'datatablePaginationTextColor')}
                                    {renderColorInput('Fondo Botón Paginación', 'datatablePaginationButtonBgColor')}
                                    {renderColorInput('Texto Botón Paginación', 'datatablePaginationButtonTextColor')}
                                    {renderColorInput('Fondo Botón Hover', 'datatablePaginationButtonHoverBgColor')}
                                    {renderColorInput('Texto Botón Hover', 'datatablePaginationButtonHoverTextColor')}
                                    {renderColorInput('Fondo Botón Activo/Disabled', 'datatablePaginationButtonActiveBgColor')}
                                    {renderColorInput('Texto Botón Activo/Disabled', 'datatablePaginationButtonActiveTextColor')}
                                </div>
                            )}

                            {activeTab === 'pagination' && (
                                <div className={styles.grid}>
                                    {renderNumberInput('Usuarios por página', 'itemsPerPageUsuarios')}
                                    {renderNumberInput('Centros por página', 'itemsPerPageCentros')}
                                    {renderNumberInput('Ciclos por página', 'itemsPerPageCiclos')}
                                    {renderNumberInput('Grupos por página', 'itemsPerPageGrupos')}
                                    {renderNumberInput('Módulos por página', 'itemsPerPageModulos')}
                                    {renderNumberInput('Matrículas por página', 'itemsPerPageMatriculas')}
                                    {renderNumberInput('Imparticiones por página', 'itemsPerPageImparticiones')}
                                    {renderNumberInput('Horarios por página', 'itemsPerPageHorarios')}
                                </div>
                            )}
                        </div>

                        <div className={styles.previewContainer}>
                            <h3 className={styles.previewTitle}>Vista Previa de Componentes</h3>
                            
                            <div className={styles.previewBox}>
                                {/* ... (otros previews) ... */}
                                
                                {/* Preview DataTable Header */}
                                <div style={{ 
                                    backgroundColor: settings.datatableHeaderBgColor, 
                                    color: settings.datatableHeaderTextColor,
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    textAlign: 'left',
                                    borderBottom: '1px solid #e2e8f0',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    gap: '10px'
                                }}>
                                    <span>NOMBRE</span>
                                    <span style={{ 
                                        backgroundColor: settings.datatableHeaderHoverBgColor, 
                                        color: settings.datatableHeaderHoverTextColor,
                                        padding: '2px 5px',
                                        borderRadius: '2px'
                                    }}>APELLIDOS (Hover)</span>
                                </div>

                                {/* Preview Pagination */}
                                <div style={{ 
                                    backgroundColor: settings.datatablePaginationBgColor, 
                                    color: settings.datatablePaginationTextColor,
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>Filas: {settings.itemsPerPageUsuarios || 20}</span>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <div style={{ 
                                            backgroundColor: settings.datatablePaginationButtonBgColor, 
                                            color: settings.datatablePaginationButtonTextColor,
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid #ccc'
                                        }}>1</div>
                                        <div style={{ 
                                            backgroundColor: settings.datatablePaginationButtonHoverBgColor, 
                                            color: settings.datatablePaginationButtonHoverTextColor,
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid #ccc'
                                        }}>2</div>
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
