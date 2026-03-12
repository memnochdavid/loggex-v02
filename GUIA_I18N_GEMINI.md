# GUÍA DE INTERNACIONALIZACIÓN (i18n) — Para Gemini

## QUÉ TIENES QUE HACER

Recorrer los componentes React del frontend y **reemplazar todos los textos hardcodeados en español** por llamadas a `t('clave')` usando react-i18next. Las traducciones ya existen en los archivos JSON. Tu trabajo es SOLO conectar los componentes con esas traducciones.

## REGLAS ABSOLUTAS — LEE ESTO ANTES DE TOCAR NADA

1. **NO modifiques los archivos JSON** (`es.json`, `en.json`). Ya están completos.
2. **NO modifiques `i18n.js`**. Ya está configurado.
3. **NO modifiques `LanguageSelector.jsx`**. Ya funciona.
4. **NO modifiques `main.jsx`**. Ya importa i18n.
5. **NO cambies la lógica de ningún componente**. Solo tocas textos.
6. **NO añadas funcionalidades nuevas**. Cero. Nada.
7. **NO reorganices imports, ni reformatees código, ni toques CSS**.
8. **NO traduzcas `console.log` ni `console.error`** — esos se quedan tal cual.
9. **NO inventes claves**. Usa SOLO las que existen en los JSON.
10. **NO toques `Configuracion.jsx`** — es un archivo de 90KB, se hará aparte.

---

## SETUP: QUÉ AÑADIR A CADA ARCHIVO

### Paso 1: Añadir el import

Al principio del archivo, junto a los demás imports, añade:

```javascript
import { useTranslation } from 'react-i18next';
```

### Paso 2: Añadir el hook

Dentro del componente funcional, EN LA PRIMERA LÍNEA del cuerpo (antes de cualquier useState, useEffect, etc.), añade:

```javascript
const { t } = useTranslation();
```

### Ejemplo COMPLETO de transformación:

**ANTES:**
```javascript
import React, { useState } from 'react';
import styles from './MiComponente.module.css';

const MiComponente = () => {
    const [data, setData] = useState(null);

    return (
        <div>
            <h1>Gestión de Usuarios</h1>
            <button>Guardar</button>
            <span>Cargando datos...</span>
        </div>
    );
};
```

**DESPUÉS:**
```javascript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './MiComponente.module.css';

const MiComponente = () => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);

    return (
        <div>
            <h1>{t('users.title')}</h1>
            <button>{t('common.save')}</button>
            <span>{t('common.loadingData')}</span>
        </div>
    );
};
```

---

## PATRONES DE REEMPLAZO — TODOS LOS CASOS QUE VAS A ENCONTRAR

### CASO 1: Texto simple en JSX

```javascript
// ANTES
<h1>Gestión de Usuarios</h1>
<span>Cargando datos...</span>
<p>No hay datos disponibles.</p>

// DESPUÉS
<h1>{t('users.title')}</h1>
<span>{t('common.loadingData')}</span>
<p>{t('common.noData')}</p>
```

### CASO 2: Texto en atributos (title, placeholder, aria-label)

```javascript
// ANTES
<button title="Notificaciones">
<input placeholder="ejemplo@correo.com" />
<button aria-label="Menú de usuario">

// DESPUÉS
<button title={t('header.notifications')}>
<input placeholder={t('login.emailPlaceholder')} />
<button aria-label={t('userAvatar.menuLabel')}>
```

**IMPORTANTE**: Cuando el atributo pasa de string a expresión, las comillas cambian:
- `title="texto"` → `title={t('clave')}`
- NO hagas `title="{t('clave')}"` — eso es un string literal, NO una expresión.

### CASO 3: Texto en ternarios

```javascript
// ANTES
{isSubmitting ? 'Entrando...' : 'Entrar'}

// DESPUÉS
{isSubmitting ? t('login.submitting') : t('login.submit')}
```

### CASO 4: Texto con variables (interpolación)

