# Sistema de toasts (notificaciones efímeras)

Documentación interna del sistema de feedback efímero implementado sobre **sonner**. Sirve como referencia para extender el uso a nuevas funciones sin tener que reconstruir el contexto cada vez.

---

## 1. Qué es y por qué

Antes del refactor, la app usaba `alert()` nativo del navegador (56 ocurrencias en 22 archivos) para mostrar errores y confirmaciones. Problemas:

- Bloquea el hilo principal hasta que el usuario pulse "OK".
- Estilo del SO, imposible de tematizar.
- Solo soporta un mensaje; no distingue éxito/error/aviso.
- Rompe el flujo visual de la SPA.

El nuevo sistema usa la librería **sonner** (~5 KB gzipped) con un wrapper propio que:

- Muestra notificaciones no bloqueantes en la esquina inferior derecha.
- Distingue entre `success` / `error` / `warning` / `info` / `loading` con colores semánticos.
- **Hereda el tema activo del centro** (radio, colores, fondo) vía CSS variables.
- Soporta título + descripción para un patrón UX consistente.

---

## 2. Archivos clave

| Archivo | Rol |
|---|---|
| `frontend/src/utils/toast.js` | Wrapper público. Punto de entrada único |
| `frontend/src/styles/toast.css` | Overrides de las CSS vars internas de sonner, mapeadas al tema |
| `frontend/src/utils/theme.js` | Defaults de colores semánticos + inyección en CSS vars |
| `frontend/src/App.jsx` | Montaje del `<Toaster />` raíz |
| `frontend/src/main.jsx` | Import del CSS global |

---

## 3. Uso básico

### Importar

```js
import { toast, parseErrorResponse } from '../utils/toast';
```

### Tipos de toast

```js
toast.success('Usuario creado');
toast.error('Ya existe un usuario con ese email');
toast.warning('Selecciona un grupo antes de continuar');
toast.info('Se ha actualizado el calendario');
toast.loading('Subiendo archivo…');
toast.message('Mensaje neutro');          // sin color semántico
```

### Con descripción (patrón recomendado para errores)

```js
toast.error(err.message, {
    description: 'No se ha podido crear el usuario'
});
```

### Promise (muestra loading → success/error automáticamente)

```js
toast.promise(
    fetch('/api/algo'),
    {
        loading: 'Guardando…',
        success: 'Guardado correctamente',
        error: 'No se pudo guardar'
    }
);
```

### Cerrar manualmente

```js
const id = toast.loading('Procesando…');
// …
toast.dismiss(id);
```

---

## 4. Patrón UX: título + descripción

**La regla**: título = *qué pasó* (específico), descripción = *qué acción fallaba* (contexto).

Esto evita frases redundantes como *"Error al guardar: Ya existe un usuario con ese email"*.

### Ejemplos

| Situación | Título (`toast.error(TÍTULO, ...)`) | Descripción |
|---|---|---|
| Email duplicado al crear usuario | `"Ya existe un usuario con ese email"` | `"No se ha podido crear el usuario"` |
| Error 500 al actualizar grupo | `"Error en el servidor. Inténtalo de nuevo en unos instantes"` | `"No se ha podido actualizar el grupo"` |
| Validación local (nota fuera de rango) | `"La nota debe estar entre 0 y 10"` | *(sin descripción, usar `toast.warning`)* |
| Éxito | `"Usuario creado"` | *(sin descripción)* |

El título se alimenta de dos fuentes:

1. **Mensaje del backend** si la response JSON tiene `message`, `detail`, `error` o `hydra:description` — prioridad máxima.
2. **Mapeo amigable por código HTTP** si no hay mensaje (ver `parseErrorResponse` abajo).

---

## 5. `parseErrorResponse(response, fallback?)`

Helper para extraer un mensaje humano de cualquier `Response` de fetch, **nunca explota** (ni siquiera si el backend devuelve HTML o body vacío).

### Lógica interna

