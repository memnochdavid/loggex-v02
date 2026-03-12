# GUÍA i18n — Configuracion.jsx (EXCLUSIVA)

Lee primero `GUIA_I18N_GEMINI.md` para las reglas generales. Este documento es el complemento específico para `frontend/src/pages/Configuracion.jsx`.

## CONTEXTO

`Configuracion.jsx` tiene ~1550 líneas. Es la página de personalización visual del centro (colores, tipografía, temas, etc.). Tiene cientos de textos hardcodeados en español.

Las claves i18n para este archivo están en el bloque `config.*` de los JSON de traducción (`es.json` / `en.json`). **Ya se han añadido todas las claves necesarias**. NO necesitas tocar los JSON.

---

## PASO 1: Imports y hook

Añade el import junto a los demás imports del archivo:

```javascript
import { useTranslation } from 'react-i18next';
```

Añade el hook como PRIMERA línea dentro del componente `Configuracion`:

```javascript
const Configuracion = () => {
    const { t } = useTranslation();  // <-- AÑADIR AQUÍ
    const {user, checkAuth} = useAuth();
    // ...resto sin cambios
```

---

## PASO 2: Mapeo COMPLETO de reemplazos

A continuación tienes CADA texto hardcodeado y su reemplazo EXACTO. Sigue el orden del archivo de arriba a abajo.

### ZONA: Mensajes en funciones JS (~líneas 178-306)

```
BUSCA:  setMessage({type: 'success', text: 'Tema guardado correctamente'});
CAMBIA: setMessage({type: 'success', text: t('config.themeSaved')});

BUSCA:  throw new Error('Error al guardar el tema');
CAMBIA: throw new Error(t('config.themeErrorSaveGeneric'));

BUSCA:  setMessage({type: 'error', text: 'No se pudo guardar el tema'});
CAMBIA: setMessage({type: 'error', text: t('config.themeErrorSave')});

BUSCA:  if (!window.confirm(`¿Eliminar el tema "${theme.nombre}"?`)) return;
CAMBIA: if (!window.confirm(t('config.themeDeleteConfirm', { name: theme.nombre }))) return;

BUSCA:  setMessage({type: 'success', text: 'Tema eliminado'});
CAMBIA: setMessage({type: 'success', text: t('config.themeDeleted')});

BUSCA:  throw new Error('Error al eliminar');
CAMBIA: throw new Error(t('config.themeErrorDeleteGeneric'));

BUSCA:  setMessage({type: 'error', text: 'No se pudo eliminar el tema'});
CAMBIA: setMessage({type: 'error', text: t('config.themeErrorDelete')});

BUSCA:  throw new Error(errorData.message || 'Error al guardar configuración');
CAMBIA: throw new Error(errorData.message || t('config.errorSavingMsg'));

BUSCA:  throw new Error('Error al subir el logo');
CAMBIA: throw new Error(t('config.errorUploadLogo'));

BUSCA:  setMessage({type: 'success', text: 'Configuración guardada correctamente'});
CAMBIA: setMessage({type: 'success', text: t('config.saved')});

BUSCA:  setMessage({type: 'error', text: error.message || 'Error de conexión'});
CAMBIA: setMessage({type: 'error', text: error.message || t('config.errorConnection')});
```

### ZONA: Mensaje de no acceso (~línea 313)

```
BUSCA:  <p>Esta configuración solo está disponible para usuarios asignados a un centro o administradores
            globales.</p>
CAMBIA: <p>{t('config.noAccess')}</p>
```

### ZONA: renderThemeCard (~líneas 380-395)

```
BUSCA:  title="Aplicar Tema"
CAMBIA: title={t('config.applyTheme')}

BUSCA:  title="Eliminar Tema"
CAMBIA: title={t('config.deleteTheme')}
```

### ZONA: renderPreview — case 'general' (~líneas 405-430)

```
BUSCA:  <span style={{fontWeight: 'bold'}}>Logo</span>
CAMBIA: <span style={{fontWeight: 'bold'}}>{t('config.previewTexts.logo')}</span>

BUSCA:  <span>Usuario</span>
CAMBIA: <span>{t('config.previewTexts.user')}</span>

BUSCA:  <h3 style={{color: settings.primaryColor, marginTop: 0}}>Título Principal</h3>
CAMBIA: <h3 style={{color: settings.primaryColor, marginTop: 0}}>{t('config.previewTexts.mainTitle')}</h3>

BUSCA:  <p style={{color: settings.secondaryColor}}>Subtítulo o texto secundario de
            ejemplo.</p>
CAMBIA: <p style={{color: settings.secondaryColor}}>{t('config.previewTexts.subtitleExample')}</p>

BUSCA:  Footer
CAMBIA: {t('config.previewTexts.footer')}
```
(El "Footer" está dentro de un div con previewFooter class)

### ZONA: renderPreview — case 'sidebar' (~líneas 431-477)

```
BUSCA:  <LayoutIcon size={16}/> Inicio
CAMBIA: <LayoutIcon size={16}/> {t('config.previewTexts.home')}

BUSCA:  Administración
CAMBIA: {t('config.previewTexts.admin')}

(el div con "Administración" texto, dentro del accordion preview del sidebar)

BUSCA:  <div>Usuarios</div>
CAMBIA: <div>{t('config.previewTexts.users')}</div>

BUSCA:  <div>Grupos</div>
CAMBIA: <div>{t('config.previewTexts.groups')}</div>

BUSCA:  <LayoutIcon size={16}/> Perfil (Activo)
CAMBIA: <LayoutIcon size={16}/> {t('config.previewTexts.profileActive')}

BUSCA:  <LayoutIcon size={16}/> Menú (Hover)
CAMBIA: <LayoutIcon size={16}/> {t('config.previewTexts.menuHover')}
```