Los JSON usan `{{variable}}` para interpolación. Ejemplo en `en.json`:
```json
"greeting": "Hello, {{name}}, have a great day."
```

```javascript
// ANTES
<h2>Hola, {user.nombre}, que tengas un buen día.</h2>

// DESPUÉS
<h2>{t('home.greeting', { name: user.nombre })}</h2>
```

Otro ejemplo:
```javascript
// ANTES
<span>{`Página ${currentPage} de ${totalPages}`}</span>

// DESPUÉS  — OJO, este caso usa claves separadas
<span>{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span>
```

### CASO 5: Texto en template literals con concatenación

```javascript
// ANTES
alert('Error al guardar: ' + error.message);

// DESPUÉS
alert(t('common.errorSaving', { message: error.message }));
```

### CASO 6: Texto en objetos JavaScript (arrays de opciones, searchFields, etc.)

```javascript
// ANTES
const searchFields = [
    { value: 'nombre', label: 'Nombre' },
    { value: 'apellidos', label: 'Apellidos' },
    { value: 'email', label: 'Email' },
];

// DESPUÉS
const searchFields = [
    { value: 'nombre', label: t('users.firstName') },
    { value: 'apellidos', label: t('users.lastName') },
    { value: 'email', label: t('users.email') },
];
```

**CUIDADO**: Si estos arrays están FUERA del componente (a nivel de módulo), NO puedes usar `t()` ahí porque el hook no existe fuera del componente. Mueve la definición DENTRO del componente, o usa `useMemo`:

```javascript
// Si estaba fuera del componente, muévelo dentro:
const MiComponente = () => {
    const { t } = useTranslation();

    const searchFields = [
        { value: 'nombre', label: t('users.firstName') },
        ...
    ];
    // ...resto del componente
};
```

### CASO 7: Texto en alerts

```javascript
// ANTES
alert('No se ha encontrado personal de soporte disponible en este momento.');

// DESPUÉS
alert(t('header.noSupportFound'));
```

### CASO 8: Texto en propiedades de columnas de DataTable

```javascript
// ANTES
const columns = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
];

// DESPUÉS
const columns = [
    { key: 'nombre', label: t('users.firstName'), sortable: true },
    { key: 'email', label: t('users.email'), sortable: true },
];
```

Misma regla: si `columns` está fuera del componente, muévelo dentro.

### CASO 9: Texto en el confirm() del navegador

```javascript
// ANTES
if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {

// DESPUÉS
if (window.confirm(t('users.confirmDelete'))) {
```

---

## ESTRUCTURA DE CLAVES EN LOS JSON

Las claves están organizadas así. Consulta `frontend/src/i18n/locales/es.json` como referencia canónica:

| Prefijo | Uso |
|---------|-----|
| `common.*` | Textos genéricos compartidos (Guardar, Cancelar, Cargando...) |
| `days.*` | Nombres de días |
| `months.*` | Nombres de meses |
| `header.*` | Textos del Header |
| `footer.*` | Textos del Footer |
| `sidebar.*` | Textos de la barra lateral |
| `userAvatar.*` | Menú de usuario |
| `dataTable.*` | Paginación y estados de DataTable |
| `searchBar.*` | Barra de búsqueda |
| `modal.*` | Botones del modal |
| `login.*` | Página de login |
| `home.*` | Página de inicio |
| `users.*` | CRUD de usuarios |
| `centers.*` | CRUD de centros |
| `cycles.*` | CRUD de ciclos formativos |
| `groups.*` | CRUD de grupos |
| `modules.*` | CRUD de módulos |
| `enrollments.*` | CRUD de matrículas |
| `teaching.*` | Asignación de docencia |
| `schedules.*` | Horarios |
| `holidays.*` | Festivos |
| `tasks.*` | Tareas |
| `deliveries.*` | Entregas |
| `profile.*` | Perfil de usuario |
| `messages.*` | Mensajería |
| `notFound.*` | Página 404 |
| `errorPage.*` | Página de error/acceso denegado |
| `faculty.*` | Claustro |
| `classmates.*` | Compañeros |
| `myStudents.*` | Mis alumnos |
| `myAbsences.*` | Faltas de asistencia |
| `myTeachers.*` | Mis profesores |
| `studentMaterials.*` | Apuntes del alumno |
| `teacherMaterials.*` | Temarios del profesor |
| `timetable.*` | Componente TimeTable |
| `calendar.*` | Componente CalendarView |
| `notifications.*` | NotificationList |
| `accordion.*` | AccordionView |
| `attendance.*` | Modal de asistencia |
| `pendingTasks.*` | Widget tareas pendientes |
| `bulletin.*` | Widget tablón de anuncios |
| `todaySchedule.*` | Widget horario de hoy |
| `events.*` | Widget eventos de la semana |
| `userCard.*` | Tarjeta de usuario |
| `userProfile.*` | Vista de perfil (UserProfileView) |
| `about.*` | Página About |
| `config.*` | Configuración del centro |
| `lang.*` | Selector de idioma |