1. Intenta leer el body como texto. Si vacío → fallback por status.
2. Intenta `JSON.parse` del texto. Busca en orden: `hydra:description`, `message`, `detail`, `error`. Si encuentra → lo devuelve.
3. Si no era JSON (p. ej. página HTML de error de Symfony dev), mapea por status HTTP a una frase humana.
4. Si el status no está mapeado y es ≥ 500 → *"Error en el servidor. Inténtalo de nuevo en unos instantes"*.
5. Último recurso → el fallback pasado como argumento, o *"No se ha podido completar la operación"*.

### Mapeo por status

| HTTP | Mensaje |
|---|---|
| 400 | La solicitud no es válida |
| 401 | Tu sesión ha expirado. Vuelve a iniciar sesión |
| 403 | No tienes permisos para realizar esta acción |
| 404 | No se ha encontrado el recurso |
| 409 | Ya existe un registro en conflicto |
| 413 | El archivo es demasiado grande |
| 422 | Los datos introducidos no son válidos |
| 429 | Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo |
| ≥ 500 | Error en el servidor. Inténtalo de nuevo en unos instantes |

### Uso típico

```js
try {
    const response = await fetch(url, { method: 'POST', body: data, credentials: 'include' });
    if (!response.ok) {
        const message = await parseErrorResponse(response);
        throw new Error(message);
    }
    await fetchData();
    toast.success('Recurso creado');
} catch (err) {
    toast.error(err.message, { description: 'No se ha podido crear el recurso' });
}
```

Para endpoints donde se quiere un fallback específico en vez del genérico:

```js
const message = await parseErrorResponse(response, t('module.errorDelete'));
```

---

## 6. Tematización

El toast **debe respetar el tema activo del centro**. Esto es innegociable.

### Vars de tema (definidas en `theme.js` defaults)

| Variable JSON del centro | CSS var inyectada | Default |
|---|---|---|
| `toastSuccessColor` | `--toast-success` | `#10b981` (emerald) |
| `toastErrorColor` | `--toast-error` | `#ef4444` (red) |
| `toastWarningColor` | `--toast-warning` | `#f59e0b` (amber) |
| `toastInfoColor` | `--toast-info` | `primaryColor` del centro si no se define |

### Cómo se mapean a sonner

`toast.css` sobrescribe las CSS vars internas de sonner con nuestras vars. Los fondos se calculan con `color-mix` para obtener un tinte del color semántico sobre el fondo de widget — así el toast queda coherente pase el centro lo que pase.

```css
[data-sonner-toaster] {
    --normal-bg: var(--widget-bg);
    --success-bg: color-mix(in srgb, var(--toast-success) 10%, var(--widget-bg));
    --success-text: var(--toast-success);
    /* … */
}

[data-sonner-toaster] [data-sonner-toast] {
    border-radius: var(--border-radius) !important;
    font-family: inherit;
    backdrop-filter: var(--elements-blur, none);
}
```

Esto significa que, sin tocar código JS, si cambias `borderRadius` o `widgetBgColor` en la personalización del centro los toasts se adaptan automáticamente.

### Personalizar colores por centro

En la BD de personalización, basta con enviar cualquiera de los cuatro campos `toastSuccessColor` / `toastErrorColor` / `toastWarningColor` / `toastInfoColor` para sobrescribir el default.

---

## 7. Configuración del `<Toaster />`

Montado en `App.jsx` dentro de los providers:

```jsx
<Toaster
    position="bottom-right"
    richColors
    closeButton
    expand={false}
    toastOptions={{ duration: 4000 }}
/>
```

- **`position`** — esquina de la pantalla. Otras: `top-left`, `top-right`, `bottom-center`, etc.
- **`richColors`** — activa los colores semánticos usando las CSS vars overrideadas.
- **`closeButton`** — muestra la X para cerrar manualmente.
- **`duration`** — 4 s antes de auto-descartar (excepto `loading`, que es persistente hasta que lo resuelvas).

