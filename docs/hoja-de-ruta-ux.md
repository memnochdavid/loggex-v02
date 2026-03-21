# Hoja de Ruta UX — Loggex v02

Documento de mejoras de experiencia de usuario para la plataforma Loggex.
Cada sección describe el **estado actual**, el **problema** que presenta, la **solución propuesta** y los **pasos de implementación**.

---

## Índice

1. [Empty States con ilustración y acción](#1-empty-states-con-ilustración-y-acción)
2. [Skeleton Loaders](#2-skeleton-loaders)
3. [Validación inline en formularios](#3-validación-inline-en-formularios)
4. [Breadcrumbs / Contexto de navegación](#4-breadcrumbs--contexto-de-navegación)
5. [Accesibilidad (ARIA y teclado)](#5-accesibilidad-aria-y-teclado)
6. [Transiciones entre páginas](#6-transiciones-entre-páginas)
7. [Búsqueda global (Command Palette)](#7-búsqueda-global-command-palette)
8. [Atajos de teclado para power users](#8-atajos-de-teclado-para-power-users)
9. [Modo oscuro / claro](#9-modo-oscuro--claro)
10. [Feedback optimista en acciones CRUD](#10-feedback-optimista-en-acciones-crud)
11. [Indicador de progreso en formularios largos](#11-indicador-de-progreso-en-formularios-largos)
12. [Notificaciones en tiempo real](#12-notificaciones-en-tiempo-real)
13. [Onboarding / Tour guiado](#13-onboarding--tour-guiado)
14. [Drag & Drop en Horarios](#14-drag--drop-en-horarios)

---

## Tabla resumen

| # | Mejora | Prioridad | Esfuerzo | Estado |
|---|--------|-----------|----------|--------|
| 1 | Empty States | Alta | Bajo | Completado |
| 2 | Skeleton Loaders | Alta | Medio | Completado |
| 3 | Validación inline formularios | Alta | Medio | Completado |
| 4 | Breadcrumbs | Alta | Bajo | Pendiente |
| 5 | Accesibilidad (ARIA) | Alta | Bajo | Pendiente |
| 6 | Transiciones entre páginas | Media | Bajo | Pendiente |
| 7 | Búsqueda global | Media | Medio | Pendiente |
| 8 | Atajos de teclado | Media | Medio | Pendiente |
| 9 | Modo oscuro / claro | Media | Bajo | Pendiente |
| 10 | Feedback optimista CRUD | Media | Medio | Pendiente |
| 11 | Stepper en formularios largos | Baja | Medio | Pendiente |
| 12 | Notificaciones en tiempo real | Baja | Alto | Pendiente |
| 13 | Onboarding / Tour guiado | Baja | Medio | Pendiente |
| 14 | Drag & Drop en Horarios | Baja | Alto | Pendiente |

---

## 1. Empty States con ilustración y acción

### Estado actual

- `DataTable.jsx` muestra un único texto centrado (`t('dataTable.noData')`) cuando no hay datos.
- Se renderiza dentro de una celda `<td>` con `colSpan` completo, padding de `3rem` y clase `.emptyState`.
- En la vista mobile (accordion) se muestra el mismo texto en un `<div>` centrado.
- **No hay icono, ilustración ni botón de acción.**

### Problema

Un empty state vacío sin contexto visual genera confusión: el usuario no sabe si es un error, si no ha cargado, o si simplemente no hay datos. No se le guía hacia la acción lógica siguiente (crear el primer registro).

### Solución propuesta

Crear un componente reutilizable `EmptyState` que acepte:

- `icon` — icono Lucide contextual (ej: `Users` para usuarios, `BookOpen` para módulos).
- `title` — mensaje principal ("No hay alumnos registrados").
- `description` — texto secundario opcional ("Crea el primer alumno para empezar").
- `actionLabel` / `onAction` — botón CTA opcional ("Crear alumno").
- `lottie` — animación Lottie opcional (si el tema lo soporta).

### Implementación

1. **Crear componente** `frontend/src/components/EmptyState.jsx` + `EmptyState.module.css`.
   - Layout centrado vertical y horizontal.
   - Icono grande (48px) con color `--color-primary-500`.
   - Título en `--text-main`, descripción en `--text-secondary`.
   - Botón usando el componente `Button` existente (variante `primary`).
2. **Integrar en DataTable** — sustituir el `<td>` con texto plano por `<EmptyState>`.
   - Añadir props opcionales a DataTable: `emptyIcon`, `emptyTitle`, `emptyDescription`, `emptyAction`, `onEmptyAction`.
   - Pasar esas props al componente `EmptyState`.
3. **Actualizar cada página CRUD** para pasar props contextuales:
   - `Usuarios.jsx` → icono `Users`, acción "Crear usuario".
   - `Grupos.jsx` → icono `UsersRound`, acción "Crear grupo".
   - `Modulos.jsx` → icono `BookOpen`, acción "Crear módulo".
   - (Repetir para cada página que use DataTable.)
4. **Traducciones i18n** — añadir claves `emptyState.*` en los archivos de traducción.

### Archivos afectados

- `frontend/src/components/EmptyState.jsx` (nuevo)
- `frontend/src/components/EmptyState.module.css` (nuevo)
- `frontend/src/components/DataTable.jsx` (modificar)
- `frontend/src/pages/Usuarios.jsx`, `Grupos.jsx`, `Modulos.jsx`, etc. (modificar)
- Archivos de traducción i18n.

---

## 2. Skeleton Loaders

### Estado actual

- `DataTable.jsx` muestra un overlay semi-transparente (`rgba(255,255,255,0.6)`) con posición absoluta sobre la tabla existente cuando `loading=true`.
- Dentro del overlay hay una animación Lottie de 60x60px.
- La tabla subyacente reduce su opacidad a `0.5` con transición de `0.2s`.
- `LoadingView.jsx` muestra una animación Lottie centrada de 100x100px para carga de página completa (Suspense fallback).
- **No existen skeleton screens en ningún lugar del proyecto.**

### Problema

El overlay produce un "flash" visual: la tabla aparece, se oscurece, y luego vuelve. En cargas rápidas parpadea molestamente. En cargas lentas el usuario ve contenido borroso sin poder interactuar. No comunica la estructura del contenido que viene.

### Solución propuesta

Componente `SkeletonRow` que imita la estructura de filas de la tabla con bloques animados (pulse). Se muestra en lugar de la tabla cuando no hay datos previos cargados. El overlay Lottie se mantiene solo para re-fetches (cuando ya hay datos visibles).

### Implementación

1. **Crear componente** `frontend/src/components/SkeletonRow.jsx` + `SkeletonRow.module.css`.
   - Recibir `columns` (número) y `rows` (número, por defecto el `rowsPerPage` actual).
   - Cada celda: `<div>` con ancho aleatorio (60%-90%), altura fija, border-radius, fondo gris animado con `@keyframes pulse`.
   - Animación CSS: alternar opacidad 0.4 ↔ 1.0 en ciclo de 1.5s.
2. **Integrar en DataTable**:
   - Si `loading=true` y `data.length === 0` → renderizar `SkeletonRow`.
   - Si `loading=true` y `data.length > 0` → mantener overlay actual (re-fetch).
   - Esto elimina el flash en la carga inicial.
3. **Skeleton para cards** — variante para las vistas mobile accordion.
4. **Skeleton para LoadingView** — variante genérica de página completa como alternativa al Lottie (opcional).

### Archivos afectados

- `frontend/src/components/SkeletonRow.jsx` (nuevo)
- `frontend/src/components/SkeletonRow.module.css` (nuevo)
- `frontend/src/components/DataTable.jsx` (modificar lógica de loading)

---

## 3. Validación inline en formularios

### Estado actual

- Los formularios (Usuarios, Matriculas, etc.) usan inputs HTML nativos con atributo `required`.
- **La validación es exclusivamente onSubmit**: no hay validación onBlur ni onChange.
- Los errores se muestran como **toast notifications** genéricas (`toast.error(...)`) tras fallar la petición al backend.
- **No hay mensajes de error bajo los campos individuales.**
- No se usa ninguna librería de formularios (ni Formik, ni React Hook Form, ni Zod).
- Los campos de formulario son `<input>`, `<select>` y `<textarea>` estándar controlados por `useState`.

### Problema

El usuario rellena un formulario largo, hace submit, y recibe un toast genérico sin saber qué campo falló. Tiene que revisar todo el formulario para encontrar el error. Esto es especialmente problemático en páginas con muchos campos como Usuarios (nombre, apellidos, email, roles, centro, avatar).

### Solución propuesta

Validación híbrida: onBlur para campos individuales + onSubmit como red de seguridad. Mensajes de error inline debajo de cada campo. Sin añadir librerías externas pesadas — usar un hook custom `useFormValidation`.

### Implementación

1. **Crear hook** `frontend/src/hooks/useFormValidation.js`:
   - Recibir schema de validación como objeto simple:
     ```js
     { email: { required: true, pattern: /email-regex/, message: '...' },
       nombre: { required: true, minLength: 2 } }
     ```
   - Exponer: `errors`, `validateField(name, value)`, `validateAll(formData)`, `clearError(name)`.
   - `validateField` se ejecuta onBlur.
   - `validateAll` se ejecuta onSubmit.
2. **Crear componente** `frontend/src/components/FormField.jsx` + `FormField.module.css`:
   - Wrapper que incluye: `<label>`, `<input>` (u otro control), y `<span>` de error.
   - El error aparece con animación slide-down + color `--color-error-500`.
   - El borde del input cambia a rojo cuando hay error.
   - Props: `label`, `error`, `required`, y las del input nativo via spread.
3. **Migrar formularios gradualmente**:
   - Empezar por `Usuarios.jsx` (el más complejo).
   - Sustituir inputs directos por `<FormField>`.
   - Conectar `useFormValidation` en el handler del formulario.
4. **Traducciones** — claves `validation.required`, `validation.email`, `validation.minLength`, etc.

### Archivos afectados

- `frontend/src/hooks/useFormValidation.js` (nuevo)
- `frontend/src/components/FormField.jsx` (nuevo)
- `frontend/src/components/FormField.module.css` (nuevo)
- `frontend/src/pages/Usuarios.jsx` (migrar primero)
- Resto de páginas CRUD (migrar gradualmente)
- Archivos de traducción i18n.

---

## 4. Breadcrumbs / Contexto de navegación

### Estado actual

- **No hay breadcrumbs implementados.** No existe ningún componente ni referencia en el código.
- La navegación actual depende exclusivamente del Sidebar (resaltado de ruta activa) y del título de la página (`CrudHeader.jsx` con `<h1>`).
- No hay forma de saber en qué nivel jerárquico se está (ej: dentro de un grupo de un ciclo de un centro).

### Problema

En flujos de navegación profundos (Centro → Ciclo Formativo → Módulo → Grupo), el usuario pierde el contexto de dónde está. Para volver atrás depende del botón del navegador o del Sidebar, lo cual rompe el flujo mental.

### Solución propuesta

Componente `Breadcrumb` que muestra la ruta jerárquica bajo el Header. Se integra en el Layout y se alimenta automáticamente de la ruta actual + un mapa de rutas configurado.

### Implementación

1. **Crear componente** `frontend/src/components/Breadcrumb.jsx` + `Breadcrumb.module.css`:
   - Recibir array de `items`: `[{ label, path }, ...]`.
   - Último item sin enlace (página actual).
   - Separador: icono `ChevronRight` de Lucide (8px).
   - Estilo: texto pequeño (`--font-size-sm`), color `--text-secondary`, enlace con color `--color-primary-500`.
2. **Crear mapa de rutas** `frontend/src/config/breadcrumbMap.js`:
   - Mapeo de rutas a labels traducibles:
     ```js
     { '/usuarios': 'breadcrumb.usuarios',
       '/grupos': 'breadcrumb.grupos',
       '/horarios': 'breadcrumb.horarios' }
     ```
   - Soporte para rutas con parámetros dinámicos.
3. **Integrar en Layout.jsx**:
   - Renderizar `<Breadcrumb>` entre el Header y el contenido principal.
   - Usar `useLocation()` para generar los items automáticamente.
   - Ocultar en la ruta raíz `/` (Home).
4. **Traducciones** — claves `breadcrumb.*`.

### Archivos afectados

- `frontend/src/components/Breadcrumb.jsx` (nuevo)
- `frontend/src/components/Breadcrumb.module.css` (nuevo)
- `frontend/src/config/breadcrumbMap.js` (nuevo)
- `frontend/src/components/Layout.jsx` (modificar)
- Archivos de traducción i18n.

---

## 5. Accesibilidad (ARIA y teclado)

### Estado actual

**Lo que ya existe:**
- `Toast.jsx`: tiene `role="alert"` y `aria-label="Cerrar"` en el botón de cierre.
- `ConfirmDialog.jsx`: tiene `role="alertdialog"` y `aria-describedby="confirm-message"`.
- `ModalView.jsx`: tiene `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`. Auto-focus en primer input.
- `SearchBar.jsx`: tiene `role="search"` y `aria-label` en el input.
- Tecla Escape cierra modales y diálogos. Enter confirma diálogos.

**Lo que falta:**
- Toast: no tiene `aria-live="assertive"` ni `aria-atomic="true"`.
- No hay link "Skip to content" para navegación por teclado.
- No hay focus trap completo en modales (el tab puede salir del modal hacia el fondo).
- No hay `aria-live` en regiones dinámicas (tabla tras filtrar/paginar, contador de resultados).
- No se gestiona el foco al cerrar modales (no vuelve al elemento que lo abrió).

### Problema

Usuarios con lectores de pantalla no reciben notificaciones toast. El foco puede "escaparse" de modales abiertos. No hay forma de saltar directamente al contenido principal sin tabular por todo el header y sidebar.

### Solución propuesta

Correcciones incrementales sin reestructurar componentes:

### Implementación

1. **Toast.jsx** — añadir `aria-live="assertive"` y `aria-atomic="true"` al contenedor del toast.
2. **Focus trap en ModalView.jsx**:
   - Capturar todos los elementos focusables dentro del modal.
   - Al llegar al último y pulsar Tab, volver al primero (y viceversa con Shift+Tab).
   - Al cerrar, devolver el foco al elemento que abrió el modal (`document.activeElement` previo).
3. **Skip-to-content link**:
   - Añadir `<a href="#main-content" class="skip-link">` como primer hijo de `<body>`.
   - Oculto visualmente hasta recibir foco (`:focus` → visible).
   - El contenido principal tiene `id="main-content"`.
   - Implementar en `Layout.jsx`.
4. **aria-live en DataTable**:
   - Añadir `aria-live="polite"` al wrapper de resultados.
   - Anunciar cambios: "Mostrando X de Y resultados".
5. **Restauración de foco al cerrar modal**:
   - Guardar `document.activeElement` al abrir.
   - Restaurarlo en `handleClose`.

### Archivos afectados

- `frontend/src/components/Toast.jsx` (modificar)
- `frontend/src/components/ModalView.jsx` (modificar)
- `frontend/src/components/Layout.jsx` (añadir skip-link)
- `frontend/src/components/DataTable.jsx` (añadir aria-live)

---

## 6. Transiciones entre páginas

### Estado actual

- `App.jsx` usa React Router v7 con `lazy()` y `<Suspense fallback={<LoadingView />}>`.
- **No hay animaciones de transición entre rutas.** El cambio es un corte abrupto: página anterior desaparece → loading → página nueva aparece.
- No se usa Framer Motion, React Transition Group ni la View Transitions API.

### Problema

Las transiciones bruscas entre páginas rompen la continuidad visual. El usuario percibe la aplicación como una colección de páginas separadas en lugar de una experiencia fluida.

### Solución propuesta

Usar la **View Transitions API** nativa del navegador (soportada en Chrome, Edge, Safari 18+) con fallback graceful para Firefox. Alternativa: CSS `@view-transition` con React Router.

### Implementación

1. **Opción A — View Transitions API (sin dependencias)**:
   - Envolver la navegación con `document.startViewTransition()`.
   - Crear un wrapper de `useNavigate` que inicie la transición:
     ```js
     const navigate = useNavigate();
     const transitionNavigate = (to) => {
       if (document.startViewTransition) {
         document.startViewTransition(() => navigate(to));
       } else {
         navigate(to);
       }
     };
     ```
   - CSS global:
     ```css
     ::view-transition-old(root) { animation: fade-out 0.15s ease; }
     ::view-transition-new(root) { animation: fade-in 0.15s ease; }
     ```
2. **Opción B — CSS puro con Suspense** (más simple):
   - Aplicar `animation: fadeIn 0.2s ease` al contenedor principal de cada página.
   - Definir `@keyframes fadeIn` en `index.css`.
   - No requiere ninguna librería ni API nueva.
3. **Integración**: Opción B como paso inmediato (1 línea CSS), Opción A como mejora futura.

### Archivos afectados

- `frontend/src/index.css` (añadir keyframes)
- `frontend/src/components/Layout.jsx` (añadir clase de animación al contenedor)
- (Opción A) Hook custom `useTransitionNavigate.js` (nuevo)

---

## 7. Búsqueda global (Command Palette)

### Estado actual

- `SearchBar.jsx` es un componente de búsqueda local, usado dentro de cada página CRUD individualmente.
- Tiene `role="search"`, selector de campo y botón de limpiar.
- **No existe búsqueda global.** No hay Ctrl+K, no hay command palette, no hay buscador que cruce entidades.
- Cada página gestiona su propia búsqueda contra la API de forma independiente.

### Problema

Admins y profesores gestionan cientos de registros en múltiples secciones. Para encontrar un alumno específico, deben navegar a Usuarios, escribir el nombre, y buscar. No hay atajo rápido.

### Solución propuesta

Command Palette tipo Spotlight/VS Code. Se abre con `Ctrl+K`. Permite buscar alumnos, profesores, grupos, módulos y navegar a cualquier página. Resultados agrupados por categoría.

### Implementación

1. **Crear componente** `frontend/src/components/CommandPalette.jsx` + `CommandPalette.module.css`:
   - Modal centrado en la parte superior (sin overlay completo, solo backdrop sutil).
   - Input de búsqueda grande con icono `Search`.
   - Resultados agrupados: "Páginas", "Usuarios", "Grupos", "Módulos".
   - Navegación con flechas arriba/abajo, Enter para seleccionar, Escape para cerrar.
   - Debounce de 300ms antes de llamar a la API.
2. **Crear hook** `frontend/src/hooks/useCommandPalette.js`:
   - Escuchar `Ctrl+K` / `Cmd+K` globalmente.
   - Estado abierto/cerrado.
   - Lógica de búsqueda multi-entidad (fetch paralelo a `/api/users?search=`, `/api/grupos?search=`, etc.).
3. **Mapa de páginas estáticas** para resultados de navegación:
   - Mapeo de nombres de página a rutas, filtrable por texto.
   - Filtrado por rol del usuario (no mostrar admin pages a alumnos).
4. **Integrar en App.jsx** — renderizar `<CommandPalette>` a nivel global.
5. **Indicador visual** — mostrar `Ctrl+K` como hint en el Header o SearchBar.

### Archivos afectados

- `frontend/src/components/CommandPalette.jsx` (nuevo)
- `frontend/src/components/CommandPalette.module.css` (nuevo)
- `frontend/src/hooks/useCommandPalette.js` (nuevo)
- `frontend/src/App.jsx` (integrar)
- `frontend/src/components/Header.jsx` (hint visual opcional)

---

## 8. Atajos de teclado para power users

### Estado actual

- **Escape**: cierra modales (`ModalView.jsx`) y diálogos (`ConfirmDialog.jsx`).
- **Enter**: confirma diálogos (`ConfirmDialog.jsx`).
- **Auto-focus**: `ModalView.jsx` enfoca el primer input al abrir.
- **No hay otros atajos de teclado.** No hay `N` para nuevo, `/` para buscar, ni Ctrl+S para guardar.

### Problema

Profesores y admins realizan acciones CRUD repetitivas (registrar asistencia, crear tareas, revisar entregas). Sin atajos de teclado, cada acción requiere mover el ratón, encontrar el botón, y hacer click. Esto ralentiza significativamente flujos de trabajo frecuentes.

### Solución propuesta

Sistema de atajos global con hotkeys configurables. Atajos contextuales por página.

### Implementación

1. **Crear hook** `frontend/src/hooks/useHotkeys.js`:
   - Registrar combinaciones de teclas con callbacks.
   - Desactivar cuando hay un input/textarea enfocado (para no interferir con escritura).
   - Soporte para modificadores (Ctrl, Shift, Alt).
   - Cleanup automático en unmount.
2. **Atajos globales** (registrar en `App.jsx`):
   - `Ctrl+K` / `Cmd+K` → Abrir command palette (ver punto 7).
   - `/` → Enfocar la SearchBar de la página actual (si existe).
   - `?` → Mostrar panel de atajos disponibles.
3. **Atajos por página CRUD** (registrar en cada página):
   - `N` → Abrir modal de creación.
   - `E` → Editar registro seleccionado (si hay selección).
   - `Escape` → Cerrar modal (ya existe).
4. **Atajos en modales**:
   - `Ctrl+Enter` / `Cmd+Enter` → Enviar formulario.
5. **Panel de ayuda de atajos**:
   - Componente `ShortcutsHelp.jsx` que muestra todos los atajos en una tabla.
   - Se abre con `?`.

### Archivos afectados

- `frontend/src/hooks/useHotkeys.js` (nuevo)
- `frontend/src/components/ShortcutsHelp.jsx` (nuevo)
- `frontend/src/App.jsx` (atajos globales)
- Páginas CRUD (atajos contextuales)

---

## 9. Modo oscuro / claro

### Estado actual

- El sistema de theming (`theme.js`) inyecta 100+ variables CSS dinámicamente en `:root` basándose en la personalización del centro educativo.
- Los colores se generan a partir de un color primario, un color de fondo y un color de texto.
- **No existe toggle light/dark mode.** El tema lo define el centro, no el usuario.
- No se detecta `prefers-color-scheme` del sistema operativo.
- No hay preferencia almacenada en `localStorage` para modo claro/oscuro.

### Problema

Los usuarios no pueden adaptar la interfaz a sus preferencias visuales ni a condiciones de luz ambiental. Un profesor que trabaja de noche no tiene opción de modo oscuro. El sistema de temas solo varía colores entre centros, no luminosidad.

### Solución propuesta

Añadir un toggle light/dark al sistema de temas existente. El modo oscuro invierte la luminosidad base mientras mantiene los colores del centro.

### Implementación

1. **Ampliar `theme.js`**:
   - Añadir función `applyDarkMode(isDark)` que ajuste las variables de luminosidad.
   - En modo oscuro: invertir `--bg-view` (claro→oscuro), `--text-main` (oscuro→claro), ajustar sombras y bordes.
   - Mantener el color primario del centro intacto.
   - Respetar `prefers-color-scheme` como valor por defecto si el usuario no ha elegido.
2. **Persistir preferencia**:
   - Guardar en `localStorage` como `loggex-color-mode`: `'light'` | `'dark'` | `'system'`.
   - Leer al inicio en `AuthContext` y aplicar junto con el tema del centro.
3. **Componente toggle** `frontend/src/components/ThemeToggle.jsx`:
   - Icono `Sun` / `Moon` de Lucide.
   - Ubicación: Header, junto al selector de idioma.
   - 3 estados: claro, oscuro, sistema (auto).
4. **Ajustar componentes que usan colores hardcodeados**:
   - Revisar `rgba(255,255,255,0.6)` en DataTable overlay → reemplazar por variable CSS.
   - Revisar cualquier color inline que no use variables.

### Archivos afectados

- `frontend/src/utils/theme.js` (ampliar)
- `frontend/src/components/ThemeToggle.jsx` (nuevo)
- `frontend/src/components/ThemeToggle.module.css` (nuevo)
- `frontend/src/components/Header.jsx` (integrar toggle)
- `frontend/src/context/AuthContext.jsx` (leer preferencia al inicio)
- `frontend/src/components/DataTable.jsx` (eliminar colores hardcodeados)

---

## 10. Feedback optimista en acciones CRUD

### Estado actual

- El flujo actual para cualquier acción CRUD es: click → petición HTTP → esperar respuesta → actualizar estado local → mostrar toast.
- Durante la espera, el botón de submit se desactiva (ModalView: `isSubmitting`).
- Si falla, se muestra `toast.error()`.
- **No hay actualización optimista**: el usuario siempre espera a la respuesta del servidor.

### Problema

En acciones frecuentes (marcar asistencia, cambiar calificación), el retardo entre click y feedback visual crea una sensación de lentitud. El usuario queda esperando 200-500ms sin saber si su acción se registró.

### Solución propuesta

Actualizar la UI inmediatamente al hacer click (optimistic update) y revertir si la petición falla.

### Implementación

1. **Crear hook** `frontend/src/hooks/useOptimisticUpdate.js`:
   - Recibir: `currentData`, `updateFn` (API call), `rollbackFn`.
   - Flujo: actualizar estado local → disparar petición → si error, revertir estado + toast.error.
   - Exponer: `optimisticUpdate(newData, apiCall)`.
2. **Aplicar en AsistenciaModal.jsx** (caso más beneficiado):
   - Al marcar "presente"/"ausente", actualizar el checkbox inmediatamente.
   - Si falla, revertir el estado y mostrar toast.
3. **Aplicar en acciones de eliminación**:
   - Eliminar la fila de la tabla inmediatamente.
   - Si falla, re-insertarla con toast de error.
4. **Aplicar en edición inline** (si se implementa en el futuro).

### Archivos afectados

- `frontend/src/hooks/useOptimisticUpdate.js` (nuevo)
- `frontend/src/pages/` — páginas que se beneficien (AsistenciaModal, Tareas, Calificaciones)

---

## 11. Indicador de progreso en formularios largos

### Estado actual

- Los formularios CRUD se renderizan como un único bloque de campos dentro de un `ModalView`.
- `Usuarios.jsx` tiene: nombre, apellidos, email, contraseña, roles (multi-select), centro, avatar — todo en una sola vista.
- `Matriculas.jsx` es más simple: solo alumno y grupo (2 campos).
- **No hay stepper, wizard ni división en pasos.**

### Problema

Los formularios con muchos campos (Usuarios, configuraciones de centro) pueden intimidar al usuario. Sin indicación de progreso, no sabe cuántos campos quedan. En mobile, un formulario largo requiere mucho scroll dentro del modal.

### Solución propuesta

Componente `FormStepper` para dividir formularios largos en pasos. Solo aplicable a formularios con 5+ campos. Los formularios simples (2-3 campos) no lo necesitan.

### Implementación

1. **Crear componente** `frontend/src/components/FormStepper.jsx` + `FormStepper.module.css`:
   - Barra horizontal con pasos numerados y labels.
   - Paso actual resaltado con `--color-primary-500`.
   - Pasos completados con checkmark.
   - Botones "Anterior" / "Siguiente" / "Guardar" (el último paso).
2. **Dividir Usuarios.jsx** en pasos:
   - Paso 1: Datos personales (nombre, apellidos, email).
   - Paso 2: Seguridad (contraseña, roles).
   - Paso 3: Asociación (centro, avatar).
3. **Validación por paso**: validar los campos del paso actual antes de avanzar al siguiente.
4. **Integrar con ModalView** como contenido del cuerpo del modal.

### Archivos afectados

- `frontend/src/components/FormStepper.jsx` (nuevo)
- `frontend/src/components/FormStepper.module.css` (nuevo)
- `frontend/src/pages/Usuarios.jsx` (reestructurar formulario)
- Otras páginas con formularios complejos (si aplica)

---

## 12. Notificaciones en tiempo real

### Estado actual

- `NotificationList.jsx` obtiene las notificaciones por **polling** con `setInterval` en el intervalo configurado en `POLLING_INTERVAL_NOTIFICATIONS` (definido en `config/api.js`).
- Fetch estándar a la API: `GET /api/mensajes?leido=false`.
- Los mensajes se agrupan por remitente.
- Badge de contador de no leídos en el icono del Header.
- **No hay WebSocket ni SSE (Server-Sent Events).**

### Problema

El polling tiene latencia inherente (el usuario no ve mensajes nuevos hasta el siguiente intervalo) y genera tráfico innecesario cuando no hay novedades. En una plataforma educativa donde los mensajes pueden ser urgentes (cambio de horario, cancelación de clase), el retardo es un problema real.

### Solución propuesta

Migrar a **Mercure** (hub SSE integrado con Symfony/API Platform) o implementar SSE custom. Mercure es la opción natural para un stack Symfony.

### Implementación

1. **Backend — Configurar Mercure**:
   - Añadir servicio Mercure al `docker-compose.yml`.
   - Instalar `symfony/mercure-bundle`.
   - Configurar hub URL y JWT secret.
   - Publicar eventos al crear/actualizar mensajes, asistencia, tareas.
2. **Backend — Publicar eventos**:
   - En los procesadores de estado de Mensaje, Asistencia, Tarea: publicar update en topic correspondiente.
   - Topics: `/users/{userId}/notifications`, `/grupos/{grupoId}/updates`.
3. **Frontend — Suscribirse a Mercure**:
   - Crear hook `useMercure(topic)` que abra un `EventSource`.
   - Integrar en `NotificationList.jsx`: escuchar nuevos mensajes en tiempo real.
   - Mantener polling como fallback si Mercure no está disponible.
4. **Frontend — Actualizar UI**:
   - Actualizar badge en Header al recibir evento.
   - Mostrar toast para notificaciones urgentes.
   - Actualizar DataTable si hay cambios en la entidad visible.

### Archivos afectados

- `docker-compose.yml` (añadir Mercure)
- `backend/config/packages/mercure.yaml` (nuevo)
- `backend/src/` — procesadores de estado (modificar)
- `frontend/src/hooks/useMercure.js` (nuevo)
- `frontend/src/components/NotificationList.jsx` (modificar)
- `frontend/src/components/Header.jsx` (badge en tiempo real)

---

## 13. Onboarding / Tour guiado

### Estado actual

- **No existe ningún sistema de onboarding.** No hay tours, tooltips de primera vez, ni guías interactivas.
- No se detecta si es la primera vez que un usuario accede a la plataforma.
- No hay dependencia de librerías de tour (driver.js, intro.js, shepherd.js).

### Problema

Los nuevos usuarios (especialmente profesores que se incorporan a mitad de curso) no tienen guía sobre cómo usar la plataforma. Deben descubrir funcionalidades por su cuenta o recibir formación externa.

### Solución propuesta

Tour interactivo ligero usando `driver.js` (librería ~5KB). Se activa la primera vez que cada rol accede. Puede relanzarse desde un botón "Ayuda".

### Implementación

1. **Instalar dependencia**: `npm install driver.js`.
2. **Crear hook** `frontend/src/hooks/useOnboarding.js`:
   - Comprobar `localStorage` key `loggex-onboarding-{userId}-{role}`.
   - Si no existe, activar tour al montar.
   - Marcar como completado al finalizar.
3. **Definir tours por rol** `frontend/src/config/onboardingSteps.js`:
   - **Admin**: Sidebar → Centros → Usuarios → Configuración.
   - **Profesor**: Sidebar → Horarios → Tareas → Asistencia → Mensajes.
   - **Alumno**: Sidebar → Mi Horario → Tareas → Materiales → Mensajes.
4. **Integrar en Home.jsx**:
   - Ejecutar `useOnboarding()` al montar.
   - El tour resalta elementos del DOM con `data-tour="sidebar"`, `data-tour="horarios"`, etc.
5. **Botón "Repetir tour"** en Perfil o Header (icono `HelpCircle`).

### Archivos afectados

- `package.json` (nueva dependencia)
- `frontend/src/hooks/useOnboarding.js` (nuevo)
- `frontend/src/config/onboardingSteps.js` (nuevo)
- `frontend/src/pages/Home.jsx` (integrar)
- `frontend/src/components/Sidebar.jsx`, `Header.jsx` (añadir `data-tour` attrs)

---

## 14. Drag & Drop en Horarios

### Estado actual

- `TimeTable.jsx` renderiza una cuadrícula semanal con bloques horarios.
- Los bloques se muestran con `rowSpan` calculado según duración.
- La interacción actual es **solo click**: al hacer click en un bloque se abre un modal con detalles (hora, grupo, aula, profesor).
- Los profesores pueden registrar asistencia desde ese modal.
- En mobile se usa vista accordion por día.
- **No hay drag and drop.** Los horarios se crean/editan desde el formulario CRUD de Horarios, no desde la vista visual.

### Problema

Crear horarios mediante formularios es tedioso: hay que elegir día, hora inicio, hora fin, módulo, grupo y aula en un formulario. Un editor visual drag-and-drop sería mucho más intuitivo y rápido, especialmente al organizar el horario completo de un centro.

### Solución propuesta

Añadir capacidad drag-and-drop al TimeTable para roles Admin y Profesor. Permitir arrastrar bloques existentes para cambiar hora/día, y crear nuevos bloques arrastrando sobre celdas vacías.

### Implementación

1. **Instalar dependencia**: `@dnd-kit/core` y `@dnd-kit/sortable` (~15KB total).
2. **Crear componente** `DraggableTimeBlock.jsx`:
   - Envolver cada bloque horario con `useDraggable`.
   - Preview visual durante el arrastre (sombra + opacidad).
   - Restricciones: solo dentro de la misma semana.
3. **Crear componente** `DroppableTimeSlot.jsx`:
   - Cada celda vacía del TimeTable es droppable.
   - Highlight visual al pasar un bloque por encima.
4. **Lógica de reubicación**:
   - Al soltar: calcular nuevo día y hora a partir de la posición.
   - Verificar conflictos (misma aula, mismo profesor, misma hora).
   - Si no hay conflicto: `PATCH /api/horarios/{id}` con los nuevos valores.
   - Si hay conflicto: toast de warning y revertir posición.
5. **Crear nuevos bloques**:
   - Click-and-drag sobre celdas vacías para seleccionar rango horario.
   - Al soltar: abrir modal de creación con día y hora pre-rellenados.
6. **Permisos**: solo habilitado para `ROLE_ADMIN` y `ROLE_PROFESOR`. Alumnos ven vista estática.
7. **Mobile**: mantener vista accordion actual (drag no es viable en pantallas pequeñas).

### Archivos afectados

- `package.json` (nuevas dependencias)
- `frontend/src/components/DraggableTimeBlock.jsx` (nuevo)
- `frontend/src/components/DroppableTimeSlot.jsx` (nuevo)
- `frontend/src/components/TimeTable.jsx` (reestructurar para DnD)
- `frontend/src/components/TimeTable.module.css` (estilos de drag)

---

## Notas finales

- Las mejoras están ordenadas por impacto y esfuerzo. Se recomienda abordarlas de arriba a abajo.
- Cada mejora es independiente y puede implementarse por separado.
- Las mejoras de prioridad Alta/Bajo esfuerzo (1, 4, 5) pueden completarse en una sola iteración.
- Las mejoras de prioridad Baja/Alto esfuerzo (12, 14) deben planificarse como features de sprint completo.
- Actualizar la columna **Estado** de la tabla resumen conforme se vayan implementando.