### ZONA: renderPreview — case 'chat' (~líneas 478-566)

```
BUSCA:  <div style={{fontWeight: 'bold', fontSize: '12px'}}>Usuario Activo</div>
CAMBIA: <div style={{fontWeight: 'bold', fontSize: '12px'}}>{t('config.previewTexts.activeUser')}</div>

(Hay DOS "Usuario Activo" — uno en sidebar izq, otro en el header del chat. Ambos se cambian igual.)

BUSCA:  mensaje...
(dentro de: <div style={{fontSize: '10px'...}}>Último mensaje...</div>)
El texto completo es "Último\n                                        mensaje..."
CAMBIA: {t('config.previewTexts.lastMessage')}

BUSCA:  <div style={{fontWeight: 'bold', fontSize: '12px'}}>Otro Usuario</div>
CAMBIA: <div style={{fontWeight: 'bold', fontSize: '12px'}}>{t('config.previewTexts.otherUser')}</div>

BUSCA:  style={{fontSize: '10px', color: settings.chatItemTextSecondaryColor}}>Hola...
CAMBIA: style={{fontSize: '10px', color: settings.chatItemTextSecondaryColor}}>{t('config.previewTexts.hello')}

BUSCA:  Hola, ¿qué tal?
CAMBIA: {t('config.previewTexts.helloQuestion')}

BUSCA:  ¡Todo bien!
CAMBIA: {t('config.previewTexts.allGood')}

BUSCA:  placeholder="Escribe..."
CAMBIA: placeholder={t('config.previewTexts.writePlaceholder')}
```

**CUIDADO con "Último\nmensaje..."**: está partido en dos líneas en el JSX. Reemplaza TODO el contenido de texto de ese div por `{t('config.previewTexts.lastMessage')}`.

### ZONA: renderPreview — case 'usercard' (~líneas 567-606)

```
BUSCA:  <div style={{fontWeight: 'bold', marginBottom: '5px'}}>Nombre Usuario</div>
CAMBIA: <div style={{fontWeight: 'bold', marginBottom: '5px'}}>{t('config.previewTexts.userName')}</div>

BUSCA:  email@ejemplo.com
(dentro del div con userCardTextSecondaryColor)
CAMBIA: {t('config.previewTexts.emailExample')}

BUSCA:  Enviar Mensaje
(dentro del button con buttonPrimaryColor)
CAMBIA: {t('config.previewTexts.sendMessage')}
```

### ZONA: renderPreview — case 'text' (~líneas 607-632)

```
BUSCA:  <h1 style={{color: settings.textMainColor, margin: '0 0 10px 0'}}>Encabezado Principal</h1>
CAMBIA: <h1 style={{color: settings.textMainColor, margin: '0 0 10px 0'}}>{t('config.previewTexts.mainHeading')}</h1>

BUSCA:  Este es un párrafo de texto normal utilizando el color principal configurado.
            Sirve para leer contenido extenso de forma cómoda.
CAMBIA: {t('config.previewTexts.normalParagraph')}

BUSCA:  Este es un texto secundario o "muted", usado para metadatos, fechas o descripciones
            menos importantes.
CAMBIA: {t('config.previewTexts.secondaryParagraph')}

BUSCA:  Este es el texto especial, para cabeceras de perfil, etc.
CAMBIA: {t('config.previewTexts.specialParagraph')}
```

### ZONA: renderPreview — case 'buttons' (~líneas 634-652)

```
BUSCA:  Botón Primario
CAMBIA: {t('config.previewTexts.primaryButton')}

BUSCA:  Botón Secundario
CAMBIA: {t('config.previewTexts.secondaryButton')}
```

### ZONA: renderPreview — case 'scrollbar' (~líneas 654-674)

```
BUSCA:  (Nota: El estilo real del scrollbar se aplica a toda la página. Esta es una
            representación de los colores).
CAMBIA: {t('config.previewTexts.scrollbarNote')}
```
(Solo la nota entre paréntesis. El "Lorem ipsum..." NO se traduce.)

### ZONA: renderPreview — case 'timetable' (~líneas 708-739)

```
BUSCA:  >Hora
(dentro del previewTimetableHeader)
CAMBIA: >{t('config.previewTexts.hour')}

BUSCA:  >Lunes
CAMBIA: >{t('config.previewTexts.monday')}

BUSCA:  >Martes (Activo)
CAMBIA: >{t('config.previewTexts.tuesdayActive')}

BUSCA:  >Clase A</div>
CAMBIA: >{t('config.previewTexts.classA')}</div>

BUSCA:  >Clase B
CAMBIA: >{t('config.previewTexts.classB')}
```

### ZONA: renderPreview — case 'datatable' (~líneas 741-787)

