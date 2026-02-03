import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../utils/theme';
import styles from './Configuracion.module.css';
import { Save, RotateCcw, Palette, Layout as LayoutIcon, Type, MousePointer, Scroll, Calendar, Clock, Table, List, Layers, Trash2, Check, Maximize, Image as ImageIcon } from 'lucide-react';

// Importar temas predefinidos
import defaultTheme from './themes-pred/default.json';
import rojoTheme from './themes-pred/rojo.json';
import moradoTheme from './themes-pred/morado.json';
import azulTheme from './themes-pred/azul.json';
import verdeTheme from './themes-pred/verde.json';

const Configuracion = () => {
    const { user, checkAuth } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    
    // Solo admins de centro pueden cambiar el logo (no superadmin global)
    const canChangeLogo = isAdmin && !isSuperAdmin && user?.centro;

    const defaultSettings = defaultTheme.settings;

    const predefinedThemes = [
        defaultTheme,
        rojoTheme,
        moradoTheme,
        azulTheme,
        verdeTheme
    ];

    const [settings, setSettings] = useState(defaultSettings);
    const [savedThemes, setSavedThemes] = useState([]);
    const [newThemeName, setNewThemeName] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    
    // Estado para el logo
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    useEffect(() => {
        if (user) {
            if (user.centro && user.centro.personalizacion) {
                setSettings({ ...defaultSettings, ...user.centro.personalizacion });
                if (user.centro.personalizacion.savedThemes) {
                    setSavedThemes(user.centro.personalizacion.savedThemes);
                }
                // Cargar logo actual si existe
                if (user.centro.logo) {
                    setLogoPreview(`https://localhost:9443/uploads/logo-centro/${user.centro.logo}`);
                }
            } else if (isSuperAdmin && user.centro && user.centro.id === 'global' && user.centro.personalizacion) {
                setSettings({ ...defaultSettings, ...user.centro.personalizacion });
                if (user.centro.personalizacion.savedThemes) {
                    setSavedThemes(user.centro.personalizacion.savedThemes);
                }
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleReset = () => {
        setSettings(prev => ({
            ...defaultSettings,
            savedThemes: prev.savedThemes // Mantener los temas guardados
        }));
        applyTheme(defaultSettings);
    };

    const handleSaveTheme = () => {
        if (!newThemeName.trim()) return;
        
        const { savedThemes: currentSavedThemes, ...themeSettings } = settings;
        
        const newTheme = {
            name: newThemeName,
            settings: themeSettings
        };
        
        const updatedThemes = [...savedThemes, newTheme];
        setSavedThemes(updatedThemes);
        setSettings(prev => ({ ...prev, savedThemes: updatedThemes }));
        setNewThemeName('');
    };

    const handleLoadTheme = (themeSettings) => {
        setSettings(prev => ({
            ...prev,
            ...themeSettings,
            savedThemes: savedThemes // Mantener la lista de temas guardados
        }));
    };

    const handleDeleteTheme = (index) => {
        const updatedThemes = savedThemes.filter((_, i) => i !== index);
        setSavedThemes(updatedThemes);
        setSettings(prev => ({ ...prev, savedThemes: updatedThemes }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // 1. Guardar Configuración de Personalización
            const responseConfig = await fetch('https://localhost:9443/api/configuracion/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...settings, savedThemes }),
                credentials: 'include'
            });

            if (!responseConfig.ok) {
                const errorData = await responseConfig.json();
                throw new Error(errorData.message || 'Error al guardar configuración');
            }

            // 2. Guardar Logo (si se ha seleccionado uno y es admin de centro)
            if (canChangeLogo && logoFile) {
                const formData = new FormData();
                // Necesitamos enviar los datos obligatorios del centro para el update, aunque no cambien
                // Pero el endpoint espera multipart/form-data.
                // Como el endpoint de update requiere nombre, cif, direccion, etc., 
                // lo ideal sería tener un endpoint solo para el logo o enviar todo.
                // Para simplificar y no romper, enviaremos los datos actuales del centro.
                
                formData.append('nombre', user.centro.nombre);
                // CIF y Dirección no los tenemos en user.centro por defecto en el login, 
                // así que esto podría fallar si el backend valida estrictamente.
                // Vamos a asumir que el backend permite actualización parcial o que el usuario tiene esos datos.
                // Si user.centro no tiene cif/direccion, esto fallará.
                // Solución: Hacer un fetch del centro primero para obtener todos los datos.
                
                const centroRes = await fetch(`https://localhost:9443/api/centros/${user.centro.id}`, {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                const centroData = await centroRes.json();
                
                formData.append('nombre', centroData.nombre);
                formData.append('cif', centroData.cif);
                formData.append('direccion', centroData.direccion);
                if (centroData.telefono) formData.append('telefono', centroData.telefono);
                formData.append('activo', centroData.activo ? 'true' : 'false');
                formData.append('logo', logoFile);

                const responseLogo = await fetch(`https://localhost:9443/api/centro/${user.centro.id}/update`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!responseLogo.ok) {
                    throw new Error('Error al subir el logo');
                }
            }

            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
            await checkAuth(); // Recargar usuario para ver cambios (logo, etc)

        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Error de conexión' });
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

    // ... (renderColorInput, renderNumberInput, renderThemeCard, renderPreview igual que antes) ...
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
                className={styles.colorTextInput}
                min="1"
                max="100"
            />
        </div>
    );

    const renderThemeCard = (theme, index, isPredefined = false) => {
        const themeSettings = theme.settings;
        return (
            <div key={index} className={styles.themeCard}>
                <div className={styles.themePreview} style={{ backgroundColor: themeSettings.sidebarColor }}>
                    <div className={styles.themeHeader} style={{ backgroundColor: themeSettings.headerFooterColor }}></div>
                    <div className={styles.themeBody}>
                        <div className={styles.themeSidebar} style={{ backgroundColor: themeSettings.sidebarColor }}></div>
                        <div className={styles.themeContent}>
                            <div className={styles.themeButton} style={{ backgroundColor: themeSettings.primaryColor }}></div>
                        </div>
                    </div>
                </div>
                <div className={styles.themeInfo}>
                    <span className={styles.themeName}>{theme.name}</span>
                    <div className={styles.themeActions}>
                        <button 
                            className={styles.iconButton} 
                            onClick={() => handleLoadTheme(themeSettings)}
                            title="Aplicar Tema"
                        >
                            <Check size={16} />
                        </button>
                        {!isPredefined && (
                            <button 
                                className={`${styles.iconButton} ${styles.deleteButton}`} 
                                onClick={() => handleDeleteTheme(index)}
                                title="Eliminar Tema"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderPreview = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa General</h4>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Header Simulado */}
                            <div style={{ backgroundColor: settings.headerFooterColor, color: settings.headerFooterTextColor, padding: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>Logo</span>
                                <span>Usuario</span>
                            </div>
                            {/* Body Simulado */}
                            <div style={{ padding: '20px', backgroundColor: '#f8fafc' }}>
                                <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <h3 style={{ color: settings.primaryColor, marginTop: 0 }}>Título Principal</h3>
                                    <p style={{ color: settings.secondaryColor }}>Subtítulo o texto secundario de ejemplo.</p>
                                </div>
                            </div>
                            {/* Footer Simulado */}
                            <div style={{ backgroundColor: settings.headerFooterColor, color: settings.headerFooterTextColor, padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                Footer
                            </div>
                        </div>
                    </div>
                );
            // ... (Resto de casos igual que antes) ...
            case 'sidebar':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Barra Lateral</h4>
                        <div style={{ width: '200px', backgroundColor: settings.sidebarColor, borderRadius: '8px', overflow: 'hidden', padding: '10px' }}>
                            <div style={{ 
                                padding: '10px', 
                                marginBottom: '5px', 
                                borderRadius: '6px', 
                                color: '#94a3b8', // Texto normal por defecto (simulado)
                                display: 'flex', alignItems: 'center', gap: '10px'
                            }}>
                                <LayoutIcon size={16} /> Inicio
                            </div>
                            <div style={{ 
                                padding: '10px', 
                                marginBottom: '5px', 
                                borderRadius: '6px', 
                                backgroundColor: settings.sidebarActiveColor, 
                                color: settings.sidebarActiveTextColor,
                                display: 'flex', alignItems: 'center', gap: '10px'
                            }}>
                                <LayoutIcon size={16} /> Perfil (Activo)
                            </div>
                            <div style={{ 
                                padding: '10px', 
                                borderRadius: '6px', 
                                backgroundColor: settings.sidebarHoverColor, 
                                color: settings.sidebarHoverTextColor,
                                display: 'flex', alignItems: 'center', gap: '10px'
                            }}>
                                <LayoutIcon size={16} /> Menú (Hover)
                            </div>
                        </div>
                    </div>
                );

            case 'text':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Tipografía</h4>
                        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h1 style={{ color: settings.textMainColor, margin: '0 0 10px 0' }}>Encabezado Principal</h1>
                            <p style={{ color: settings.textMainColor, lineHeight: '1.5' }}>
                                Este es un párrafo de texto normal utilizando el color principal configurado. 
                                Sirve para leer contenido extenso de forma cómoda.
                            </p>
                            <p style={{ color: settings.textSecondaryColor, fontSize: '0.9em' }}>
                                Este es un texto secundario o "muted", usado para metadatos, fechas o descripciones menos importantes.
                            </p>
                            <p style={{ color: settings.specialTextColor, fontSize: '1.1em', fontWeight: 'bold', background: '#334155', padding: '5px', borderRadius: '4px' }}>
                                Este es el texto especial, para cabeceras de perfil, etc.
                            </p>
                        </div>
                    </div>
                );

            case 'buttons':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Botones</h4>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button style={{ 
                                backgroundColor: settings.buttonPrimaryColor, 
                                color: settings.buttonPrimaryTextColor,
                                border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer'
                            }}>
                                Botón Primario
                            </button>
                            <button style={{ 
                                backgroundColor: settings.buttonSecondaryColor, 
                                color: settings.buttonSecondaryTextColor,
                                border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer'
                            }}>
                                Botón Secundario
                            </button>
                        </div>
                    </div>
                );

            case 'scrollbar':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Scrollbar</h4>
                        <div style={{ 
                            height: '100px', 
                            width: '200px', 
                            overflowY: 'scroll', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '6px',
                            padding: '10px'
                        }}>
                            <div style={{ 
                                position: 'absolute', right: '20px', top: '60px', width: settings.scrollbarWidth || '12px', height: '40px', 
                                backgroundColor: settings.scrollbarThumbColor, borderRadius: '4px', zIndex: 10 
                            }}></div>
                            <div style={{
                                position: 'absolute', right: '20px', top: '20px', width: settings.scrollbarWidth || '12px', height: '100px',
                                backgroundColor: settings.scrollbarTrackColor, borderRadius: '4px', zIndex: 5
                            }}></div>
                            
                            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                                (Nota: El estilo real del scrollbar se aplica a toda la página. Esta es una representación de los colores).
                                <br/><br/>Lorem ipsum dolor sit amet...
                            </p>
                        </div>
                    </div>
                );

            case 'calendar':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Calendario</h4>
                        <div style={{ width: '250px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', backgroundColor: 'white' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', fontSize: '12px' }}>
                                <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                                
                                <span style={{ padding: '5px' }}>1</span>
                                <span style={{ padding: '5px' }}>2</span>
                                <span style={{ padding: '5px' }}>3</span>
                                <span style={{ padding: '5px' }}>4</span>
                                <span style={{ padding: '5px' }}>5</span>
                                <span style={{ backgroundColor: settings.calendarWeekendBgColor, color: settings.calendarWeekendTextColor, borderRadius: '50%', padding: '5px' }}>6</span>
                                <span style={{ backgroundColor: settings.calendarWeekendBgColor, color: settings.calendarWeekendTextColor, borderRadius: '50%', padding: '5px' }}>7</span>
                                
                                <span style={{ padding: '5px' }}>8</span>
                                <span style={{ backgroundColor: settings.calendarSelectedBgColor, color: settings.calendarSelectedTextColor, borderRadius: '50%', padding: '5px', fontWeight: 'bold' }}>9</span>
                                <span style={{ padding: '5px' }}>10</span>
                            </div>
                        </div>
                    </div>
                );

            case 'timetable':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Horario</h4>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '60px 1fr 1fr', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            fontSize: '12px'
                        }}>
                            {/* Header */}
                            <div style={{ padding: '5px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>Hora</div>
                            <div style={{ 
                                padding: '5px', 
                                backgroundColor: settings.timetableHeaderBgColor, 
                                color: settings.timetableHeaderTextColor,
                                textAlign: 'center',
                                borderBottom: '1px solid #e2e8f0',
                                borderRight: '1px solid #e2e8f0',
                                fontWeight: 'bold'
                            }}>Lunes</div>
                            <div style={{ 
                                padding: '5px', 
                                backgroundColor: settings.timetableSelectedHeaderBg,
                                color: settings.timetableSelectedHeaderText,
                                textAlign: 'center',
                                borderBottom: '1px solid #e2e8f0',
                                fontWeight: 'bold'
                            }}>Martes (Activo)</div>

                            {/* Row 1 */}
                            <div style={{ 
                                padding: '10px 5px', 
                                backgroundColor: settings.timetableHoursBgColor, 
                                color: settings.timetableHoursTextColor,
                                borderRight: '1px solid #e2e8f0',
                                textAlign: 'center'
                            }}>08:00</div>
                            <div style={{ padding: '10px', borderRight: '1px solid #e2e8f0', backgroundColor: '#fff' }}>Clase A</div>
                            <div style={{ padding: '10px', backgroundColor: settings.timetableSelectedCellBg }}>Clase B</div>
                        </div>
                    </div>
                );

            case 'datatable':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Tabla</h4>
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
                            <span style={{ 
                                backgroundColor: settings.datatableHeaderActiveBgColor, 
                                color: settings.datatableHeaderActiveTextColor,
                                padding: '2px 5px',
                                borderRadius: '2px'
                            }}>EDAD (Activo)</span>
                        </div>
                        
                        {/* Paginación en Tabla */}
                        <div style={{ 
                            backgroundColor: settings.datatablePaginationBgColor, 
                            color: settings.datatablePaginationTextColor,
                            padding: '10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '10px'
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
                                <div style={{ 
                                    backgroundColor: settings.datatablePaginationButtonActiveBgColor, 
                                    color: settings.datatablePaginationButtonActiveTextColor,
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}>3</div>
                            </div>
                        </div>
                    </div>
                );

            case 'accordion':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Acordeón</h4>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ 
                                padding: '10px 15px', 
                                backgroundColor: settings.accordionHeaderBgColor, 
                                color: settings.accordionHeaderTextColor,
                                fontWeight: '600'
                            }}>
                                Cabecera del Acordeón
                            </div>
                            <div style={{ 
                                padding: '15px', 
                                backgroundColor: settings.accordionContentBgColor, 
                                color: settings.accordionContentTextColor,
                                fontSize: '14px'
                            }}>
                                Contenido del acordeón.
                            </div>
                        </div>
                    </div>
                );

            case 'modal':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Modal</h4>
                        <div style={{ 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            width: '300px',
                            margin: '0 auto'
                        }}>
                            <div style={{ 
                                padding: '10px 15px', 
                                backgroundColor: settings.modalHeaderBgColor, 
                                color: settings.modalHeaderTextColor,
                                fontWeight: 'bold',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>Título del Modal</span>
                                <div style={{
                                    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px',
                                    backgroundColor: settings.modalCloseButtonBgColor,
                                    color: settings.modalCloseButtonTextColor,
                                    border: '1px solid #e2e8f0'
                                }}>✕</div>
                            </div>
                            <div style={{ 
                                padding: '15px', 
                                backgroundColor: settings.modalBodyBgColor, 
                                color: settings.modalBodyTextColor,
                                fontSize: '14px'
                            }}>
                                <p style={{ margin: 0 }}>Este es el contenido del cuerpo del modal. Aquí irían los formularios o información.</p>
                            </div>
                            <div style={{ 
                                padding: '10px 15px', 
                                backgroundColor: settings.modalFooterBgColor, 
                                borderTop: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '10px'
                            }}>
                                <button style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '12px' }}>Cancelar</button>
                                <button style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', background: settings.buttonPrimaryColor, color: settings.buttonPrimaryTextColor, fontSize: '12px' }}>Guardar</button>
                            </div>
                        </div>
                    </div>
                );

            case 'pagination':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Vista Previa Paginación</h4>
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
                                <div style={{ 
                                    backgroundColor: settings.datatablePaginationButtonActiveBgColor, 
                                    color: settings.datatablePaginationButtonActiveTextColor,
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}>3</div>
                            </div>
                        </div>
                    </div>
                );

            case 'themes':
                return (
                    <div className={styles.previewBox}>
                        <h4 style={{ fontSize: '12px', marginBottom: '10px', color: '#64748b' }}>Resumen de Vistas Previas</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* Resumen General */}
                            <div>
                                <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>General</h5>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div style={{ backgroundColor: settings.headerFooterColor, color: settings.headerFooterTextColor, padding: '5px 10px', fontSize: '10px' }}>Header</div>
                                    <div style={{ padding: '10px', backgroundColor: '#f8fafc' }}>
                                        <h3 style={{ color: settings.primaryColor, margin: 0, fontSize: '14px' }}>Título</h3>
                                        <p style={{ color: settings.secondaryColor, fontSize: '10px', margin: 0 }}>Subtítulo</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Sidebar */}
                            <div>
                                <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>Sidebar</h5>
                                <div style={{ backgroundColor: settings.sidebarColor, borderRadius: '6px', padding: '5px' }}>
                                    <div style={{ padding: '5px', borderRadius: '4px', backgroundColor: settings.sidebarActiveColor, color: settings.sidebarActiveTextColor, fontSize: '10px' }}>Activo</div>
                                    <div style={{ padding: '5px', borderRadius: '4px', backgroundColor: settings.sidebarHoverColor, color: settings.sidebarHoverTextColor, fontSize: '10px', marginTop: '2px' }}>Hover</div>
                                </div>
                            </div>

                            {/* Resumen Botones */}
                            <div>
                                <h5 style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>Botones</h5>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button style={{ backgroundColor: settings.buttonPrimaryColor, color: settings.buttonPrimaryTextColor, border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>Primario</button>
                                    <button style={{ backgroundColor: settings.buttonSecondaryColor, color: settings.buttonSecondaryTextColor, border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>Secundario</button>
                                </div>
                            </div>

                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: <Palette size={18} /> },
        { id: 'sidebar', label: 'Barra Lateral', icon: <LayoutIcon size={18} /> },
        { id: 'text', label: 'Textos', icon: <Type size={18} /> },
        { id: 'buttons', label: 'Botones', icon: <MousePointer size={18} /> },
        { id: 'scrollbar', label: 'Scrollbar', icon: <Scroll size={18} /> },
        { id: 'calendar', label: 'Calendario', icon: <Calendar size={18} /> },
        { id: 'timetable', label: 'Horario', icon: <Clock size={18} /> },
        { id: 'datatable', label: 'Tablas', icon: <Table size={18} /> },
        { id: 'accordion', label: 'Acordeón', icon: <Layers size={18} /> },
        { id: 'modal', label: 'Modales', icon: <Maximize size={18} /> },
        { id: 'pagination', label: 'Paginación', icon: <List size={18} /> },
        { id: 'themes', label: 'Temas', icon: <Palette size={18} /> },
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
                                    
                                    {/* Campo de Logo (Solo para admins de centro) */}
                                    {canChangeLogo && (
                                        <div className={styles.colorItem} style={{ gridColumn: '1 / -1' }}>
                                            <label className={styles.label}>Logo del Centro</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {logoPreview ? (
                                                    <img 
                                                        src={logoPreview} 
                                                        alt="Logo" 
                                                        style={{ width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', backgroundColor: 'white' }} 
                                                    />
                                                ) : (
                                                    <div style={{ width: '64px', height: '64px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                                                        <ImageIcon size={24} color="#cbd5e1" />
                                                    </div>
                                                )}
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    style={{ fontSize: '0.9rem' }}
                                                />
                                            </div>
                                        </div>
                                    )}
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
                                    {renderColorInput('Texto Especial (Cabeceras)', 'specialTextColor')}
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
                                    {renderColorInput('Fondo Cabecera Día Activo', 'timetableSelectedHeaderBg')}
                                    {renderColorInput('Texto Cabecera Día Activo', 'timetableSelectedHeaderText')}
                                    {renderColorInput('Fondo Celdas Día Activo', 'timetableSelectedCellBg')}
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

                            {activeTab === 'accordion' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Cabecera', 'accordionHeaderBgColor')}
                                    {renderColorInput('Texto Cabecera', 'accordionHeaderTextColor')}
                                    {renderColorInput('Fondo Contenido', 'accordionContentBgColor')}
                                    {renderColorInput('Texto Contenido', 'accordionContentTextColor')}
                                </div>
                            )}

                            {activeTab === 'modal' && (
                                <div className={styles.grid}>
                                    {renderColorInput('Fondo Cabecera', 'modalHeaderBgColor')}
                                    {renderColorInput('Texto Cabecera', 'modalHeaderTextColor')}
                                    {renderColorInput('Fondo Cuerpo', 'modalBodyBgColor')}
                                    {renderColorInput('Texto Cuerpo', 'modalBodyTextColor')}
                                    {renderColorInput('Fondo Pie', 'modalFooterBgColor')}
                                    
                                    {renderColorInput('Fondo Botón Cerrar', 'modalCloseButtonBgColor')}
                                    {renderColorInput('Texto Botón Cerrar', 'modalCloseButtonTextColor')}
                                    {renderColorInput('Fondo Botón Cerrar Hover', 'modalCloseButtonHoverBgColor')}
                                    {renderColorInput('Texto Botón Cerrar Hover', 'modalCloseButtonHoverTextColor')}
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

                            {activeTab === 'themes' && (
                                <div className={styles.themesContainer}>
                                    <div className={styles.addTheme}>
                                        <input 
                                            type="text" 
                                            value={newThemeName}
                                            onChange={(e) => setNewThemeName(e.target.value)}
                                            placeholder="Nombre del nuevo tema"
                                            className={styles.colorTextInput}
                                            style={{ flex: 1 }}
                                        />
                                        <Button onClick={handleSaveTheme} disabled={!newThemeName.trim()}>
                                            Guardar Actual
                                        </Button>
                                    </div>
                                    
                                    <h4 className={styles.sectionTitle}>Temas Predefinidos</h4>
                                    <div className={styles.themesGrid}>
                                        {predefinedThemes.map((theme, index) => renderThemeCard(theme, index, true))}
                                    </div>

                                    {savedThemes.length > 0 && (
                                        <>
                                            <h4 className={styles.sectionTitle} style={{ marginTop: '20px' }}>Mis Temas Guardados</h4>
                                            <div className={styles.themesGrid}>
                                                {savedThemes.map((theme, index) => renderThemeCard(theme, index, false))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className={styles.previewContainer}>
                            <h3 className={styles.previewTitle}>Vista Previa</h3>
                            {renderPreview()}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Configuracion;