---

## LISTA DE ARCHIVOS A MODIFICAR (en orden sugerido)

### Grupo 1 — Layout (3 archivos)
1. `frontend/src/layout/Header.jsx` — usa claves `header.*`
2. `frontend/src/layout/Footer.jsx` — usa claves `footer.*`
3. `frontend/src/layout/Sidebar.jsx` — usa claves `sidebar.*`

### Grupo 2 — Componentes compartidos (8 archivos)
4. `frontend/src/components/DataTable.jsx` — usa claves `dataTable.*`
5. `frontend/src/components/SearchBar.jsx` — usa claves `searchBar.*`
6. `frontend/src/components/ModalView.jsx` — usa claves `modal.*`
7. `frontend/src/components/UserAvatar.jsx` — usa claves `userAvatar.*`
8. `frontend/src/components/NotificationList.jsx` — usa claves `notifications.*`
9. `frontend/src/components/AccordionView.jsx` — usa claves `accordion.*`
10. `frontend/src/components/TimeTable.jsx` — usa claves `timetable.*`, `days.*`
11. `frontend/src/components/CalendarView.jsx` — usa claves `calendar.*`, `months.*`, `days.*`

### Grupo 3 — Widgets del Home (4 archivos)
12. `frontend/src/components/PendingTasksWidget.jsx` — usa claves `pendingTasks.*`
13. `frontend/src/components/TablonWidget.jsx` — usa claves `bulletin.*`
14. `frontend/src/components/UpcomingEventsWidget.jsx` — usa claves `events.*`
15. `frontend/src/components/EventsSidebar.jsx` — usa claves `todaySchedule.*`

### Grupo 4 — Componentes de usuario (2 archivos)
16. `frontend/src/components/UserCard.jsx` — usa claves `userCard.*`
17. `frontend/src/components/UserProfileView.jsx` — usa claves `userProfile.*`

### Grupo 5 — Componente de asistencia (1 archivo)
18. `frontend/src/components/AsistenciaModal.jsx` — usa claves `attendance.*`

