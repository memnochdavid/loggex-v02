import React, {useState, useEffect, useRef} from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import {useAuth} from '../context/AuthContext';
import {applyTheme} from '../utils/theme';
import styles from './Configuracion.module.css';
import {
    Save,
    RotateCcw,
    Palette,
    Layout as LayoutIcon,
    Type,
    MousePointer,
    Scroll,
    Calendar,
    Clock,
    Table,
    List,
    Layers,
    Trash2,
    Check,
    Maximize,
    Image as ImageIcon,
    Heading,
    Upload,
    MessageSquare,
    User,
    Bell,
    Grid
} from 'lucide-react';
import NameTitle from '../components/NameTitle';
import {getApiUrl, getAssetUrl} from '../config/api';
import CrudHeader from '../components/CrudHeader';
import Lottie from 'lottie-react';
import configAnimation from '../../public/config.json';
import { useTranslation } from 'react-i18next';

// Importar tema por defecto desde la nueva ubicación
import {DEFAULT_THEME} from '../config/themeDefaults';
import helloAnimation from "../../public/hello.json";

const Configuracion = () => {
    const { t } = useTranslation();
    const {user, checkAuth} = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');

    const canChangeLogo = isAdmin && !isSuperAdmin && user?.centro;

    const defaultSettings = DEFAULT_THEME;

    const [settings, setSettings] = useState(defaultSettings);
    const [themes, setThemes] = useState([]); // Lista unificada de temas
    const [newThemeName, setNewThemeName] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const fileInputRef = useRef(null);

    const [titleConfig, setTitleConfig] = useState({
        words: [],
        spacing: '0.5rem',
        casing: 'original',
        alignment: 'center'
    });

    // Cargar configuración inicial
    useEffect(() => {
        if (user) {
            let initialSettings = {...defaultSettings};

            const mergeSettings = (source) => {
                Object.keys(source).forEach(key => {
                    if (source[key] !== null && source[key] !== undefined) {
                        initialSettings[key] = source[key];
                    }
                });
            };

            if (user.centro && user.centro.personalizacion) {
                mergeSettings(user.centro.personalizacion);

                if (user.centro.logo) {
                    setLogoPreview(getAssetUrl(`/uploads/logo-centro/${user.centro.logo}`));
                }
                if (user.centro.personalizacion.nameTitleConfig) {
                    setTitleConfig(user.centro.personalizacion.nameTitleConfig);
                } else if (user.centro.nombre) {
                    const words = user.centro.nombre.split(' ').map(word => ({
                        text: word,
                        color: '#000000'
                    }));
                    setTitleConfig({
                        words: words,
                        spacing: '0.5rem',
                        casing: 'original',
                        alignment: 'center'
                    });
                }
            } else if (isSuperAdmin && user.centro && user.centro.id === 'global' && user.centro.personalizacion) {
                mergeSettings(user.centro.personalizacion);
            }

            setSettings(initialSettings);
        }
    }, [user, isSuperAdmin]);

    // Cargar temas desde API
    const fetchThemes = async () => {
        try {
            const response = await fetch(getApiUrl('/api/temas?pagination=false'), {
                headers: {'Accept': 'application/ld+json'},
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];
                setThemes(items);
            }
        } catch (error) {
            console.error("Error cargando temas:", error);
        }
    };

    useEffect(() => {
        fetchThemes();
    }, []);

    useEffect(() => {
        applyTheme(settings);
    }, [settings]);

    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value)
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

    const handleTitleWordColorChange = (index, color) => {
        const newWords = [...titleConfig.words];
        newWords[index].color = color;
        setTitleConfig({...titleConfig, words: newWords});
    };

    const handleTitleSpacingChange = (e) => {
        setTitleConfig({...titleConfig, spacing: e.target.value});
    };

    const handleTitleCasingChange = (e) => {
        setTitleConfig({...titleConfig, casing: e.target.value});
    };

    const handleTitleAlignmentChange = (e) => {
        setTitleConfig({...titleConfig, alignment: e.target.value});
    };

    const handleReset = () => {
        setSettings(defaultSettings);
        applyTheme(defaultSettings);
    };

    const handleSaveTheme = async () => {
        if (!newThemeName.trim()) return;

        try {
            const themeSettings = {};
            Object.keys(settings).forEach(key => {
                if (settings[key] !== null && settings[key] !== undefined) {
                    themeSettings[key] = settings[key];
                }
            });

            const payload = {
                nombre: newThemeName,
                configuracion: themeSettings,
                esPredefinido: false,
                centro: user.centro ? `/api/centros/${user.centro.id}` : null
            };

            const response = await fetch(getApiUrl('/api/temas'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/ld+json',
                    'Accept': 'application/ld+json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (response.ok) {
                setNewThemeName('');
                fetchThemes();
                setMessage({type: 'success', text: t('config.themeSaved')});
                setTimeout(() => setMessage(null), 3000);
            } else {
                throw new Error(t('config.themeErrorSaveGeneric'));
            }
        } catch (error) {
            console.error(error);
            setMessage({type: 'error', text: t('config.themeErrorSave')});
        }
    };

    const handleLoadTheme = (theme) => {
        if (!theme || !theme.configuracion) return;
        const newSettings = {...defaultSettings, ...theme.configuracion};
        setSettings(newSettings);
    };

    const handleDeleteTheme = async (theme) => {
        if (!window.confirm(t('config.themeDeleteConfirm', { name: theme.nombre }))) return;

        try {
            const response = await fetch(getApiUrl(`/api/temas/${theme.id}`), {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                fetchThemes();
                setMessage({type: 'success', text: t('config.themeDeleted')});
                setTimeout(() => setMessage(null), 3000);
            } else {
                throw new Error(t('config.themeErrorDeleteGeneric'));
            }
        } catch (error) {
            console.error(error);
            setMessage({type: 'error', text: t('config.themeErrorDelete')});
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const responseConfig = await fetch(getApiUrl('/api/configuracion/update'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...settings,
                    nameTitleConfig: titleConfig
                }),
                credentials: 'include'
            });

            if (!responseConfig.ok) {
                const errorData = await responseConfig.json();
                throw new Error(errorData.message || t('config.errorSavingMsg'));
            }

            if (canChangeLogo && logoFile) {
                const formData = new FormData();

                const centroRes = await fetch(getApiUrl(`/api/centros/${user.centro.id}`), {
                    headers: {'Accept': 'application/ld+json'},
                    credentials: 'include'
                });
                const centroData = await centroRes.json();

                formData.append('nombre', centroData.nombre);
                formData.append('cif', centroData.cif);
                formData.append('direccion', centroData.direccion);
                if (centroData.telefono) formData.append('telefono', centroData.telefono);
                formData.append('activo', centroData.activo ? 'true' : 'false');
                formData.append('logo', logoFile);

                const responseLogo = await fetch(getApiUrl(`/api/centro/${user.centro.id}/update`), {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!responseLogo.ok) {
                    throw new Error(t('config.errorUploadLogo'));
                }
            }

            setMessage({type: 'success', text: t('config.saved')});
            await checkAuth();

        } catch (error) {
            setMessage({type: 'error', text: error.message || t('config.errorConnection')});
        } finally {
            setLoading(false);
        }
    };

    if (!user || (!user.centro && !isSuperAdmin)) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.card}>
                        <p>{t('config.noAccess')}</p>
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
                className={styles.colorTextInput}
                min="1"
                max="100"
            />
        </div>
    );

    const renderThemeCard = (theme) => {
        const themeSettings = theme.configuracion || {};
        const displaySettings = {...defaultSettings, ...themeSettings};

        return (
            <div key={theme.id} className={styles.themeCard}>
                <div className={styles.themePreview} style={{backgroundColor: displaySettings.sidebarColor}}>
                    <div className={styles.themeHeader}
                         style={{backgroundColor: displaySettings.headerFooterColor}}></div>
                    <div className={styles.themeBody}>
                        <div className={styles.themeSidebar}
                             style={{backgroundColor: displaySettings.sidebarColor}}></div>
                        <div className={styles.themeContent}>
                            <div className={styles.themeButton}
                                 style={{backgroundColor: displaySettings.primaryColor}}></div>
                        </div>
                    </div>
                </div>
                <div className={styles.themeInfo}>
                    <span className={styles.themeName}>{theme.nombre}</span>
                    <div className={styles.themeActions}>
                        <button
                            className={styles.iconButton}
                            onClick={() => handleLoadTheme(theme)}
                            title={t('config.applyTheme')}
                        >
                            <Check size={16}/>
                        </button>
                        {!theme.esPredefinido && (
                            <button
                                className={`${styles.iconButton} ${styles.deleteButton}`}
                                onClick={() => handleDeleteTheme(theme)}
                                title={t('config.deleteTheme')}
                            >
                                <Trash2 size={16}/>
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
                        <div className={styles.previewGeneral}>
                            <div className={styles.previewHeader} style={{
                                backgroundColor: settings.headerFooterColor,
                                color: settings.headerFooterTextColor
                            }}>
                                <span style={{fontWeight: 'bold'}}>{t('config.previewTexts.logo')}</span>
                                <span>{t('config.previewTexts.user')}</span>
                            </div>
                            <div className={styles.previewBody} style={{backgroundColor: settings.viewBackgroundColor}}>
                                <div className={styles.previewCard} style={{borderRadius: settings.borderRadius}}>
                                    <h3 style={{color: settings.primaryColor, marginTop: 0}}>{t('config.previewTexts.mainTitle')}</h3>
                                    <p style={{color: settings.secondaryColor}}>{t('config.previewTexts.subtitleExample')}</p>
                                </div>
                            </div>
                            <div className={styles.previewFooter} style={{
                                backgroundColor: settings.headerFooterColor,
                                color: settings.headerFooterTextColor
                            }}>
                                {t('config.previewTexts.footer')}
                            </div>
                        </div>
                    </div>
                );
            case 'sidebar':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewSidebar} style={{backgroundColor: settings.sidebarColor}}>
                            <div className={styles.previewSidebarItem} style={{color: '#94a3b8'}}>
                                <LayoutIcon size={16}/> {t('config.previewTexts.home')}
                            </div>
                            <div style={{margin: '10px 0'}}>
                                <div style={{
                                    backgroundColor: settings.sidebarAccordionHeaderBgColor,
                                    color: settings.sidebarAccordionHeaderTextColor,
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}>
                                    {t('config.previewTexts.admin')}
                                </div>
                                <div style={{
                                    backgroundColor: settings.sidebarAccordionContentBgColor,
                                    color: settings.sidebarAccordionContentTextColor,
                                    padding: '8px',
                                    fontSize: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '5px'
                                }}>
                                    <div>{t('config.previewTexts.users')}</div>
                                    <div>{t('config.previewTexts.groups')}</div>
                                </div>
                            </div>

                            <div className={styles.previewSidebarItem} style={{
                                backgroundColor: settings.sidebarActiveColor,
                                color: settings.sidebarActiveTextColor
                            }}>
                                <LayoutIcon size={16}/> {t('config.previewTexts.profileActive')}
                            </div>
                            <div className={styles.previewSidebarItem} style={{
                                backgroundColor: settings.sidebarHoverColor,
                                color: settings.sidebarHoverTextColor
                            }}>
                                <LayoutIcon size={16}/> {t('config.previewTexts.menuHover')}
                            </div>
                        </div>
                    </div>
                );
            case 'chat':
                return (
                    <div className={styles.previewBox}>
                        <div style={{
                            display: 'flex',
                            height: '200px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '120px',
                                backgroundColor: settings.chatSidebarBgColor,
                                borderRight: '1px solid #e2e8f0'
                            }}>
                                <div style={{
                                    padding: '10px',
                                    backgroundColor: settings.chatItemActiveBgColor,
                                    borderLeft: `3px solid ${settings.chatItemActiveBorderColor}`,
                                    color: settings.chatItemTextMainColor
                                }}>
                                    <div style={{fontWeight: 'bold', fontSize: '12px'}}>{t('config.previewTexts.activeUser')}</div>
                                    <div style={{fontSize: '10px', color: settings.chatItemTextSecondaryColor}}>{t('config.previewTexts.lastMessage')}
                                    </div>
                                </div>
                                <div style={{padding: '10px', color: settings.chatItemTextMainColor}}>
                                    <div style={{fontWeight: 'bold', fontSize: '12px'}}>{t('config.previewTexts.otherUser')}</div>
                                    <div
                                        style={{fontSize: '10px', color: settings.chatItemTextSecondaryColor}}>{t('config.previewTexts.hello')}
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: settings.chatContainerBgColor
                            }}>
                                <div style={{
                                    padding: '10px',
                                    backgroundColor: settings.chatHeaderBgColor,
                                    color: settings.chatHeaderTextColor,
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}>
                                    {t('config.previewTexts.activeUser')}
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{
                                        alignSelf: 'flex-start',
                                        backgroundColor: settings.chatBubbleReceivedBgColor,
                                        color: settings.chatBubbleReceivedTextColor,
                                        padding: '8px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        {t('config.previewTexts.helloQuestion')}
                                    </div>
                                    <div style={{
                                        alignSelf: 'flex-end',
                                        backgroundColor: settings.chatBubbleSentBgColor,
                                        color: settings.chatBubbleSentTextColor,
                                        padding: '8px',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}>
                                        {t('config.previewTexts.allGood')}
                                    </div>
                                </div>
                                <div style={{padding: '5px', backgroundColor: settings.chatInputAreaBgColor}}>
                                    <input type="text" placeholder={t('config.previewTexts.writePlaceholder')} style={{
                                        width: '100%',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}/>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'usercard':
                return (
                    <div className={styles.previewBox}>
                        <div style={{
                            width: '200px',
                            backgroundColor: settings.userCardBgColor,
                            color: settings.userCardTextColor,
                            borderRadius: '8px',
                            padding: '20px',
                            textAlign: 'center',
                            margin: '0 auto'
                        }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                margin: '0 auto 10px auto'
                            }}></div>
                            <div style={{fontWeight: 'bold', marginBottom: '5px'}}>{t('config.previewTexts.userName')}</div>
                            <div style={{
                                fontSize: '12px',
                                color: settings.userCardTextSecondaryColor,
                                marginBottom: '15px'
                            }}>{t('config.previewTexts.emailExample')}
                            </div>
                            <button style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: settings.buttonPrimaryColor,
                                color: settings.buttonPrimaryTextColor,
                                fontSize: '12px'
                            }}>
                                {t('config.previewTexts.sendMessage')}
                            </button>
                        </div>
                    </div>
                );
            case 'text':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewTextContainer}>
                            <h1 style={{color: settings.textMainColor, margin: '0 0 10px 0'}}>{t('config.previewTexts.mainHeading')}</h1>
                            <p style={{color: settings.textMainColor, lineHeight: '1.5'}}>
                                {t('config.previewTexts.normalParagraph')}
                            </p>
                            <p style={{color: settings.textSecondaryColor, fontSize: '0.9em'}}>
                                {t('config.previewTexts.secondaryParagraph')}
                            </p>
                            <p style={{
                                color: settings.specialTextColor,
                                fontSize: '1.1em',
                                fontWeight: 'bold',
                                background: '#334155',
                                padding: '5px',
                                borderRadius: '4px'
                            }}>
                                {t('config.previewTexts.specialParagraph')}
                            </p>
                        </div>
                    </div>
                );

            case 'buttons':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewButtonsContainer}>
                            <button className={styles.previewButton} style={{
                                backgroundColor: settings.buttonPrimaryColor,
                                color: settings.buttonPrimaryTextColor
                            }}>
                                {t('config.previewTexts.primaryButton')}
                            </button>
                            <button className={styles.previewButtonSecondary} style={{
                                backgroundColor: settings.buttonSecondaryColor,
                                color: settings.buttonSecondaryTextColor
                            }}>
                                {t('config.previewTexts.secondaryButton')}
                            </button>
                        </div>
                    </div>
                );

            case 'scrollbar':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewScrollbarContainer}>
                            <div className={styles.previewScrollbarThumb} style={{
                                backgroundColor: settings.scrollbarThumbColor,
                                width: settings.scrollbarWidth || '12px'
                            }}></div>
                            <div className={styles.previewScrollbarTrack} style={{
                                backgroundColor: settings.scrollbarTrackColor,
                                width: settings.scrollbarWidth || '12px'
                            }}></div>

                            <p style={{margin: 0, fontSize: '12px', color: '#94a3b8'}}>
                                {t('config.previewTexts.scrollbarNote')}
                                <br/><br/>Lorem ipsum dolor sit amet...
                            </p>
                        </div>
                    </div>
                );

            case 'calendar':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewCalendarContainer}>
                            <div className={styles.previewCalendarGrid}>
                                <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>

                                <span className={styles.previewCalendarDay}>1</span>
                                <span className={styles.previewCalendarDay}>2</span>
                                <span className={styles.previewCalendarDay}>3</span>
                                <span className={styles.previewCalendarDay}>4</span>
                                <span className={styles.previewCalendarDay}>5</span>
                                <span className={styles.previewCalendarWeekend} style={{
                                    backgroundColor: settings.calendarWeekendBgColor,
                                    color: settings.calendarWeekendTextColor
                                }}>6</span>
                                <span className={styles.previewCalendarWeekend} style={{
                                    backgroundColor: settings.calendarWeekendBgColor,
                                    color: settings.calendarWeekendTextColor
                                }}>7</span>

                                <span className={styles.previewCalendarDay}>8</span>
                                <span className={styles.previewCalendarSelected} style={{
                                    backgroundColor: settings.calendarSelectedBgColor,
                                    color: settings.calendarSelectedTextColor
                                }}>9</span>
                                <span className={styles.previewCalendarDay}>10</span>
                            </div>
                        </div>
                    </div>
                );

            case 'timetable':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewTimetableContainer}>
                            {/* Header */}
                            <div className={styles.previewTimetableHeader} style={{backgroundColor: '#f8fafc'}}>{t('config.previewTexts.hour')}
                            </div>
                            <div className={styles.previewTimetableHeader} style={{
                                backgroundColor: settings.timetableHeaderBgColor,
                                color: settings.timetableHeaderTextColor
                            }}>{t('config.previewTexts.monday')}
                            </div>
                            <div className={styles.previewTimetableHeader} style={{
                                backgroundColor: settings.timetableSelectedHeaderBg,
                                color: settings.timetableSelectedHeaderText
                            }}>{t('config.previewTexts.tuesdayActive')}
                            </div>

                            {/* Row 1 */}
                            <div className={styles.previewTimetableCell} style={{
                                backgroundColor: settings.timetableHoursBgColor,
                                color: settings.timetableHoursTextColor,
                                textAlign: 'center'
                            }}>08:00
                            </div>
                            <div className={styles.previewTimetableCell} style={{backgroundColor: '#fff'}}>{t('config.previewTexts.classA')}</div>
                            <div className={styles.previewTimetableCell}
                                 style={{backgroundColor: settings.timetableSelectedCellBg}}>{t('config.previewTexts.classB')}
                            </div>
                        </div>
                    </div>
                );

            case 'datatable':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewDatatableHeader} style={{
                            backgroundColor: settings.datatableHeaderBgColor,
                            color: settings.datatableHeaderTextColor
                        }}>
                            <span>{t('config.previewTexts.nameCol')}</span>
                            <span style={{
                                backgroundColor: settings.datatableHeaderHoverBgColor,
                                color: settings.datatableHeaderHoverTextColor,
                                padding: '2px 5px',
                                borderRadius: '2px'
                            }}>{t('config.previewTexts.surnameHover')}</span>
                            <span style={{
                                backgroundColor: settings.datatableHeaderActiveBgColor,
                                color: settings.datatableHeaderActiveTextColor,
                                padding: '2px 5px',
                                borderRadius: '2px'
                            }}>{t('config.previewTexts.ageActive')}</span>
                        </div>

                        <div className={styles.previewDatatablePagination} style={{
                            backgroundColor: settings.datatablePaginationBgColor,
                            color: settings.datatablePaginationTextColor
                        }}>
                            <span>{t('config.previewTexts.rows')} {settings.itemsPerPageUsuarios || 20}</span>
                            <div style={{display: 'flex', gap: '5px'}}>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonBgColor,
                                    color: settings.datatablePaginationButtonTextColor
                                }}>1
                                </div>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonHoverBgColor,
                                    color: settings.datatablePaginationButtonHoverTextColor
                                }}>2
                                </div>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonActiveBgColor,
                                    color: settings.datatablePaginationButtonActiveTextColor
                                }}>3
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'accordion':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewAccordionContainer}>
                            {/* Ejemplo de ítem inactivo */}
                            <div className={styles.previewAccordionHeader} style={{
                                backgroundColor: settings.accordionHeaderBgColor,
                                color: settings.accordionHeaderTextColor,
                                borderBottom: '1px solid #e2e8f0'
                            }}>
                                {t('config.previewTexts.inactiveHeader')}
                            </div>
                            
                            {/* Ejemplo de ítem activo */}
                            <div className={styles.previewAccordionHeader} style={{
                                backgroundColor: settings.accordionHeaderActiveBgColor,
                                color: settings.accordionHeaderActiveTextColor
                            }}>
                                {t('config.previewTexts.activeHeader')}
                            </div>
                            <div className={styles.previewAccordionContent} style={{
                                backgroundColor: settings.accordionContentBgColor,
                                color: settings.accordionContentTextColor
                            }}>
                                {t('config.previewTexts.accordionContent')}
                            </div>
                        </div>
                    </div>
                );

            case 'modal':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewModalContainer}>
                            <div className={styles.previewModalHeader} style={{
                                backgroundColor: settings.modalHeaderBgColor,
                                color: settings.modalHeaderTextColor
                            }}>
                                <span>{t('config.previewTexts.modalTitle')}</span>
                                <div className={styles.previewModalClose} style={{
                                    backgroundColor: settings.modalCloseButtonBgColor,
                                    color: settings.modalCloseButtonTextColor
                                }}>✕
                                </div>
                            </div>
                            <div className={styles.previewModalBody} style={{
                                backgroundColor: settings.modalBodyBgColor,
                                color: settings.modalBodyTextColor
                            }}>
                                <p style={{margin: 0}}>{t('config.previewTexts.modalBody')}</p>
                            </div>
                            <div className={styles.previewModalFooter}
                                 style={{backgroundColor: settings.modalFooterBgColor}}>
                                <button style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    background: 'white',
                                    fontSize: '12px'
                                }}>{t('config.previewTexts.cancel')}
                                </button>
                                <button style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: settings.buttonPrimaryColor,
                                    color: settings.buttonPrimaryTextColor,
                                    fontSize: '12px'
                                }}>{t('config.previewTexts.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'title':
                return (
                    <div className={styles.previewBox}>
                        <div className={styles.previewTitleContainer}
                             style={{backgroundColor: settings.headerFooterColor}}>
                            <div style={{
                                display: 'flex',
                                gap: titleConfig.spacing,
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                alignItems: titleConfig.alignment
                            }}>
                                {titleConfig.words.map((word, index) => {
                                    let text = word.text;
                                    if (titleConfig.casing === 'uppercase') text = text.toUpperCase();
                                    if (titleConfig.casing === 'lowercase') text = text.toLowerCase();
                                    if (titleConfig.casing === 'capitalize') text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

                                    return (
                                        <span key={index} style={{color: word.color}}>
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
                        <div className={styles.previewDatatablePagination} style={{
                            backgroundColor: settings.datatablePaginationBgColor,
                            color: settings.datatablePaginationTextColor
                        }}>
                            <span>{t('config.previewTexts.rows')} {settings.itemsPerPageUsuarios || 20}</span>
                            <div style={{display: 'flex', gap: '5px'}}>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonBgColor,
                                    color: settings.datatablePaginationButtonTextColor
                                }}>1
                                </div>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonHoverBgColor,
                                    color: settings.datatablePaginationButtonHoverTextColor
                                }}>2
                                </div>
                                <div className={styles.previewPaginationButton} style={{
                                    backgroundColor: settings.datatablePaginationButtonActiveBgColor,
                                    color: settings.datatablePaginationButtonActiveTextColor
                                }}>3
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'eventos':
                return (
                    <div className={styles.previewBox}>
                        <div style={{
                            padding: '1rem',
                            backgroundColor: settings.eventCardBgColor,
                            border: `1px solid ${settings.eventCardBorderColor}`,
                            borderLeft: `4px solid ${settings.primaryColor}`,
                            borderRadius: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{
                                fontWeight: '600',
                                color: settings.eventCardTitleColor,
                                marginBottom: '0.25rem'
                            }}>
                                {t('config.previewTexts.eventTitle')}
                            </div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: settings.eventCardMetaColor,
                                display: 'flex',
                                gap: '0.5rem'
                            }}>
                                <span>📅 {t('config.previewTexts.eventDate')}</span>
                                <span>⏰ {t('config.previewTexts.eventTime')}</span>
                            </div>
                        </div>
                        <div style={{marginTop: '1rem'}}>
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: settings.eventsSidebarTitleColor,
                                borderBottom: '1px solid #e2e8f0',
                                paddingBottom: '0.5rem'
                            }}>
                                {t('config.previewTexts.sidebarTitle')}
                            </h3>
                        </div>
                    </div>
                );

            case 'widgets':
                return (
                    <div className={styles.previewBox}>
                        <div style={{
                            backgroundColor: settings.widgetBgColor,
                            border: `1px solid ${settings.widgetBorderColor}`,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: '300px',
                            margin: '0 auto'
                        }}>
                            <div style={{
                                padding: '1rem',
                                borderBottom: `1px solid ${settings.widgetBorderColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: settings.widgetHeaderBgColor
                            }}>
                                <Bell size={20} color={settings.widgetIconColor}/>
                                <h3 style={{
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    margin: 0,
                                    color: settings.widgetHeaderTextColor
                                }}>
                                    {t('config.previewTexts.widgetTitle')}
                                </h3>
                            </div>
                            <div style={{padding: '0'}}>
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: `1px solid ${settings.widgetBorderColor}`,
                                    color: settings.widgetItemTextColor
                                }}>
                                    {t('config.previewTexts.element1')}
                                </div>
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: `1px solid ${settings.widgetBorderColor}`,
                                    backgroundColor: settings.widgetItemHoverBgColor,
                                    color: settings.widgetItemTextColor
                                }}>
                                    {t('config.previewTexts.element2Hover')}
                                </div>
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    color: settings.widgetItemTextColor
                                }}>
                                    {t('config.previewTexts.element3')}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'themes':
                return (
                    <div className={styles.previewBox}>
                        <h4 className={styles.previewTitle}>{t('config.previewSummary')}</h4>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>

                            {/* Resumen General */}
                            <div>
                                <h5 style={{fontSize: '11px', color: '#94a3b8', marginBottom: '5px'}}>{t('config.previewTexts.summaryGeneral')}</h5>
                                <div style={{border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden'}}>
                                    <div style={{
                                        backgroundColor: settings.headerFooterColor,
                                        color: settings.headerFooterTextColor,
                                        padding: '5px 10px',
                                        fontSize: '10px'
                                    }}>{t('config.previewTexts.header')}
                                    </div>
                                    <div style={{padding: '10px', backgroundColor: '#f8fafc'}}>
                                        <h3 style={{
                                            color: settings.primaryColor,
                                            margin: 0,
                                            fontSize: '14px'
                                        }}>{t('config.previewTexts.title')}</h3>
                                        <p style={{
                                            color: settings.secondaryColor,
                                            fontSize: '10px',
                                            margin: 0
                                        }}>{t('config.previewTexts.subtitle')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Sidebar */}
                            <div>
                                <h5 style={{fontSize: '11px', color: '#94a3b8', marginBottom: '5px'}}>{t('config.previewTexts.summarySidebar')}</h5>
                                <div style={{
                                    backgroundColor: settings.sidebarColor,
                                    borderRadius: '6px',
                                    padding: '5px'
                                }}>
                                    <div style={{
                                        padding: '5px',
                                        borderRadius: '4px',
                                        backgroundColor: settings.sidebarActiveColor,
                                        color: settings.sidebarActiveTextColor,
                                        fontSize: '10px'
                                    }}>{t('config.previewTexts.active')}
                                    </div>
                                    <div style={{
                                        padding: '5px',
                                        borderRadius: '4px',
                                        backgroundColor: settings.sidebarHoverColor,
                                        color: settings.sidebarHoverTextColor,
                                        fontSize: '10px',
                                        marginTop: '2px'
                                    }}>{t('config.previewTexts.hover')}
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Botones */}
                            <div>
                                <h5 style={{fontSize: '11px', color: '#94a3b8', marginBottom: '5px'}}>{t('config.previewTexts.summaryButtons')}</h5>
                                <div style={{display: 'flex', gap: '5px'}}>
                                    <button style={{
                                        backgroundColor: settings.buttonPrimaryColor,
                                        color: settings.buttonPrimaryTextColor,
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '10px'
                                    }}>{t('config.previewTexts.primary')}
                                    </button>
                                    <button style={{
                                        backgroundColor: settings.buttonSecondaryColor,
                                        color: settings.buttonSecondaryTextColor,
                                        border: '1px solid #ccc',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '10px'
                                    }}>{t('config.previewTexts.secondary')}
                                    </button>
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
        {id: 'general', label: t('config.tabs.general'), icon: <Palette size={18}/>},
        {id: 'title', label: t('config.tabs.title'), icon: <Heading size={18}/>},
        {id: 'sidebar', label: t('config.tabs.sidebar'), icon: <LayoutIcon size={18}/>},
        {id: 'text', label: t('config.tabs.text'), icon: <Type size={18}/>},
        {id: 'buttons', label: t('config.tabs.buttons'), icon: <MousePointer size={18}/>},
        {id: 'chat', label: t('config.tabs.chat'), icon: <MessageSquare size={18}/>},
        {id: 'usercard', label: t('config.tabs.usercard'), icon: <User size={18}/>},
        {id: 'eventos', label: t('config.tabs.eventos'), icon: <Bell size={18}/>},
        {id: 'widgets', label: t('config.tabs.widgets'), icon: <Grid size={18}/>},
        {id: 'scrollbar', label: t('config.tabs.scrollbar'), icon: <Scroll size={18}/>},
        {id: 'calendar', label: t('config.tabs.calendar'), icon: <Calendar size={18}/>},
        {id: 'timetable', label: t('config.tabs.timetable'), icon: <Clock size={18}/>},
        {id: 'datatable', label: t('config.tabs.datatable'), icon: <Table size={18}/>},
        {id: 'accordion', label: t('config.tabs.accordion'), icon: <Layers size={18}/>},
        {id: 'modal', label: t('config.tabs.modal'), icon: <Maximize size={18}/>},
        {id: 'pagination', label: t('config.tabs.pagination'), icon: <List size={18}/>},
        {id: 'themes', label: t('config.tabs.themes'), icon: <Palette size={18}/>},
    ];

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader
                    title={t('config.title')}
                    subtitle={user.centro && user.centro.id !== 'global' ? t('config.subtitleCenter', { centerName: user.centro.nombre }) : t('config.subtitleGlobal')
                    }
                    logo={<Lottie animationData={configAnimation} loop={true} style={{width: 60, height: 60}}/>}>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleReset}
                    >
                        <RotateCcw size={18} style={{marginRight: '8px'}}/>
                        {t('config.reset')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        <Save size={18} style={{marginRight: '8px'}}/>
                        {loading ? t('config.saving') : t('config.save')}
                    </Button>
                </CrudHeader>

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
                    </div>

                    <div className={styles.content}>
                        <div className={styles.formSection}>
                            {activeTab === 'general' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.general.primaryColor'), 'primaryColor')}
                                    {renderColorInput(t('config.general.secondaryColor'), 'secondaryColor')}
                                    {renderColorInput(t('config.general.headerFooterBg'), 'headerFooterColor')}
                                    {renderColorInput(t('config.general.headerFooterText'), 'headerFooterTextColor')}
                                    {renderColorInput(t('config.general.viewBg'), 'viewBackgroundColor')}

                                    <div className={styles.colorItem}>
                                        <label className={styles.label}>{t('config.general.borderRadius')}</label>
                                        <select
                                            name="borderRadius"
                                            value={settings.borderRadius || '0.5rem'}
                                            onChange={handleChange}
                                            className={styles.colorTextInput}
                                        >
                                            <option value="0">{t('config.general.borderSquare')}</option>
                                            <option value="0.25rem">{t('config.general.borderSmall')}</option>
                                            <option value="0.5rem">{t('config.general.borderMedium')}</option>
                                            <option value="0.75rem">{t('config.general.borderLarge')}</option>
                                            <option value="1rem">{t('config.general.borderXLarge')}</option>
                                            <option value="1.5rem">{t('config.general.borderXXLarge')}</option>
                                        </select>
                                    </div>

                                    <div className={styles.colorItem} style={{flexDirection: 'row', alignItems: 'center', gap: '10px'}}>
                                        <input
                                            type="checkbox"
                                            name="showLottie"
                                            checked={settings.showLottie !== false}
                                            onChange={handleChange}
                                            id="showLottie"
                                            style={{width: '20px', height: '20px'}}
                                        />
                                        <label htmlFor="showLottie" className={styles.label} style={{cursor: 'pointer'}}>
                                            {t('config.general.showLottie')}
                                        </label>
                                    </div>

                                    <div className={styles.colorItem} style={{flexDirection: 'row', alignItems: 'center', gap: '10px'}}>
                                        <input
                                            type="checkbox"
                                            name="enableDraggableModal"
                                            checked={settings.enableDraggableModal !== false}
                                            onChange={handleChange}
                                            id="enableDraggableModal"
                                            style={{width: '20px', height: '20px'}}
                                        />
                                        <label htmlFor="enableDraggableModal" className={styles.label} style={{cursor: 'pointer'}}>
                                            {t('config.general.enableDraggable')}
                                        </label>
                                    </div>

                                    <div className={styles.colorItem} style={{flexDirection: 'row', alignItems: 'center', gap: '10px'}}>
                                        <input
                                            type="checkbox"
                                            name="showAnimatedBackground"
                                            checked={!!settings.showAnimatedBackground}
                                            onChange={handleChange}
                                            id="showAnimatedBackground"
                                            style={{width: '20px', height: '20px'}}
                                        />
                                        <label htmlFor="showAnimatedBackground" className={styles.label} style={{cursor: 'pointer'}}>
                                            {t('config.general.showAnimatedBackground')}
                                        </label>
                                    </div>

                                    {canChangeLogo && (
                                        <div className={styles.colorItem} style={{gridColumn: '1 / -1'}}>
                                            <label className={styles.label}>{t('config.general.centerLogo')}</label>
                                            <div className={styles.fileInputWrapper}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo" style={{
                                                        width: '64px',
                                                        height: '64px',
                                                        objectFit: 'contain',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        padding: '4px',
                                                        backgroundColor: 'white'
                                                    }}/>
                                                ) : (
                                                    <div style={{
                                                        width: '64px',
                                                        height: '64px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#f8fafc'
                                                    }}>
                                                        <ImageIcon size={24} color="#cbd5e1"/>
                                                    </div>
                                                )}

                                                <div>
                                                    <input type="file" accept="image/*" onChange={handleFileChange}
                                                           ref={fileInputRef} style={{display: 'none'}}/>
                                                    <Button type="button" onClick={() => fileInputRef.current.click()}
                                                            variant="secondary">
                                                        <Upload size={16} style={{marginRight: '8px'}}/>
                                                        {t('config.general.changeLogo')}
                                                    </Button>
                                                    {logoFile && <span className={styles.fileName}
                                                                       style={{marginLeft: '10px'}}>{logoFile.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'title' && (
                                <div className={styles.grid}>
                                    <div className={styles.colorItem} style={{gridColumn: '1 / -1'}}>
                                        <label className={styles.label}>{t('config.titleTab.wordSpacing')}</label>
                                        <input type="text" value={titleConfig.spacing}
                                               onChange={handleTitleSpacingChange} className={styles.colorTextInput}
                                               placeholder={t('config.titleTab.spacingPlaceholder')}/>
                                    </div>
                                    <div className={styles.colorItem} style={{gridColumn: '1 / -1'}}>
                                        <label className={styles.label}>{t('config.titleTab.casing')}</label>
                                        <select value={titleConfig.casing} onChange={handleTitleCasingChange}
                                                className={styles.colorTextInput}>
                                            <option value="original">{t('config.titleTab.casingOriginal')}</option>
                                            <option value="uppercase">{t('config.titleTab.casingUppercase')}</option>
                                            <option value="lowercase">{t('config.titleTab.casingLowercase')}</option>
                                            <option value="capitalize">{t('config.titleTab.casingCapitalize')}</option>
                                        </select>
                                    </div>
                                    <div className={styles.colorItem} style={{gridColumn: '1 / -1'}}>
                                        <label className={styles.label}>{t('config.titleTab.alignment')}</label>
                                        <select value={titleConfig.alignment} onChange={handleTitleAlignmentChange}
                                                className={styles.colorTextInput}>
                                            <option value="flex-start">{t('config.titleTab.alignTop')}</option>
                                            <option value="center">{t('config.titleTab.alignCenter')}</option>
                                            <option value="flex-end">{t('config.titleTab.alignBottom')}</option>
                                        </select>
                                    </div>
                                    <div className={styles.titleWordsContainer}
                                         style={{gridColumn: '1 / -1', marginTop: '1rem'}}>
                                        <label className={styles.label}
                                               style={{marginBottom: '0.5rem', display: 'block'}}>{t('config.titleTab.wordColors')}</label>
                                        <div className={styles.titleWordsContainer}>
                                            {titleConfig.words.map((word, index) => (
                                                <div key={index} className={styles.titleWordRow}>
                                                    <span className={styles.titleWordText}>{word.text}</span>
                                                    <input type="color" value={word.color}
                                                           onChange={(e) => handleTitleWordColorChange(index, e.target.value)}
                                                           className={styles.colorInput}/>
                                                    <input type="text" value={word.color}
                                                           onChange={(e) => handleTitleWordColorChange(index, e.target.value)}
                                                           className={`${styles.colorTextInput} ${styles.titleWordInput}`}/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'sidebar' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.sidebarTab.bg'), 'sidebarColor')}
                                    {renderColorInput(t('config.sidebarTab.activeBg'), 'sidebarActiveColor')}
                                    {renderColorInput(t('config.sidebarTab.activeText'), 'sidebarActiveTextColor')}
                                    {renderColorInput(t('config.sidebarTab.hoverBg'), 'sidebarHoverColor')}
                                    {renderColorInput(t('config.sidebarTab.hoverText'), 'sidebarHoverTextColor')}

                                    {/* Nuevos campos para el acordeón del sidebar */}
                                    <div style={{
                                        gridColumn: '1 / -1',
                                        marginTop: '10px',
                                        marginBottom: '5px',
                                        fontWeight: 'bold',
                                        color: '#64748b'
                                    }}>{t('config.sidebarTab.accordionSection')}
                                    </div>
                                    {renderColorInput(t('config.sidebarTab.accordionHeaderBg'), 'sidebarAccordionHeaderBgColor')}
                                    {renderColorInput(t('config.sidebarTab.accordionHeaderText'), 'sidebarAccordionHeaderTextColor')}
                                    {renderColorInput(t('config.sidebarTab.accordionContentBg'), 'sidebarAccordionContentBgColor')}
                                    {renderColorInput(t('config.sidebarTab.accordionContentText'), 'sidebarAccordionContentTextColor')}
                                </div>
                            )}

                            {activeTab === 'text' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.textTab.mainColor'), 'textMainColor')}
                                    {renderColorInput(t('config.textTab.secondaryColor'), 'textSecondaryColor')}
                                    {renderColorInput(t('config.textTab.specialColor'), 'specialTextColor')}
                                </div>
                            )}

                            {activeTab === 'buttons' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.buttonsTab.primaryBg'), 'buttonPrimaryColor')}
                                    {renderColorInput(t('config.buttonsTab.primaryText'), 'buttonPrimaryTextColor')}
                                    {renderColorInput(t('config.buttonsTab.secondaryBg'), 'buttonSecondaryColor')}
                                    {renderColorInput(t('config.buttonsTab.secondaryText'), 'buttonSecondaryTextColor')}
                                </div>
                            )}

                            {activeTab === 'chat' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.chatTab.sidebarBg'), 'chatSidebarBgColor')}
                                    {renderColorInput(t('config.chatTab.itemHoverBg'), 'chatItemHoverBgColor')}
                                    {renderColorInput(t('config.chatTab.itemActiveBg'), 'chatItemActiveBgColor')}
                                    {renderColorInput(t('config.chatTab.itemActiveBorder'), 'chatItemActiveBorderColor')}
                                    {renderColorInput(t('config.chatTab.itemTextMain'), 'chatItemTextMainColor')}
                                    {renderColorInput(t('config.chatTab.itemTextSecondary'), 'chatItemTextSecondaryColor')}
                                    {renderColorInput(t('config.chatTab.badgeBg'), 'chatBadgeBgColor')}
                                    {renderColorInput(t('config.chatTab.badgeText'), 'chatBadgeTextColor')}

                                    {renderColorInput(t('config.chatTab.headerBg'), 'chatHeaderBgColor')}
                                    {renderColorInput(t('config.chatTab.headerText'), 'chatHeaderTextColor')}
                                    {renderColorInput(t('config.chatTab.containerBg'), 'chatContainerBgColor')}
                                    {renderColorInput(t('config.chatTab.inputAreaBg'), 'chatInputAreaBgColor')}
                                    {renderColorInput(t('config.chatTab.sentBg'), 'chatBubbleSentBgColor')}
                                    {renderColorInput(t('config.chatTab.sentText'), 'chatBubbleSentTextColor')}
                                    {renderColorInput(t('config.chatTab.receivedBg'), 'chatBubbleReceivedBgColor')}
                                    {renderColorInput(t('config.chatTab.receivedText'), 'chatBubbleReceivedTextColor')}
                                </div>
                            )}

                            {activeTab === 'usercard' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.usercardTab.bg'), 'userCardBgColor')}
                                    {renderColorInput(t('config.usercardTab.text'), 'userCardTextColor')}
                                    {renderColorInput(t('config.usercardTab.textSecondary'), 'userCardTextSecondaryColor')}
                                </div>
                            )}

                            {activeTab === 'eventos' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.eventosTab.cardBg'), 'eventCardBgColor')}
                                    {renderColorInput(t('config.eventosTab.cardBorder'), 'eventCardBorderColor')}
                                    {renderColorInput(t('config.eventosTab.cardTitle'), 'eventCardTitleColor')}
                                    {renderColorInput(t('config.eventosTab.cardMeta'), 'eventCardMetaColor')}
                                    {renderColorInput(t('config.eventosTab.sidebarBg'), 'eventsSidebarBgColor')}
                                    {renderColorInput(t('config.eventosTab.sidebarTitle'), 'eventsSidebarTitleColor')}
                                </div>
                            )}

                            {activeTab === 'widgets' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.widgetsTab.bg'), 'widgetBgColor')}
                                    {renderColorInput(t('config.widgetsTab.border'), 'widgetBorderColor')}
                                    {renderColorInput(t('config.widgetsTab.headerBg'), 'widgetHeaderBgColor')}
                                    {renderColorInput(t('config.widgetsTab.headerText'), 'widgetHeaderTextColor')}
                                    {renderColorInput(t('config.widgetsTab.iconColor'), 'widgetIconColor')}
                                    {renderColorInput(t('config.widgetsTab.itemText'), 'widgetItemTextColor')}
                                    {renderColorInput(t('config.widgetsTab.itemHoverBg'), 'widgetItemHoverBgColor')}
                                </div>
                            )}

                            {activeTab === 'scrollbar' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.scrollbarTab.thumb'), 'scrollbarThumbColor')}
                                    {renderColorInput(t('config.scrollbarTab.track'), 'scrollbarTrackColor')}
                                    {renderColorInput(t('config.scrollbarTab.hover'), 'scrollbarHoverColor')}
                                </div>
                            )}

                            {activeTab === 'calendar' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.calendarTab.selectedBg'), 'calendarSelectedBgColor')}
                                    {renderColorInput(t('config.calendarTab.selectedText'), 'calendarSelectedTextColor')}
                                    {renderColorInput(t('config.calendarTab.weekendBg'), 'calendarWeekendBgColor')}
                                    {renderColorInput(t('config.calendarTab.weekendText'), 'calendarWeekendTextColor')}
                                </div>
                            )}

                            {activeTab === 'timetable' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.timetableTab.headerBg'), 'timetableHeaderBgColor')}
                                    {renderColorInput(t('config.timetableTab.headerText'), 'timetableHeaderTextColor')}
                                    {renderColorInput(t('config.timetableTab.hoursBg'), 'timetableHoursBgColor')}
                                    {renderColorInput(t('config.timetableTab.hoursText'), 'timetableHoursTextColor')}
                                    {renderColorInput(t('config.timetableTab.selectedHeaderBg'), 'timetableSelectedHeaderBg')}
                                    {renderColorInput(t('config.timetableTab.selectedHeaderText'), 'timetableSelectedHeaderText')}
                                    {renderColorInput(t('config.timetableTab.selectedCellBg'), 'timetableSelectedCellBg')}
                                </div>
                            )}

                            {activeTab === 'datatable' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.datatableTab.headerBg'), 'datatableHeaderBgColor')}
                                    {renderColorInput(t('config.datatableTab.headerText'), 'datatableHeaderTextColor')}
                                    {renderColorInput(t('config.datatableTab.headerHoverBg'), 'datatableHeaderHoverBgColor')}
                                    {renderColorInput(t('config.datatableTab.headerHoverText'), 'datatableHeaderHoverTextColor')}
                                    {renderColorInput(t('config.datatableTab.headerActiveBg'), 'datatableHeaderActiveBgColor')}
                                    {renderColorInput(t('config.datatableTab.headerActiveText'), 'datatableHeaderActiveTextColor')}

                                    {renderColorInput(t('config.datatableTab.paginationBg'), 'datatablePaginationBgColor')}
                                    {renderColorInput(t('config.datatableTab.paginationText'), 'datatablePaginationTextColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonBg'), 'datatablePaginationButtonBgColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonText'), 'datatablePaginationButtonTextColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonHoverBg'), 'datatablePaginationButtonHoverBgColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonHoverText'), 'datatablePaginationButtonHoverTextColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonActiveBg'), 'datatablePaginationButtonActiveBgColor')}
                                    {renderColorInput(t('config.datatableTab.paginationButtonActiveText'), 'datatablePaginationButtonActiveTextColor')}
                                </div>
                            )}

                            {activeTab === 'accordion' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.accordionTab.headerBg'), 'accordionHeaderBgColor')}
                                    {renderColorInput(t('config.accordionTab.headerText'), 'accordionHeaderTextColor')}
                                    {renderColorInput(t('config.accordionTab.headerActiveBg'), 'accordionHeaderActiveBgColor')}
                                    {renderColorInput(t('config.accordionTab.headerActiveText'), 'accordionHeaderActiveTextColor')}
                                    {renderColorInput(t('config.accordionTab.contentBg'), 'accordionContentBgColor')}
                                    {renderColorInput(t('config.accordionTab.contentText'), 'accordionContentTextColor')}
                                </div>
                            )}

                            {activeTab === 'modal' && (
                                <div className={styles.grid}>
                                    {renderColorInput(t('config.modalTab.headerBg'), 'modalHeaderBgColor')}
                                    {renderColorInput(t('config.modalTab.headerText'), 'modalHeaderTextColor')}
                                    {renderColorInput(t('config.modalTab.bodyBg'), 'modalBodyBgColor')}
                                    {renderColorInput(t('config.modalTab.bodyText'), 'modalBodyTextColor')}
                                    {renderColorInput(t('config.modalTab.footerBg'), 'modalFooterBgColor')}

                                    {renderColorInput(t('config.modalTab.closeBg'), 'modalCloseButtonBgColor')}
                                    {renderColorInput(t('config.modalTab.closeText'), 'modalCloseButtonTextColor')}
                                    {renderColorInput(t('config.modalTab.closeHoverBg'), 'modalCloseButtonHoverBgColor')}
                                    {renderColorInput(t('config.modalTab.closeHoverText'), 'modalCloseButtonHoverTextColor')}
                                </div>
                            )}

                            {activeTab === 'pagination' && (
                                <div className={styles.grid}>
                                    {renderNumberInput(t('config.paginationTab.usersPerPage'), 'itemsPerPageUsuarios')}
                                    {renderNumberInput(t('config.paginationTab.centersPerPage'), 'itemsPerPageCentros')}
                                    {renderNumberInput(t('config.paginationTab.cyclesPerPage'), 'itemsPerPageCiclos')}
                                    {renderNumberInput(t('config.paginationTab.groupsPerPage'), 'itemsPerPageGrupos')}
                                    {renderNumberInput(t('config.paginationTab.modulesPerPage'), 'itemsPerPageModulos')}
                                    {renderNumberInput(t('config.paginationTab.enrollmentsPerPage'), 'itemsPerPageMatriculas')}
                                    {renderNumberInput(t('config.paginationTab.teachingPerPage'), 'itemsPerPageImparticiones')}
                                    {renderNumberInput(t('config.paginationTab.schedulesPerPage'), 'itemsPerPageHorarios')}
                                </div>
                            )}

                            {activeTab === 'themes' && (
                                <div className={styles.themesContainer}>
                                    <div className={styles.addTheme}>
                                        <input
                                            type="text"
                                            value={newThemeName}
                                            onChange={(e) => setNewThemeName(e.target.value)}
                                            placeholder={t('config.themePlaceholder')}
                                            className={styles.colorTextInput}
                                            style={{flex: 1}}
                                        />
                                        <Button onClick={handleSaveTheme} disabled={!newThemeName.trim()}>
                                            {t('config.addTheme')}
                                        </Button>
                                    </div>

                                    <h4 className={styles.sectionTitle}>{t('config.availableThemes')}</h4>
                                    <div className={styles.themesGrid}>
                                        {themes.map((theme) => renderThemeCard(theme))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.previewContainer}>
                            <h3 className={styles.previewTitle}>{t('config.preview')}</h3>
                            {renderPreview()}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Configuracion;