```
BUSCA:  <span>NOMBRE</span>
CAMBIA: <span>{t('config.previewTexts.nameCol')}</span>

BUSCA:  >APELLIDOS (Hover)</span>
CAMBIA: >{t('config.previewTexts.surnameHover')}</span>

BUSCA:  >EDAD (Activo)</span>
CAMBIA: >{t('config.previewTexts.ageActive')}</span>

BUSCA:  <span>Filas: {settings.itemsPerPageUsuarios || 20}</span>
CAMBIA: <span>{t('config.previewTexts.rows')} {settings.itemsPerPageUsuarios || 20}</span>
```
(Hay DOS bloques con "Filas:" — uno en case 'datatable' y otro en case 'pagination'. Cambia ambos.)

### ZONA: renderPreview — case 'accordion' (~líneas 789-817)

```
BUSCA:  Cabecera Inactiva
CAMBIA: {t('config.previewTexts.inactiveHeader')}

BUSCA:  Cabecera Activa
CAMBIA: {t('config.previewTexts.activeHeader')}

BUSCA:  Contenido del acordeón activo.
CAMBIA: {t('config.previewTexts.accordionContent')}
```

### ZONA: renderPreview — case 'modal' (~líneas 819-863)

```
BUSCA:  <span>Título del Modal</span>
CAMBIA: <span>{t('config.previewTexts.modalTitle')}</span>

BUSCA:  Este es el contenido del cuerpo del modal. Aquí irían los
            formularios o información.
CAMBIA: {t('config.previewTexts.modalBody')}

BUSCA:  >Cancelar
(en el botón con border: '1px solid #ccc')
CAMBIA: >{t('config.previewTexts.cancel')}

BUSCA:  >Guardar
(en el botón con background: settings.buttonPrimaryColor)
CAMBIA: >{t('config.previewTexts.save')}
```

### ZONA: renderPreview — case 'eventos' (~líneas 923-963)

```
BUSCA:  Título del Evento
CAMBIA: {t('config.previewTexts.eventTitle')}

BUSCA:  <span>📅 Fecha</span>
CAMBIA: <span>📅 {t('config.previewTexts.eventDate')}</span>

BUSCA:  <span>⏰ Hora</span>
CAMBIA: <span>⏰ {t('config.previewTexts.eventTime')}</span>

BUSCA:  Título Sidebar
CAMBIA: {t('config.previewTexts.sidebarTitle')}
```

### ZONA: renderPreview — case 'widgets' (~líneas 965-1020)

```
BUSCA:  Título Widget
CAMBIA: {t('config.previewTexts.widgetTitle')}

BUSCA:  Elemento 1
CAMBIA: {t('config.previewTexts.element1')}

BUSCA:  Elemento 2 (Hover)
CAMBIA: {t('config.previewTexts.element2Hover')}

BUSCA:  Elemento 3
CAMBIA: {t('config.previewTexts.element3')}
```

### ZONA: renderPreview — case 'themes' (resumen, ~líneas 1022-1109)

```
BUSCA:  <h4 className={styles.previewTitle}>Resumen de Vistas Previas</h4>
CAMBIA: <h4 className={styles.previewTitle}>{t('config.previewSummary')}</h4>

BUSCA:  <h5 ...>General</h5>  (el primero, bajo "Resumen General")
CAMBIA: <h5 ...>{t('config.previewTexts.summaryGeneral')}</h5>

BUSCA:  >Header
(dentro del div con headerFooterColor, fontSize '10px')
CAMBIA: >{t('config.previewTexts.header')}

BUSCA:  >Título</h3>  (el h3 con primaryColor, fontSize '14px')
CAMBIA: >{t('config.previewTexts.title')}</h3>

BUSCA:  >Subtítulo</p>
CAMBIA: >{t('config.previewTexts.subtitle')}</p>

BUSCA:  <h5 ...>Sidebar</h5>
CAMBIA: <h5 ...>{t('config.previewTexts.summarySidebar')}</h5>

BUSCA:  >Activo  (el div con sidebarActiveColor)
CAMBIA: >{t('config.previewTexts.active')}

BUSCA:  >Hover  (el div con sidebarHoverColor)
CAMBIA: >{t('config.previewTexts.hover')}

BUSCA:  <h5 ...>Botones</h5>
CAMBIA: <h5 ...>{t('config.previewTexts.summaryButtons')}</h5>

BUSCA:  >Primario  (el button con buttonPrimaryColor)
CAMBIA: >{t('config.previewTexts.primary')}

BUSCA:  >Secundario  (el button con buttonSecondaryColor)
CAMBIA: >{t('config.previewTexts.secondary')}
```

### ZONA: Array `tabs` (~líneas 1116-1134)

Este array está DENTRO del componente, así que `t()` es accesible. Reemplaza TODO el array:

```javascript
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
```

### ZONA: CrudHeader (~líneas 1139-1158)

```
BUSCA:  title="Personalización"
CAMBIA: title={t('config.title')}

BUSCA:  subtitle={user.centro && user.centro.id !== 'global' ? `Ajusta la apariencia para ${user.centro.nombre}` : 'Ajusta la apariencia global del sistema'
CAMBIA: subtitle={user.centro && user.centro.id !== 'global' ? t('config.subtitleCenter', { centerName: user.centro.nombre }) : t('config.subtitleGlobal')

BUSCA:  Restablecer
(dentro del Button con variant="secondary")
CAMBIA: {t('config.reset')}

BUSCA:  {loading ? 'Guardando...' : 'Guardar'}
CAMBIA: {loading ? t('config.saving') : t('config.save')}
```

### ZONA: Vista Previa título (~línea 1538)