Para cambiar globalmente: editar `App.jsx`. Para un toast puntual con duración distinta: pasar `{ duration: N }` en la opción del toast.

---

## 8. Guía: añadir toast a una función nueva

Pasos para un endpoint CRUD estándar:

### a) Importar

```js
import { toast, parseErrorResponse } from '../utils/toast';
```

### b) Manejar el éxito

Tras un `fetch` que devuelve `ok`:

```js
toast.success(editing
    ? t('recurso.updatedSuccess', { defaultValue: 'Recurso actualizado' })
    : t('recurso.createdSuccess', { defaultValue: 'Recurso creado' }));
```

### c) Manejar el error con parseo defensivo

```js
if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new Error(message);
}
```

Y en el `catch`:

```js
toast.error(err.message, {
    description: editing
        ? t('recurso.errorUpdating', { defaultValue: 'No se ha podido actualizar el recurso' })
        : t('recurso.errorCreating', { defaultValue: 'No se ha podido crear el recurso' })
});
```

### d) Validaciones locales → warning

Cuando el usuario introduce algo inválido pero aún no se ha llamado al backend:

```js
if (parseFloat(nota) < 0 || parseFloat(nota) > 10) {
    toast.warning(t('grades.gradeRange', { defaultValue: 'La nota debe estar entre 0 y 10' }));
    return;
}
```

---

## 9. Convenciones de claves i18n

Para mantener el patrón consistente en todo el proyecto:

| Clave | Uso |
|---|---|
| `<modulo>.createdSuccess` | Toast verde al crear |
| `<modulo>.updatedSuccess` | Toast verde al actualizar |
| `<modulo>.deletedSuccess` | Toast verde al borrar |
| `<modulo>.errorCreating` | Descripción del toast rojo al crear |
| `<modulo>.errorUpdating` | Descripción del toast rojo al actualizar |
| `<modulo>.errorDeletingCtx` | Descripción del toast rojo al borrar |

Todas las claves se pasan con `defaultValue` para que el sistema siga funcionando aunque aún no estén traducidas. Cuando se quieran añadir al fichero de locales, basta con añadir la clave con la traducción correspondiente.

---

## 10. Backend: garantizar respuestas JSON

El frontend asume que los errores del backend vienen como JSON. Si un endpoint devuelve HTML (página de error de Symfony) o body vacío en un error, `parseErrorResponse` lo detecta y cae al mapeo por status — el usuario nunca ve *"Unexpected token '<'"* ni *"Error 500"* pelado, pero sí pierde la especificidad del mensaje.

**Recomendación para nuevos controladores**: envolver `persist`/`flush` en try/catch y devolver siempre JSON, incluso en errores. Ejemplo de `AdminUserController::handleForm()`:

```php
try {
    $entityManager->persist($user);
    $entityManager->flush();
} catch (UniqueConstraintViolationException $e) {
    return $this->json(['message' => 'Ya existe un usuario con ese email'], Response::HTTP_CONFLICT);
} catch (\Throwable $e) {
    return $this->json(
        ['message' => 'No se ha podido guardar el usuario: ' . $e->getMessage()],
        Response::HTTP_INTERNAL_SERVER_ERROR
    );
}
```

Y antes del flush, detectar conflictos conocidos (p. ej. uniques) y devolver `409` con mensaje semántico — así el usuario ve *"Ya existe un usuario con ese email"* en el toast, no el mensaje genérico *"Ya existe un registro en conflicto"* que produciría el mapeo por status.

---

## 11. Cambiar de librería (si algún día hace falta)

Todo el proyecto importa **solo** de `utils/toast.js`. Si algún día se quiere sustituir sonner por otra lib (react-hot-toast, notistack, o una solución propia) basta con:

1. Cambiar la implementación interna de `utils/toast.js` para que delegue en la nueva lib manteniendo la misma firma pública (`success`, `error`, `warning`, `info`, `loading`, `promise`, `dismiss`, `message`).
2. Reemplazar `<Toaster />` de sonner por el equivalente de la nueva lib en `App.jsx`.
3. Ajustar el CSS de tematización en `styles/toast.css` para que mapee las CSS vars del tema a las que exponga la nueva lib.