### Grupo 6 — Páginas principales (18 archivos)
19. `frontend/src/pages/Login.jsx` — usa claves `login.*`
20. `frontend/src/pages/Home.jsx` — usa claves `home.*`
21. `frontend/src/pages/Usuarios.jsx` — usa claves `users.*`
22. `frontend/src/pages/Centros.jsx` — usa claves `centers.*`
23. `frontend/src/pages/CiclosFormativos.jsx` — usa claves `cycles.*`
24. `frontend/src/pages/Grupos.jsx` — usa claves `groups.*`
25. `frontend/src/pages/Modulos.jsx` — usa claves `modules.*`
26. `frontend/src/pages/Matriculas.jsx` — usa claves `enrollments.*`
27. `frontend/src/pages/Imparticiones.jsx` — usa claves `teaching.*`
28. `frontend/src/pages/Horarios.jsx` — usa claves `schedules.*`
29. `frontend/src/pages/Festivos.jsx` — usa claves `holidays.*`
30. `frontend/src/pages/Tareas.jsx` — usa claves `tasks.*`
31. `frontend/src/pages/Entregas.jsx` — usa claves `deliveries.*`
32. `frontend/src/pages/Perfil.jsx` — usa claves `profile.*`
33. `frontend/src/pages/Mensajes.jsx` — usa claves `messages.*`
34. `frontend/src/pages/Claustro.jsx` — usa claves `faculty.*`
35. `frontend/src/pages/Companeros.jsx` — usa claves `classmates.*`
36. `frontend/src/pages/MisAlumnos.jsx` — usa claves `myStudents.*`
37. `frontend/src/pages/MisFaltas.jsx` — usa claves `myAbsences.*`
38. `frontend/src/pages/MisProfesores.jsx` — usa claves `myTeachers.*`
39. `frontend/src/pages/MaterialesAlumno.jsx` — usa claves `studentMaterials.*`
40. `frontend/src/pages/MaterialesProfesor.jsx` — usa claves `teacherMaterials.*`
41. `frontend/src/pages/About.jsx` — usa claves `about.*`
42. `frontend/src/pages/NotFound.jsx` — usa claves `notFound.*`
43. `frontend/src/pages/ErrorPage.jsx` — usa claves `errorPage.*`

### Grupo 7 — Context (1 archivo)
44. `frontend/src/context/AuthContext.jsx` — usa claves `common.*` para mensajes de error

### NO TOCAR
- `frontend/src/pages/Configuracion.jsx` — se hará aparte
- `frontend/src/components/LanguageSelector.jsx` — ya hecho
- `frontend/src/i18n/*` — ya configurado
- `frontend/src/main.jsx` — ya configurado

---

## CÓMO ENCONTRAR LA CLAVE CORRECTA

1. Identifica el texto en español hardcodeado
2. Busca ese texto EXACTO en `frontend/src/i18n/locales/es.json`
3. La ruta JSON es la clave. Ejemplo: si el texto "Gestión de Usuarios" está en:
   ```json
   { "users": { "title": "Gestión de Usuarios" } }
   ```
   La clave es `users.title`

**Si no encuentras el texto exacto en es.json, NO inventes una clave. Déjalo como está y pon un comentario:**
```javascript
{/* TODO i18n: clave no encontrada para "texto que sea" */}
```

---

## ERRORES COMUNES QUE NO DEBES COMETER

### ERROR 1: Poner t() dentro de strings
```javascript
// MAL ❌
title="{t('header.notifications')}"
placeholder="{t('login.emailPlaceholder')}"

// BIEN ✅
title={t('header.notifications')}
placeholder={t('login.emailPlaceholder')}
```

### ERROR 2: Olvidar las llaves en JSX
```javascript
// MAL ❌
<h1>t('users.title')</h1>

// BIEN ✅
<h1>{t('users.title')}</h1>
```

### ERROR 3: Usar t() fuera de un componente React
```javascript
// MAL ❌ (fuera del componente)
const COLUMNS = [
    { key: 'nombre', label: t('users.firstName') }  // t no existe aquí
];

const MiComponente = () => {
    const { t } = useTranslation();
    return <DataTable columns={COLUMNS} />;
};

// BIEN ✅ (dentro del componente)
const MiComponente = () => {
    const { t } = useTranslation();

    const columns = [
        { key: 'nombre', label: t('users.firstName') }
    ];

    return <DataTable columns={columns} />;
};
```

### ERROR 4: Traducir console.log/console.error
```javascript
// MAL ❌
console.error(t('some.error.key'));

// BIEN ✅ (déjalo como está)
console.error("Error fetching usuarios:", err);
```

### ERROR 5: Inventar claves que no existen
```javascript
// MAL ❌ (esta clave no existe en los JSON)
{t('users.loadingUsers')}

// BIEN ✅ (usa la clave genérica que SÍ existe)
{t('common.loadingData')}
```