```
BUSCA:  <h3 className={styles.previewTitle}>Vista Previa</h3>
CAMBIA: <h3 className={styles.previewTitle}>{t('config.preview')}</h3>
```

### ZONA: Tab general — renderColorInput labels (~líneas 1183-1280)

```
BUSCA:  {renderColorInput('Color Principal', 'primaryColor')}
CAMBIA: {renderColorInput(t('config.general.primaryColor'), 'primaryColor')}

BUSCA:  {renderColorInput('Color Secundario', 'secondaryColor')}
CAMBIA: {renderColorInput(t('config.general.secondaryColor'), 'secondaryColor')}

BUSCA:  {renderColorInput('Fondo Header/Footer', 'headerFooterColor')}
CAMBIA: {renderColorInput(t('config.general.headerFooterBg'), 'headerFooterColor')}

BUSCA:  {renderColorInput('Texto Header/Footer', 'headerFooterTextColor')}
CAMBIA: {renderColorInput(t('config.general.headerFooterText'), 'headerFooterTextColor')}

BUSCA:  {renderColorInput('Fondo de Vistas', 'viewBackgroundColor')}
CAMBIA: {renderColorInput(t('config.general.viewBg'), 'viewBackgroundColor')}

BUSCA:  <label className={styles.label}>Forma de Elementos (Border Radius)</label>
CAMBIA: <label className={styles.label}>{t('config.general.borderRadius')}</label>

BUSCA:  <option value="0">Cuadrado (0px)</option>
CAMBIA: <option value="0">{t('config.general.borderSquare')}</option>

BUSCA:  <option value="0.25rem">Pequeño (4px)</option>
CAMBIA: <option value="0.25rem">{t('config.general.borderSmall')}</option>

BUSCA:  <option value="0.5rem">Mediano (8px)</option>
CAMBIA: <option value="0.5rem">{t('config.general.borderMedium')}</option>

BUSCA:  <option value="0.75rem">Grande (12px)</option>
CAMBIA: <option value="0.75rem">{t('config.general.borderLarge')}</option>

BUSCA:  <option value="1rem">Muy Grande (16px)</option>
CAMBIA: <option value="1rem">{t('config.general.borderXLarge')}</option>

BUSCA:  <option value="1.5rem">Extra Grande (24px)</option>
CAMBIA: <option value="1.5rem">{t('config.general.borderXXLarge')}</option>

BUSCA:  Mostrar animaciones Lottie en cabeceras
CAMBIA: {t('config.general.showLottie')}

BUSCA:  Habilitar arrastre de modales (Draggable)
CAMBIA: {t('config.general.enableDraggable')}

BUSCA:  <label className={styles.label}>Logo del Centro</label>
CAMBIA: <label className={styles.label}>{t('config.general.centerLogo')}</label>

BUSCA:  Cambiar
(dentro del Button con Upload icon, ~línea 1271)
CAMBIA: {t('config.general.changeLogo')}
```

### ZONA: Tab title (~líneas 1282-1329)

```
BUSCA:  <label className={styles.label}>Espaciado entre palabras</label>
CAMBIA: <label className={styles.label}>{t('config.titleTab.wordSpacing')}</label>

BUSCA:  placeholder="Ej: 0.5rem, 10px"
CAMBIA: placeholder={t('config.titleTab.spacingPlaceholder')}

BUSCA:  <label className={styles.label}>Capitalización</label>
CAMBIA: <label className={styles.label}>{t('config.titleTab.casing')}</label>

BUSCA:  <option value="original">Original</option>
CAMBIA: <option value="original">{t('config.titleTab.casingOriginal')}</option>

BUSCA:  <option value="uppercase">MAYÚSCULAS</option>
CAMBIA: <option value="uppercase">{t('config.titleTab.casingUppercase')}</option>

BUSCA:  <option value="lowercase">minúsculas</option>
CAMBIA: <option value="lowercase">{t('config.titleTab.casingLowercase')}</option>

BUSCA:  <option value="capitalize">Capitalizado</option>
CAMBIA: <option value="capitalize">{t('config.titleTab.casingCapitalize')}</option>

BUSCA:  <label className={styles.label}>Alineación Vertical</label>
CAMBIA: <label className={styles.label}>{t('config.titleTab.alignment')}</label>

BUSCA:  <option value="flex-start">Arriba</option>
CAMBIA: <option value="flex-start">{t('config.titleTab.alignTop')}</option>

BUSCA:  <option value="center">Centro</option>
CAMBIA: <option value="center">{t('config.titleTab.alignCenter')}</option>

BUSCA:  <option value="flex-end">Abajo</option>
CAMBIA: <option value="flex-end">{t('config.titleTab.alignBottom')}</option>

BUSCA:  >Colores por
            palabra</label>
CAMBIA: >{t('config.titleTab.wordColors')}</label>
```

### ZONA: Tab sidebar (~líneas 1331-1353)