El resto del código (22 archivos que consumen `toast.*`) no necesita tocarse.

---

## 12. Refactor pendiente — unificar el sistema de toasts (registrado 2026-04-28)

### Problema

Hoy conviven dos sistemas de toasts en la app:

1. **Genérico (sonner via `utils/toast.js`)** — descrito en este documento. Usado por la mayoría de handlers (PATCHs, DELETEs, validaciones de formulario). Aparece arriba-derecha o abajo-derecha según config de sonner.
2. **Local del editor de horarios** — `frontend/src/pages/HorariosEditor.module.css:1172` clase `.errorToast`. Componente fixed bottom-right que se renderiza con `setDragError(msg)` (JSX en `HorariosEditor.jsx:3074-3078`). Estilo: `var(--color-error)` de fondo, blanco texto, slide-in animation. Lo dispara el solver cuando devuelve "Propuesta parcial. Sin colocar..." o el drag-drop al rechazar un placement (profe ocupado, materia llena, celda ocupada).

El usuario (sesión 2026-04-28) prefiere visualmente el estilo del **`.errorToast` local**: bloque grande con fondo de color semántico saturado y mensaje contundente. Lo señaló como ejemplo a seguir y pidió un equivalente verde para `success`.

### Plan de unificación

**Objetivo**: un único sistema de toasts coherente con el tema, ubicación bottom-right, tonos semánticos saturados (no solo borde + texto), tipografía consistente.

**Estrategia**:
- Mantener `utils/toast.js` como punto de entrada único (firma pública intacta).
- Cambiar el `<Toaster />` de sonner para que use el estilo del `.errorToast` actual:
  - Background: `var(--color-success/error/warning/info)` saturado al 100%.
  - Color de texto: blanco (`#fff` o `var(--text-special, #fff)`).
  - Position: bottom-right.
  - Animación: slide-in desde abajo (`@keyframes toastSlide` ya existe en HorariosEditor.module.css, mover a global).
  - Border-radius: `var(--radius-md)`.
  - Box-shadow themed con `color-mix(--color-gray-900 18%)`.
- Mover los keyframes y la base styling a `frontend/src/styles/toast.css` (que ya existe con overrides de sonner).
- Eliminar `.errorToast` local de HorariosEditor.module.css.
- Cambiar todos los `setDragError(msg)` a `toast.error(msg, { duration: 6000 })` o similar. Eliminar el state `dragError` y su render JSX.

### Tareas concretas (cuando se aborde)

1. **Auditar usos actuales** del sistema genérico — sonner ya tiene success/error/warning/info; pintar todos en el estilo nuevo.
2. **Auditar usos del `.errorToast`** — buscar `setDragError` en `HorariosEditor.jsx` y migrar a `toast.error`.
3. **Refactor del CSS** — `frontend/src/styles/toast.css` recibe los estilos finales (saturados, bottom-right, etc).
4. **Eliminar duplicación** — borrar `.errorToast` de `HorariosEditor.module.css` y el state `dragError`.
5. **Barrer acciones que aún no avisan** — añadir feedback visual donde falte. Ya identificadas (sesión 2026-04-28):
   - `handleClearActiveRange` (limpia placements del PL activo, sin toast).
   - Drag/drop de placement válido en rejilla — sólo notifica error en violation, no éxito.
   - Otras CRUD handlers donde haga falta.
6. **Tipografía y escala** — alinear con el resto del tema.

### Esfuerzo estimado

~0.5 sesión. Bajo riesgo (cambio puramente cosmético + barrido de usos), alta visibilidad (afecta a toda la app).

### Prioridad

Media. No bloquea producto; mejora coherencia visual y feedback. Recomendable hacerlo antes del primer despliegue a centro real.