### ERROR 6: Romper la interpolación
```javascript
// MAL ❌
{t('home.greeting')} {user.nombre}

// BIEN ✅
{t('home.greeting', { name: user.nombre })}
```

### ERROR 7: Añadir el hook dos veces
```javascript
// MAL ❌
const MiComponente = () => {
    const { t } = useTranslation();
    const { t } = useTranslation();  // DUPLICADO
```

### ERROR 8: Poner useTranslation dentro de un condicional o loop
```javascript
// MAL ❌ (viola las reglas de hooks de React)
if (user) {
    const { t } = useTranslation();
}

// BIEN ✅ (siempre al principio del componente)
const { t } = useTranslation();
```

### ERROR 9: Modificar los archivos JSON
```javascript
// MAL ❌ — NO toques es.json ni en.json
// BIEN ✅ — Solo modifica archivos .jsx
```

### ERROR 10: Cambiar lógica, estilos o estructura
```javascript
// MAL ❌ — "ya que estoy, refactorizo esto..."
// BIEN ✅ — Cambia SOLO los textos, nada más
```

---

## CHECKLIST DE VERIFICACIÓN POR ARCHIVO

Antes de dar por terminado cada archivo, verifica:

- [ ] ¿Añadí `import { useTranslation } from 'react-i18next';`?
- [ ] ¿Añadí `const { t } = useTranslation();` dentro del componente?
- [ ] ¿Reemplacé TODOS los textos en español visibles al usuario?
- [ ] ¿Los atributos title, placeholder y aria-label también están traducidos?
- [ ] ¿Los alerts y confirms usan t()?
- [ ] ¿Las claves que usé existen REALMENTE en es.json?
- [ ] ¿No toqué console.log/console.error?
- [ ] ¿No modifiqué lógica ni estilos?
- [ ] ¿No rompí ningún ternario?
- [ ] ¿Si moví arrays/objetos dentro del componente, la funcionalidad sigue igual?

---

## EJEMPLO COMPLETO: Header.jsx

Este es un ejemplo real para que veas el patrón aplicado al Header del proyecto:

**ANTES (extracto):**
```jsx
<Link to="/about" className={styles.navLink}>About</Link>

<a href="#" onClick={handleSupportClick}>
    <MessageCircleQuestion size={18} />
    Soporte
</a>

<a href="..." title="Documentación API Platform">
    API Docs
</a>

<button title="Notificaciones">

alert('No se ha encontrado personal de soporte disponible en este momento.');
alert('Error al conectar con soporte.');
```

**DESPUÉS:**
```jsx
<Link to="/about" className={styles.navLink}>{t('header.about')}</Link>

<a href="#" onClick={handleSupportClick}>
    <MessageCircleQuestion size={18} />
    {t('header.support')}
</a>

<a href="..." title={t('header.apiDocsTooltip')}>
    {t('header.apiDocs')}
</a>

<button title={t('header.notifications')}>

alert(t('header.noSupportFound'));
alert(t('header.errorSupport'));
```

---

## NOTA SOBRE AuthContext.jsx

AuthContext NO es un componente funcional normal — es un Context Provider. Pero sigue siendo un componente React, así que `useTranslation` funciona dentro de él. Sin embargo, hay funciones dentro del provider que se llaman como callbacks (login, logout). Como `t` se obtiene del hook al nivel del provider, funciona en las funciones internas.

```javascript
export const AuthProvider = ({ children }) => {
    const { t } = useTranslation();

    const login = async (email, password) => {
        // t() funciona aquí porque estamos dentro del componente
        return { success: false, message: t('common.errorConnection') };
    };
};
```

---

## RESUMEN EJECUTIVO

1. Abre cada archivo de la lista
2. Añade el import de `useTranslation`
3. Añade `const { t } = useTranslation();` al principio del componente
4. Busca cada texto en español → búscalo en `es.json` → reemplázalo con `t('clave')`
5. No toques NADA más
6. Si dudas de una clave, consulta `es.json`
7. Si no existe la clave, deja un `TODO i18n` y sigue