```
BUSCA:  {renderColorInput('Fondo Barra Lateral', 'sidebarColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.bg'), 'sidebarColor')}

BUSCA:  {renderColorInput('Fondo Elemento Activo', 'sidebarActiveColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.activeBg'), 'sidebarActiveColor')}

BUSCA:  {renderColorInput('Texto Elemento Activo', 'sidebarActiveTextColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.activeText'), 'sidebarActiveTextColor')}

BUSCA:  {renderColorInput('Fondo Hover', 'sidebarHoverColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.hoverBg'), 'sidebarHoverColor')}

BUSCA:  {renderColorInput('Texto Hover', 'sidebarHoverTextColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.hoverText'), 'sidebarHoverTextColor')}

BUSCA:  >Acordeón Sidebar
CAMBIA: >{t('config.sidebarTab.accordionSection')}

BUSCA:  {renderColorInput('Fondo Cabecera Acordeón', 'sidebarAccordionHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.accordionHeaderBg'), 'sidebarAccordionHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera Acordeón', 'sidebarAccordionHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.accordionHeaderText'), 'sidebarAccordionHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Contenido Acordeón', 'sidebarAccordionContentBgColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.accordionContentBg'), 'sidebarAccordionContentBgColor')}

BUSCA:  {renderColorInput('Texto Contenido Acordeón', 'sidebarAccordionContentTextColor')}
CAMBIA: {renderColorInput(t('config.sidebarTab.accordionContentText'), 'sidebarAccordionContentTextColor')}
```

### ZONA: Tab text (~líneas 1355-1361)

```
BUSCA:  {renderColorInput('Texto Principal', 'textMainColor')}
CAMBIA: {renderColorInput(t('config.textTab.mainColor'), 'textMainColor')}

BUSCA:  {renderColorInput('Texto Secundario', 'textSecondaryColor')}
CAMBIA: {renderColorInput(t('config.textTab.secondaryColor'), 'textSecondaryColor')}

BUSCA:  {renderColorInput('Texto Especial (Cabeceras)', 'specialTextColor')}
CAMBIA: {renderColorInput(t('config.textTab.specialColor'), 'specialTextColor')}
```

### ZONA: Tab buttons (~líneas 1363-1370)

```
BUSCA:  {renderColorInput('Fondo Botón Primario', 'buttonPrimaryColor')}
CAMBIA: {renderColorInput(t('config.buttonsTab.primaryBg'), 'buttonPrimaryColor')}

BUSCA:  {renderColorInput('Texto Botón Primario', 'buttonPrimaryTextColor')}
CAMBIA: {renderColorInput(t('config.buttonsTab.primaryText'), 'buttonPrimaryTextColor')}

BUSCA:  {renderColorInput('Fondo Botón Secundario', 'buttonSecondaryColor')}
CAMBIA: {renderColorInput(t('config.buttonsTab.secondaryBg'), 'buttonSecondaryColor')}

BUSCA:  {renderColorInput('Texto Botón Secundario', 'buttonSecondaryTextColor')}
CAMBIA: {renderColorInput(t('config.buttonsTab.secondaryText'), 'buttonSecondaryTextColor')}
```

### ZONA: Tab chat (~líneas 1372-1391)

```
BUSCA:  {renderColorInput('Fondo Sidebar Chat', 'chatSidebarBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.sidebarBg'), 'chatSidebarBgColor')}

BUSCA:  {renderColorInput('Fondo Item Hover', 'chatItemHoverBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.itemHoverBg'), 'chatItemHoverBgColor')}

BUSCA:  {renderColorInput('Fondo Item Activo', 'chatItemActiveBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.itemActiveBg'), 'chatItemActiveBgColor')}

BUSCA:  {renderColorInput('Borde Item Activo', 'chatItemActiveBorderColor')}
CAMBIA: {renderColorInput(t('config.chatTab.itemActiveBorder'), 'chatItemActiveBorderColor')}

BUSCA:  {renderColorInput('Texto Principal Item', 'chatItemTextMainColor')}
CAMBIA: {renderColorInput(t('config.chatTab.itemTextMain'), 'chatItemTextMainColor')}

BUSCA:  {renderColorInput('Texto Secundario Item', 'chatItemTextSecondaryColor')}
CAMBIA: {renderColorInput(t('config.chatTab.itemTextSecondary'), 'chatItemTextSecondaryColor')}

BUSCA:  {renderColorInput('Fondo Badge No Leídos', 'chatBadgeBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.badgeBg'), 'chatBadgeBgColor')}

BUSCA:  {renderColorInput('Texto Badge No Leídos', 'chatBadgeTextColor')}
CAMBIA: {renderColorInput(t('config.chatTab.badgeText'), 'chatBadgeTextColor')}

BUSCA:  {renderColorInput('Fondo Cabecera Chat', 'chatHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.headerBg'), 'chatHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera Chat', 'chatHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.chatTab.headerText'), 'chatHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Contenedor Chat', 'chatContainerBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.containerBg'), 'chatContainerBgColor')}

BUSCA:  {renderColorInput('Fondo Área de Input', 'chatInputAreaBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.inputAreaBg'), 'chatInputAreaBgColor')}

BUSCA:  {renderColorInput('Fondo Burbuja Enviada', 'chatBubbleSentBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.sentBg'), 'chatBubbleSentBgColor')}

BUSCA:  {renderColorInput('Texto Burbuja Enviada', 'chatBubbleSentTextColor')}
CAMBIA: {renderColorInput(t('config.chatTab.sentText'), 'chatBubbleSentTextColor')}

BUSCA:  {renderColorInput('Fondo Burbuja Recibida', 'chatBubbleReceivedBgColor')}
CAMBIA: {renderColorInput(t('config.chatTab.receivedBg'), 'chatBubbleReceivedBgColor')}

BUSCA:  {renderColorInput('Texto Burbuja Recibida', 'chatBubbleReceivedTextColor')}
CAMBIA: {renderColorInput(t('config.chatTab.receivedText'), 'chatBubbleReceivedTextColor')}
```

