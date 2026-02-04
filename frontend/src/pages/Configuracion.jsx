import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../utils/theme';
import styles from './Configuracion.module.css';
import { Save, RotateCcw, Palette, Layout as LayoutIcon, Type, MousePointer, Scroll, Calendar, Clock, Table, List, Layers, Trash2, Check, Maximize, Image as ImageIcon, Heading, Upload } from 'lucide-react';
import NameTitle from '../components/NameTitle'; // Importar NameTitle para la preview

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
    const fileInputRef = useRef(null); // Referencia para el input de archivo

    // Estado para configuración de título
    const [titleConfig, setTitleConfig] = useState({
        words: [],
        spacing: '0.5rem',
        casing: 'original',
        alignment: 'center' // 'flex-start', 'center', 'flex-end'
    });

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
                // Cargar configuración de título
                if (user.centro.personalizacion.nameTitleConfig) {
                    setTitleConfig(user.centro.personalizacion.nameTitleConfig);
                } else if (user.centro.nombre) {
                    // Inicializar con el nombre del centro si no hay config
                    const words = user.centro.nombre.split(' ').map(word => ({
                        text: word,
                        color: '#000000' // Color por defecto
                    }));
                    setTitleConfig({
                        words: words,
                        spacing: '0.5rem',
                        casing: 'original',
                        alignment: 'center'
                    });
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

    // Manejadores para configuración de título
    const handleTitleWordColorChange = (index, color) => {
        const newWords = [...titleConfig.words];
        newWords[index].color = color;
        setTitleConfig({ ...titleConfig, words: newWords });
    };

    const handleTitleSpacingChange = (e) => {
        setTitleConfig({ ...titleConfig, spacing: e.target.value });
    };

    const handleTitleCasingChange = (e) => {
        setTitleConfig({ ...titleConfig, casing: e.target.value });
    };

    const handleTitleAlignmentChange = (e) => {
        setTitleConfig({ ...titleConfig, alignment: e.target.value });
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
            // 1. Guardar Configuración de Personalización (incluyendo título)
            const responseConfig = await fetch('https://localhost:9443/api/configuracion/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    ...settings, 
                    savedThemes,
                    nameTitleConfig: titleConfig // Añadir configuración de título
                }),
                credentials: 'include'
            });

            if (!responseConfig.ok) {
                const errorData = await responseConfig.json();
                throw new Error(errorData.message || 'Error al guardar configuración');
            }

            // 2. Guardar Logo (si se ha seleccionado uno y es admin de centro)
            if (canChangeLogo && logoFile) {
                const formData = new FormData();
                
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
                        <h4 className={styles.previewTitle}>Vista Previa General</h4>
                        <div className={styles.previewGeneral}>
                            {/* Header Simulado */}
                            <div className={styles.previewHeader} style={{ backgroundColor: settings.headerFooterColor, color: settings.headerFooterTextColor }}>
                                <span style={{ fontWeight: 'bold' }}>Logo</span>
                                <span>Usuario</span>
                            </div>
                            {/* Body Simulado */}
                            <div className={styles.previewBody}>
                                <div className={styles.previewCard}>
                                    <h3 style={{ color: settings.primaryColor, marginTop: 0 }}>Título Principal</h3>
                                    <p style={{ color: settings.secondaryColor }}>Subtítulo o texto secundario de ejemplo.</p>
                                </div>
                            </div>
                            {/* Footer Simulado */}
                            <div className={styles.previewFooter} style={{ backgroundColor: settings.headerFooterColor, color: settings.headerFooterTextColor }}>
                                Footer
                            </div>
                        </div>
                    </div>
                );
            // ... (Resto de casos igual que antes) ...
            case 'sidebar':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Barra Lateral</h4>
                        <div className={styles.previewSidebar} style={{ backgroundColor: settings.sidebarColor }}>
                            <div className={styles.previewSidebarItem} style={{ color: '#94a3b8' }}>
                                <LayoutIcon size={16} /> Inicio
                            </div>
                            <div className={styles.previewSidebarItem} style={{ backgroundColor: settings.sidebarActiveColor, color: settings.sidebarActiveTextColor }}>
                                <LayoutIcon size={16} /> Perfil (Activo)
                            </div>
                            <div className={styles.previewSidebarItem} style={{ backgroundColor: settings.sidebarHoverColor, color: settings.sidebarHoverTextColor }}>
                                <LayoutIcon size={16} /> Menú (Hover)
                            </div>
                        </div>
                    </div>
                );

            case 'text':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Tipografía</h4>
                        <div className={styles.previewTextContainer}>
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
                        <h4 className={styles.previewTitle}>Vista Previa Botones</h4>
                        <div className={styles.previewButtonsContainer}>
                            <button className={styles.previewButton} style={{ backgroundColor: settings.buttonPrimaryColor, color: settings.buttonPrimaryTextColor }}>
                                Botón Primario
                            </button>
                            <button className={styles.previewButtonSecondary} style={{ backgroundColor: settings.buttonSecondaryColor, color: settings.buttonSecondaryTextColor }}>
                                Botón Secundario
                            </button>
                        </div>
                    </div>
                );

            case 'scrollbar':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Scrollbar</h4>
                        <div className={styles.previewScrollbarContainer}>
                            <div className={styles.previewScrollbarThumb} style={{ backgroundColor: settings.scrollbarThumbColor, width: settings.scrollbarWidth || '12px' }}></div>
                            <div className={styles.previewScrollbarTrack} style={{ backgroundColor: settings.scrollbarTrackColor, width: settings.scrollbarWidth || '12px' }}></div>
                            
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
                        <h4 className={styles.previewTitle}>Vista Previa Calendario</h4>
                        <div className={styles.previewCalendarContainer}>
                            <div className={styles.previewCalendarGrid}>
                                <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                                
                                <span className={styles.previewCalendarDay}>1</span>
                                <span className={styles.previewCalendarDay}>2</span>
                                <span className={styles.previewCalendarDay}>3</span>
                                <span className={styles.previewCalendarDay}>4</span>
                                <span className={styles.previewCalendarDay}>5</span>
                                <span className={styles.previewCalendarWeekend} style={{ backgroundColor: settings.calendarWeekendBgColor, color: settings.calendarWeekendTextColor }}>6</span>
                                <span className={styles.previewCalendarWeekend} style={{ backgroundColor: settings.calendarWeekendBgColor, color: settings.calendarWeekendTextColor }}>7</span>
                                
                                <span className={styles.previewCalendarDay}>8</span>
                                <span className={styles.previewCalendarSelected} style={{ backgroundColor: settings.calendarSelectedBgColor, color: settings.calendarSelectedTextColor }}>9</span>
                                <span className={styles.previewCalendarDay}>10</span>
                            </div>
                        </div>
                    </div>
                );

            case 'timetable':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Horario</h4>
                        <div className={styles.previewTimetableContainer}>
                            {/* Header */}
                            <div className={styles.previewTimetableHeader} style={{ backgroundColor: '#f8fafc' }}>Hora</div>
                            <div className={styles.previewTimetableHeader} style={{ backgroundColor: settings.timetableHeaderBgColor, color: settings.timetableHeaderTextColor }}>Lunes</div>
                            <div className={styles.previewTimetableHeader} style={{ backgroundColor: settings.timetableSelectedHeaderBg, color: settings.timetableSelectedHeaderText }}>Martes (Activo)</div>

                            {/* Row 1 */}
                            <div className={styles.previewTimetableCell} style={{ backgroundColor: settings.timetableHoursBgColor, color: settings.timetableHoursTextColor, textAlign: 'center' }}>08:00</div>
                            <div className={styles.previewTimetableCell} style={{ backgroundColor: '#fff' }}>Clase A</div>
                            <div className={styles.previewTimetableCell} style={{ backgroundColor: settings.timetableSelectedCellBg }}>Clase B</div>
                        </div>
                    </div>
                );

            case 'datatable':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Tabla</h4>
                        <div className={styles.previewDatatableHeader} style={{ backgroundColor: settings.datatableHeaderBgColor, color: settings.datatableHeaderTextColor }}>
                            <span>NOMBRE</span>
                            <span style={{ backgroundColor: settings.datatableHeaderHoverBgColor, color: settings.datatableHeaderHoverTextColor, padding: '2px 5px', borderRadius: '2px' }}>APELLIDOS (Hover)</span>
                            <span style={{ backgroundColor: settings.datatableHeaderActiveBgColor, color: settings.datatableHeaderActiveTextColor, padding: '2px 5px', borderRadius: '2px' }}>EDAD (Activo)</span>
                        </div>
                        
                        {/* Paginación en Tabla */}
                        <div className={styles.previewDatatablePagination} style={{ backgroundColor: settings.datatablePaginationBgColor, color: settings.datatablePaginationTextColor }}>
                            <span>Filas: {settings.itemsPerPageUsuarios || 20}</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonBgColor, color: settings.datatablePaginationButtonTextColor }}>1</div>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonHoverBgColor, color: settings.datatablePaginationButtonHoverTextColor }}>2</div>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonActiveBgColor, color: settings.datatablePaginationButtonActiveTextColor }}>3</div>
                            </div>
                        </div>
                    </div>
                );

            case 'accordion':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Acordeón</h4>
                        <div className={styles.previewAccordionContainer}>
                            <div className={styles.previewAccordionHeader} style={{ backgroundColor: settings.accordionHeaderBgColor, color: settings.accordionHeaderTextColor }}>
                                Cabecera del Acordeón
                            </div>
                            <div className={styles.previewAccordionContent} style={{ backgroundColor: settings.accordionContentBgColor, color: settings.accordionContentTextColor }}>
                                Contenido del acordeón.
                            </div>
                        </div>
                    </div>
                );

            case 'modal':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Modal</h4>
                        <div className={styles.previewModalContainer}>
                            <div className={styles.previewModalHeader} style={{ backgroundColor: settings.modalHeaderBgColor, color: settings.modalHeaderTextColor }}>
                                <span>Título del Modal</span>
                                <div className={styles.previewModalClose} style={{ backgroundColor: settings.modalCloseButtonBgColor, color: settings.modalCloseButtonTextColor }}>✕</div>
                            </div>
                            <div className={styles.previewModalBody} style={{ backgroundColor: settings.modalBodyBgColor, color: settings.modalBodyTextColor }}>
                                <p style={{ margin: 0 }}>Este es el contenido del cuerpo del modal. Aquí irían los formularios o información.</p>
                            </div>
                            <div className={styles.previewModalFooter} style={{ backgroundColor: settings.modalFooterBgColor }}>
                                <button style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '12px' }}>Cancelar</button>
                                <button style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', background: settings.buttonPrimaryColor, color: settings.buttonPrimaryTextColor, fontSize: '12px' }}>Guardar</button>
                            </div>
                        </div>
                    </div>
                );

            case 'title':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Título</h4>
                        <div className={styles.previewTitleContainer} style={{ backgroundColor: settings.headerFooterColor }}>
                            {/* Usamos un componente simulado para la preview */}
                            <div style={{ display: 'flex', gap: titleConfig.spacing, fontSize: '1.5rem', fontWeight: 'bold', alignItems: titleConfig.alignment }}>
                                {titleConfig.words.map((word, index) => {
                                    let text = word.text;
                                    if (titleConfig.casing === 'uppercase') text = text.toUpperCase();
                                    if (titleConfig.casing === 'lowercase') text = text.toLowerCase();
                                    if (titleConfig.casing === 'capitalize') text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
                                    
                                    return (
                                        <span key={index} style={{ color: word.color }}>
                                            {text}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );

            case 'pagination':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Vista Previa Paginación</h4>
                        <div className={styles.previewDatatablePagination} style={{ backgroundColor: settings.datatablePaginationBgColor, color: settings.datatablePaginationTextColor }}>
                            <span>Filas: {settings.itemsPerPageUsuarios || 20}</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonBgColor, color: settings.datatablePaginationButtonTextColor }}>1</div>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonHoverBgColor, color: settings.datatablePaginationButtonHoverTextColor }}>2</div>
                                <div className={styles.previewPaginationButton} style={{ backgroundColor: settings.datatablePaginationButtonActiveBgColor, color: settings.datatablePaginationButtonActiveTextColor }}>3</div>
                            </div>
                        </div>
                    </div>
                );

            case 'themes':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>Resumen de Vistas Previas</h4>
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
        { id: 'title', label: 'Título', icon: <Heading size={18} /> }, // Nueva pestaña
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
                                            <div className={styles.fileInputWrapper}>
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
                                                
                                                {/* Input de archivo personalizado usando Button y ref */}
                                                <div>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleFileChange}
                                                        ref={fileInputRef}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <Button 
                                                        type="button" 
                                                        onClick={() => fileInputRef.current.click()}
                                                        variant="secondary"
                                                    >
                                                        <Upload size={16} style={{ marginRight: '8px' }} />
                                                        Seleccionar archivo
                                                    </Button>
                                                    {logoFile && <span className={styles.fileName} style={{ marginLeft: '10px' }}>{logoFile.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'title' && (
                                <div className={styles.grid}>
                                    <div className={styles.colorItem} style={{ gridColumn: '1 / -1' }}>
                                        <label className={styles.label}>Espaciado entre palabras</label>
                                        <input 
                                            type="text" 
                                            value={titleConfig.spacing} 
                                            onChange={handleTitleSpacingChange}
                                            className={styles.colorTextInput}
                                            placeholder="Ej: 0.5rem, 10px"
                                        />
                                    </div>
                                    
                                    <div className={styles.colorItem} style={{ gridColumn: '1 / -1' }}>
                                        <label className={styles.label}>Capitalización</label>
                                        <select 
                                            value={titleConfig.casing} 
                                            onChange={handleTitleCasingChange}
                                            className={styles.colorTextInput}
                                        >
                                            <option value="original">Original</option>
                                            <option value="uppercase">MAYÚSCULAS</option>
                                            <option value="lowercase">minúsculas</option>
                                            <option value="capitalize">Capitalizado</option>
                                        </select>
                                    </div>

                                    <div className={styles.colorItem} style={{ gridColumn: '1 / -1' }}>
                                        <label className={styles.label}>Alineación Vertical</label>
                                        <select 
                                            value={titleConfig.alignment} 
                                            onChange={handleTitleAlignmentChange}
                                            className={styles.colorTextInput}
                                        >
                                            <option value="flex-start">Arriba</option>
                                            <option value="center">Centro</option>
                                            <option value="flex-end">Abajo</option>
                                        </select>
                                    </div>

                                    <div className={styles.titleWordsContainer} style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                        <label className={styles.label} style={{ marginBottom: '0.5rem', display: 'block' }}>Colores por palabra</label>
                                        <div className={styles.titleWordsContainer}>
                                            {titleConfig.words.map((word, index) => (
                                                <div key={index} className={styles.titleWordRow}>
                                                    <span className={styles.titleWordText}>{word.text}</span>
                                                    <input 
                                                        type="color" 
                                                        value={word.color} 
                                                        onChange={(e) => handleTitleWordColorChange(index, e.target.value)}
                                                        className={styles.colorInput}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={word.color} 
                                                        onChange={(e) => handleTitleWordColorChange(index, e.target.value)}
                                                        className={`${styles.colorTextInput} ${styles.titleWordInput}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
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