### ZONA: Tab usercard (~líneas 1394-1400)

```
BUSCA:  {renderColorInput('Fondo Tarjeta', 'userCardBgColor')}
CAMBIA: {renderColorInput(t('config.usercardTab.bg'), 'userCardBgColor')}

BUSCA:  {renderColorInput('Texto Principal', 'userCardTextColor')}
CAMBIA: {renderColorInput(t('config.usercardTab.text'), 'userCardTextColor')}

BUSCA:  {renderColorInput('Texto Secundario', 'userCardTextSecondaryColor')}
CAMBIA: {renderColorInput(t('config.usercardTab.textSecondary'), 'userCardTextSecondaryColor')}
```

### ZONA: Tab eventos (~líneas 1402-1411)

```
BUSCA:  {renderColorInput('Fondo Tarjeta Evento', 'eventCardBgColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.cardBg'), 'eventCardBgColor')}

BUSCA:  {renderColorInput('Borde Tarjeta Evento', 'eventCardBorderColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.cardBorder'), 'eventCardBorderColor')}

BUSCA:  {renderColorInput('Título Tarjeta Evento', 'eventCardTitleColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.cardTitle'), 'eventCardTitleColor')}

BUSCA:  {renderColorInput('Meta Tarjeta Evento', 'eventCardMetaColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.cardMeta'), 'eventCardMetaColor')}

BUSCA:  {renderColorInput('Fondo Sidebar Eventos', 'eventsSidebarBgColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.sidebarBg'), 'eventsSidebarBgColor')}

BUSCA:  {renderColorInput('Título Sidebar Eventos', 'eventsSidebarTitleColor')}
CAMBIA: {renderColorInput(t('config.eventosTab.sidebarTitle'), 'eventsSidebarTitleColor')}
```

### ZONA: Tab widgets (~líneas 1413-1423)

```
BUSCA:  {renderColorInput('Fondo Widget', 'widgetBgColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.bg'), 'widgetBgColor')}

BUSCA:  {renderColorInput('Borde Widget', 'widgetBorderColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.border'), 'widgetBorderColor')}

BUSCA:  {renderColorInput('Fondo Cabecera', 'widgetHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.headerBg'), 'widgetHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera', 'widgetHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.headerText'), 'widgetHeaderTextColor')}

BUSCA:  {renderColorInput('Color Icono', 'widgetIconColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.iconColor'), 'widgetIconColor')}

BUSCA:  {renderColorInput('Texto Elemento', 'widgetItemTextColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.itemText'), 'widgetItemTextColor')}

BUSCA:  {renderColorInput('Fondo Hover Elemento', 'widgetItemHoverBgColor')}
CAMBIA: {renderColorInput(t('config.widgetsTab.itemHoverBg'), 'widgetItemHoverBgColor')}
```

### ZONA: Tab scrollbar (~líneas 1425-1431)

```
BUSCA:  {renderColorInput('Color Barra (Thumb)', 'scrollbarThumbColor')}
CAMBIA: {renderColorInput(t('config.scrollbarTab.thumb'), 'scrollbarThumbColor')}

BUSCA:  {renderColorInput('Color Fondo (Track)', 'scrollbarTrackColor')}
CAMBIA: {renderColorInput(t('config.scrollbarTab.track'), 'scrollbarTrackColor')}

BUSCA:  {renderColorInput('Color Hover', 'scrollbarHoverColor')}
CAMBIA: {renderColorInput(t('config.scrollbarTab.hover'), 'scrollbarHoverColor')}
```

### ZONA: Tab calendar (~líneas 1433-1440)

```
BUSCA:  {renderColorInput('Fondo Día Seleccionado', 'calendarSelectedBgColor')}
CAMBIA: {renderColorInput(t('config.calendarTab.selectedBg'), 'calendarSelectedBgColor')}

BUSCA:  {renderColorInput('Texto Día Seleccionado', 'calendarSelectedTextColor')}
CAMBIA: {renderColorInput(t('config.calendarTab.selectedText'), 'calendarSelectedTextColor')}

BUSCA:  {renderColorInput('Fondo Fin de Semana', 'calendarWeekendBgColor')}
CAMBIA: {renderColorInput(t('config.calendarTab.weekendBg'), 'calendarWeekendBgColor')}

BUSCA:  {renderColorInput('Texto Fin de Semana', 'calendarWeekendTextColor')}
CAMBIA: {renderColorInput(t('config.calendarTab.weekendText'), 'calendarWeekendTextColor')}
```

### ZONA: Tab timetable (~líneas 1442-1452)

```
BUSCA:  {renderColorInput('Fondo Cabecera', 'timetableHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.timetableTab.headerBg'), 'timetableHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera', 'timetableHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.timetableTab.headerText'), 'timetableHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Horas', 'timetableHoursBgColor')}
CAMBIA: {renderColorInput(t('config.timetableTab.hoursBg'), 'timetableHoursBgColor')}

BUSCA:  {renderColorInput('Texto Horas', 'timetableHoursTextColor')}
CAMBIA: {renderColorInput(t('config.timetableTab.hoursText'), 'timetableHoursTextColor')}

BUSCA:  {renderColorInput('Fondo Cabecera Día Activo', 'timetableSelectedHeaderBg')}
CAMBIA: {renderColorInput(t('config.timetableTab.selectedHeaderBg'), 'timetableSelectedHeaderBg')}

BUSCA:  {renderColorInput('Texto Cabecera Día Activo', 'timetableSelectedHeaderText')}
CAMBIA: {renderColorInput(t('config.timetableTab.selectedHeaderText'), 'timetableSelectedHeaderText')}

BUSCA:  {renderColorInput('Fondo Celdas Día Activo', 'timetableSelectedCellBg')}
CAMBIA: {renderColorInput(t('config.timetableTab.selectedCellBg'), 'timetableSelectedCellBg')}
```

### ZONA: Tab datatable (~líneas 1454-1472)

```
BUSCA:  {renderColorInput('Fondo Cabecera', 'datatableHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerBg'), 'datatableHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera', 'datatableHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerText'), 'datatableHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Cabecera Hover', 'datatableHeaderHoverBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerHoverBg'), 'datatableHeaderHoverBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera Hover', 'datatableHeaderHoverTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerHoverText'), 'datatableHeaderHoverTextColor')}

BUSCA:  {renderColorInput('Fondo Cabecera Activa', 'datatableHeaderActiveBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerActiveBg'), 'datatableHeaderActiveBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera Activa', 'datatableHeaderActiveTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.headerActiveText'), 'datatableHeaderActiveTextColor')}

BUSCA:  {renderColorInput('Fondo Paginación', 'datatablePaginationBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationBg'), 'datatablePaginationBgColor')}

BUSCA:  {renderColorInput('Texto Paginación', 'datatablePaginationTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationText'), 'datatablePaginationTextColor')}

BUSCA:  {renderColorInput('Fondo Botón Paginación', 'datatablePaginationButtonBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonBg'), 'datatablePaginationButtonBgColor')}

BUSCA:  {renderColorInput('Texto Botón Paginación', 'datatablePaginationButtonTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonText'), 'datatablePaginationButtonTextColor')}

BUSCA:  {renderColorInput('Fondo Botón Hover', 'datatablePaginationButtonHoverBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonHoverBg'), 'datatablePaginationButtonHoverBgColor')}

BUSCA:  {renderColorInput('Texto Botón Hover', 'datatablePaginationButtonHoverTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonHoverText'), 'datatablePaginationButtonHoverTextColor')}

BUSCA:  {renderColorInput('Fondo Botón Activo/Disabled', 'datatablePaginationButtonActiveBgColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonActiveBg'), 'datatablePaginationButtonActiveBgColor')}

BUSCA:  {renderColorInput('Texto Botón Activo/Disabled', 'datatablePaginationButtonActiveTextColor')}
CAMBIA: {renderColorInput(t('config.datatableTab.paginationButtonActiveText'), 'datatablePaginationButtonActiveTextColor')}
```

### ZONA: Tab accordion (~líneas 1474-1483)

```
BUSCA:  {renderColorInput('Fondo Cabecera', 'accordionHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.headerBg'), 'accordionHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera', 'accordionHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.headerText'), 'accordionHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Cabecera Activa', 'accordionHeaderActiveBgColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.headerActiveBg'), 'accordionHeaderActiveBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera Activa', 'accordionHeaderActiveTextColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.headerActiveText'), 'accordionHeaderActiveTextColor')}

BUSCA:  {renderColorInput('Fondo Contenido', 'accordionContentBgColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.contentBg'), 'accordionContentBgColor')}

BUSCA:  {renderColorInput('Texto Contenido', 'accordionContentTextColor')}
CAMBIA: {renderColorInput(t('config.accordionTab.contentText'), 'accordionContentTextColor')}
```

### ZONA: Tab modal (~líneas 1485-1498)

```
BUSCA:  {renderColorInput('Fondo Cabecera', 'modalHeaderBgColor')}
CAMBIA: {renderColorInput(t('config.modalTab.headerBg'), 'modalHeaderBgColor')}

BUSCA:  {renderColorInput('Texto Cabecera', 'modalHeaderTextColor')}
CAMBIA: {renderColorInput(t('config.modalTab.headerText'), 'modalHeaderTextColor')}

BUSCA:  {renderColorInput('Fondo Cuerpo', 'modalBodyBgColor')}
CAMBIA: {renderColorInput(t('config.modalTab.bodyBg'), 'modalBodyBgColor')}

BUSCA:  {renderColorInput('Texto Cuerpo', 'modalBodyTextColor')}
CAMBIA: {renderColorInput(t('config.modalTab.bodyText'), 'modalBodyTextColor')}

BUSCA:  {renderColorInput('Fondo Pie', 'modalFooterBgColor')}
CAMBIA: {renderColorInput(t('config.modalTab.footerBg'), 'modalFooterBgColor')}

BUSCA:  {renderColorInput('Fondo Botón Cerrar', 'modalCloseButtonBgColor')}
CAMBIA: {renderColorInput(t('config.modalTab.closeBg'), 'modalCloseButtonBgColor')}

BUSCA:  {renderColorInput('Texto Botón Cerrar', 'modalCloseButtonTextColor')}
CAMBIA: {renderColorInput(t('config.modalTab.closeText'), 'modalCloseButtonTextColor')}

BUSCA:  {renderColorInput('Fondo Botón Cerrar Hover', 'modalCloseButtonHoverBgColor')}
CAMBIA: {renderColorInput(t('config.modalTab.closeHoverBg'), 'modalCloseButtonHoverBgColor')}

BUSCA:  {renderColorInput('Texto Botón Cerrar Hover', 'modalCloseButtonHoverTextColor')}
CAMBIA: {renderColorInput(t('config.modalTab.closeHoverText'), 'modalCloseButtonHoverTextColor')}
```

### ZONA: Tab pagination (~líneas 1500-1511)

```
BUSCA:  {renderNumberInput('Usuarios por página', 'itemsPerPageUsuarios')}
CAMBIA: {renderNumberInput(t('config.paginationTab.usersPerPage'), 'itemsPerPageUsuarios')}

BUSCA:  {renderNumberInput('Centros por página', 'itemsPerPageCentros')}
CAMBIA: {renderNumberInput(t('config.paginationTab.centersPerPage'), 'itemsPerPageCentros')}

BUSCA:  {renderNumberInput('Ciclos por página', 'itemsPerPageCiclos')}
CAMBIA: {renderNumberInput(t('config.paginationTab.cyclesPerPage'), 'itemsPerPageCiclos')}

BUSCA:  {renderNumberInput('Grupos por página', 'itemsPerPageGrupos')}
CAMBIA: {renderNumberInput(t('config.paginationTab.groupsPerPage'), 'itemsPerPageGrupos')}

BUSCA:  {renderNumberInput('Módulos por página', 'itemsPerPageModulos')}
CAMBIA: {renderNumberInput(t('config.paginationTab.modulesPerPage'), 'itemsPerPageModulos')}

BUSCA:  {renderNumberInput('Matrículas por página', 'itemsPerPageMatriculas')}
CAMBIA: {renderNumberInput(t('config.paginationTab.enrollmentsPerPage'), 'itemsPerPageMatriculas')}

BUSCA:  {renderNumberInput('Imparticiones por página', 'itemsPerPageImparticiones')}
CAMBIA: {renderNumberInput(t('config.paginationTab.teachingPerPage'), 'itemsPerPageImparticiones')}

BUSCA:  {renderNumberInput('Horarios por página', 'itemsPerPageHorarios')}
CAMBIA: {renderNumberInput(t('config.paginationTab.schedulesPerPage'), 'itemsPerPageHorarios')}
```

### ZONA: Tab themes (~líneas 1513-1534)

```
BUSCA:  placeholder="Guarda actual"
CAMBIA: placeholder={t('config.themePlaceholder')}

BUSCA:  Añadir
(dentro del Button de añadir tema)
CAMBIA: {t('config.addTheme')}

BUSCA:  <h4 className={styles.sectionTitle}>Temas Disponibles</h4>
CAMBIA: <h4 className={styles.sectionTitle}>{t('config.availableThemes')}</h4>
```

---

## TEXTOS QUE NO SE TRADUCEN

- `console.error(...)` — NO tocar
- `console.log(...)` — NO tocar
- Valores CSS (colores, tamaños) — NO tocar
- Nombres de propiedades de settings — NO tocar
- "Lorem ipsum..." — NO tocar
- Números (08:00, L, M, X, J, V, S, D del calendario) — NO tocar
- "✕" (icono de cerrar modal) — NO tocar
- Emojis (📅 ⏰) — NO tocar, solo el texto que los sigue
- Nombres de clases CSS — NO tocar

---

## NOTAS SOBRE AMBIGÜEDADES

1. **"Fondo Cabecera" aparece en múltiples tabs** (timetable, datatable, accordion, modal, widgets). Cada uno tiene su clave DIFERENTE (`config.timetableTab.headerBg`, `config.datatableTab.headerBg`, etc.). Identifícalos por el SEGUNDO argumento de `renderColorInput` (el nombre de la setting).

2. **"Texto Cabecera" igual** — mismo criterio, mira el segundo argumento.

3. **Dos "Usuario Activo"** en el preview de chat — ambos se reemplazan con la misma clave `config.previewTexts.activeUser`.

4. **Dos "Filas:"** — uno en `case 'datatable'` y otro en `case 'pagination'`. Ambos usan `config.previewTexts.rows`.

5. **"Último\nmensaje..."** — está partido en dos líneas en el JSX. Reemplaza todo el contenido del div (incluida la línea partida) por `{t('config.previewTexts.lastMessage')}`.

---

## CHECKLIST FINAL

- [ ] Import de `useTranslation` añadido
- [ ] `const { t } = useTranslation();` en primera línea del componente
- [ ] Todos los `setMessage` con textos hardcodeados reemplazados
- [ ] Todos los `throw new Error` con textos hardcodeados reemplazados
- [ ] El `window.confirm` reemplazado
- [ ] Mensaje de no acceso reemplazado
- [ ] Array `tabs` completo reemplazado
- [ ] CrudHeader title y subtitle reemplazados
- [ ] Botones Restablecer/Guardar reemplazados
- [ ] "Vista Previa" reemplazado
- [ ] TODOS los `renderColorInput('Label', ...)` reemplazados (hay ~90+)
- [ ] TODOS los `renderNumberInput('Label', ...)` reemplazados (hay 8)
- [ ] TODOS los textos de preview reemplazados
- [ ] Tab title: labels, options y placeholder reemplazados
- [ ] Tab themes: placeholder, botón, título reemplazados
- [ ] NO se tocaron console.error
- [ ] NO se modificó lógica ni estilos
- [ ] NO se modificaron los JSON
