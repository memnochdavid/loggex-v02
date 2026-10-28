# Selects con búsqueda en servidor (`AsyncSearchSelect`)

Documentación interna del sistema de selects que reemplazan a los `<select>` nativos en los modales CRUD cuando la colección puede crecer sin límite (alumnos, profesores, grupos…).

---

## 1. Por qué existe

### El problema con los selects nativos

Los modales CRUD del proyecto cargaban toda la colección al abrirse y la pintaban como `<option>`s en un `<select>` nativo. Esto resultó tener dos defectos graves:

1. **Bug de paginación silencioso.** El frontend pasaba `?pagination=false` esperando recibir todos los registros, pero `api_platform.yaml` no tenía `pagination_client_enabled: true`. La API ignoraba ese parámetro y devolvía solo 20 elementos por defecto. Cualquier elemento creado más allá del puesto 20 simplemente *desaparecía* del select sin error visible. Detectado por primera vez en el modal de Matriculas: se creaba un alumno nuevo y no aparecía al matricularlo. (Hoy ya está activado `pagination_client_enabled` y `pagination=false` se respeta — pero ver el siguiente punto.)
2. **No escala.** Aunque `pagination=false` ya funciona, traer todos los usuarios/grupos/módulos en una sola petición se vuelve caro a partir de unos cientos. Con 2000 alumnos en un centro hablamos de 3-5 MB de JSON-LD por petición, render lento y un dropdown de 2000 `<option>` que nadie va a scrollear. El umbral de molestia empieza alrededor de 300-500 entradas.

### La solución

Un componente `<AsyncSearchSelect>` que:

- Recibe el endpoint del recurso, no la lista de items.
- Busca en servidor con debounce conforme el usuario escribe.
- Pide siempre lotes pequeños (20 por defecto).
- Mantiene la apariencia del resto de selects del proyecto (mismo trigger que `ThemedSelect`, mismos tokens de tema).

Acompañado de un filtro backend genérico (`SearchAnyFilter`) que acepta `?q=texto` y aplica `LIKE %texto%` con OR sobre los campos declarados en cada entidad.

---

## 2. Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│                                                      │
│   <AsyncSearchSelect endpoint="/api/users" .../>     │
│            │                                         │
│            └─► fetch /api/users?q=ivan&rol_app=...   │
│                                                      │
└──────────────────────────────┬───────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────┐
│                     BACKEND                          │
│                                                      │
│   #[ApiFilter(SearchAnyFilter::class,                │
│       properties: ['nombre', 'apellidos', 'email'])] │
│   class User { ... }                                 │
│                                                      │
│   ?q=ivan se traduce en SQL a:                       │
│     WHERE LOWER(nombre)    LIKE '%ivan%'             │
│        OR LOWER(apellidos) LIKE '%ivan%'             │
│        OR LOWER(email)     LIKE '%ivan%'             │
└──────────────────────────────────────────────────────┘
```

| Pieza | Ruta | Rol |
|---|---|---|
| `SearchAnyFilter` | `backend/src/Doctrine/Filter/SearchAnyFilter.php` | Filtro API Platform genérico, parametrizable por entidad |
| `AsyncSearchSelect` | `frontend/src/components/AsyncSearchSelect.jsx` | Componente React reutilizable |
| `AsyncSearchSelect.module.css` | mismo dir | Estilos coherentes con `ThemedSelect` |
| `api_platform.yaml` | `backend/config/packages/` | `pagination_client_enabled: true` (necesario para que `?pagination=false` se respete en otros sitios) |

---

## 3. Backend: añadir el filtro a una nueva entidad

```php
use App\Doctrine\Filter\SearchAnyFilter;

#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'apellidos', 'email'])]
class MiEntidad { ... }
```

- `properties`: lista de los campos sobre los que aplicar `LIKE %q%` con OR.
- Soporta tanto **campos directos** (`'nombre'`) como **paths con joins implícitos** (`'profesor.nombre'`, `'imparticion.modulo.nombre'`, …). Cada segmento se sanitiza como identificador SQL (`/[^a-zA-Z0-9_]/`) por seguridad. Para los paths, el filtro añade `LEFT JOIN`s con alias deterministas (`sa_<segmento>`) y reutiliza el mismo alias entre propiedades que comparten prefijo (p. ej. `'profesor.nombre'` y `'profesor.apellidos'` solo joinean `profesor` una vez).
- El parámetro de cliente siempre es `q`. No es configurable a propósito (consistencia entre entidades).

> **Aviso sobre el formato de `properties`** — API Platform normaliza internamente la lista plana `['nombre', 'apellidos']` a un mapping `['nombre' => null, 'apellidos' => null]` (espera el formato del `SearchFilter` estándar). Por eso `SearchAnyFilter::apply()` itera detectando si la clave es `int` (lista) o `string` (mapping). Si extiendes este filtro o escribes uno parecido, **no asumas un formato fijo**: lee la clave si es string y el valor si es int. Pasarlo por alto es lo que provocó el primer bug histórico (sección 8).

### Entidades ya configuradas

| Entidad | Campos buscables |
|---|---|
| `User` | `nombre`, `apellidos`, `email`, `nif` |
| `Grupo` | `nombre`, `abreviatura`, `anioEscolar` |
| `Modulo` | `nombre`, `abreviatura`, `codigoOficial` |
| `Centro` | `nombre`, `cif`, `direccion` |
| `CicloFormativo` | `nombre` |

### Tras añadir el filtro

```bash
sudo ./scripts/clear_cache_hard.sh
```

Este script borra `var/cache/dev`, ejecuta `cache:clear` **y reinicia el contenedor backend**. El restart es imprescindible: API Platform compila la metadata en un container PHP con un hash único (`ContainerXXX/`), y el opcache de Apache mantiene referencias al hash anterior. Sin reinicio, Apache busca clases en una carpeta de caché que ya no existe → error 500. Esto provocó el segundo bug histórico (sección 8).

### Verificación de que el filtro está vivo

```bash
sudo docker compose exec backend php bin/console debug:container | grep -i SearchAnyFilter
```

Deberías ver al menos:
- `App\Doctrine\Filter\SearchAnyFilter` (el servicio base)
- Una entrada `annotated_app_entity_<entidad>_app_doctrine_filter_search_any_filter` por cada entidad que use el filtro.

Si tienes dudas sobre los argumentos que recibió:

```bash
sudo docker compose exec backend php bin/console debug:container annotated_app_entity_user_app_doctrine_filter_search_any_filter
```

`Arguments: Array (N element(s))` te dice cuántos campos están bindeados.

---

## 4. Frontend: usar el componente

### API mínima

```jsx
import AsyncSearchSelect from '../components/AsyncSearchSelect';

<AsyncSearchSelect
    name="alumno"
    value={formData.alumno}
    onChange={(v) => setFormData(p => ({ ...p, alumno: v }))}
    endpoint="/api/users"
    extraParams={{ rol_app: 'alumno' }}
    getOptionLabel={(a) => `${a.nombre} ${a.apellidos} (${a.email})`}
    getOptionValue={(a) => a.id || a['@id']?.split('/').pop()}
    placeholder="Selecciona alumno"
    required
/>
```

### Props completas

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `value` | `string` \| `number` | — | Valor actual (id o IRI) del elemento seleccionado |
| `onChange` | `(value, item) => void` | — | Handler de selección. El primer argumento es el value (id). El segundo es el item completo del API (o `null` al limpiar). Útil para cascadas: `onChange={(v, grupo) => setGrupoFilter(extractCiclo(grupo))}` |
| `endpoint` | `string` | — | URL relativa del recurso (p. ej. `/api/users`) |
| `extraParams` | `object` | `{}` | Query params fijos que siempre acompañan a `q` (p. ej. `{ rol_app: 'alumno', centro: 3 }`) |
| `getOptionLabel` | `(item) => string` | `item.label ?? String(item.id)` | Cómo mostrar cada opción |
| `getOptionValue` | `(item) => string` | `item.id` | Cómo extraer el value de cada opción |
| `placeholder` | `string` | `"Buscar…"` | Texto cuando no hay valor |
| `minQueryLength` | `number` | `0` | Caracteres antes de buscar. 0 = busca también al abrir |
| `itemsPerPage` | `number` | `20` | Tamaño de página enviado a la API |
| `disabled` | `bool` | `false` | Deshabilita el control |
| `required` | `bool` | `false` | Marca el input oculto como required |
| `name` | `string` | — | Atributo name (para validación nativa) |
| `placement` | `'auto' \| 'top' \| 'bottom'` | `'auto'` | Dirección de apertura del dropdown |

### Comportamiento

- Al hacer click se abre un dropdown con buscador, anclado vía portal a `document.body` (escapa de `overflow:hidden` y stacking contexts).
- Si `minQueryLength = 0`, al abrir ya hace una primera petición sin `q` → muestra los primeros 20 resultados.
- Cada tecla en el input dispara debounce de 300ms y luego un fetch a `${endpoint}?q=${query}&itemsPerPage=20${extraParams}`.
- Si el usuario tipea rápido, las peticiones anteriores se abortan (`AbortController`).
- Navegación: `↑/↓` mueve el cursor, `Enter` selecciona, `Escape` cierra.
- Botón ✕ para limpiar el valor.
- Si se monta con un `value` ya seleccionado (caso edición), hace un GET puntual al recurso individual para hidratar el label.

---

## 5. Recipe: migrar un `<select>` nativo a `AsyncSearchSelect`

Toma como ejemplo el alumno del modal de Matriculas. Antes:

```jsx
<select
    name="alumno"
    value={formData.alumno}
    onChange={handleInputChange}
    className={styles.select}
    required
>
    <option value="">{t('common.selectStudent')}</option>
    {alumnos.map(a => (
        <option key={a.id} value={a.id}>
            {a.nombre} {a.apellidos} ({a.email})
        </option>
    ))}
</select>
```

Después:

```jsx
<AsyncSearchSelect
    name="alumno"
    value={formData.alumno}
    onChange={(v) => setFormData(p => ({ ...p, alumno: v }))}
    endpoint="/api/users"
    extraParams={{ rol_app: 'alumno' }}
    getOptionLabel={(a) => `${a.nombre} ${a.apellidos} (${a.email})`}
    getOptionValue={(a) => a.id || a['@id']?.split('/').pop()}
    placeholder={t('common.selectStudent')}
    required
/>
```

Pasos checklist:

1. ☐ Añadir `import AsyncSearchSelect from '../components/AsyncSearchSelect';`.
2. ☐ Cambiar el `onChange` para que actualice el formData explícitamente. La firma es `(value) => void`, **no recibe un evento**. Lo más natural es `onChange={(v) => setFormData(p => ({ ...p, campo: v }))}`.
3. ☐ Mover los filtros que ibas pasando en la URL (`rol_app=alumno`, `centro=X`) a `extraParams`.
4. ☐ Definir `getOptionLabel` y `getOptionValue` con la forma que quieres mostrar y el value que envías al backend en el submit.
5. ☐ Eliminar la `useState`/fetch del array de items si ya no se usa en otra parte de la página. **Cuidado**: a veces el array también se usa en filtros de cabecera o en columnas de la tabla — en ese caso no lo borres, solo lo deja de necesitar el modal.
6. ☐ Si la entidad aún no tiene `#[ApiFilter(SearchAnyFilter::class, ...)]`, añádelo (sección 3).
7. ☐ Lanzar `sudo ./scripts/clear_cache_hard.sh` para que el filtro entre en vigor.
8. ☐ Verificación rápida sin abrir el navegador (con sesión iniciada en otra pestaña o cookies guardadas):
   ```bash
   curl -k -s -b cookies.txt 'https://localhost:9443/api/users?q=ivan&rol_app=alumno' | head -c 300
   ```
   Debe devolver pocos resultados (filtrados). Si devuelve los 20 default, el filtro no se está aplicando — revisa la sección 8.
9. ☐ Probar el modal: crear un registro nuevo (alumno, módulo, centro, lo que toque) y verificar que aparece al buscarlo por nombre/apellido en el modal de la entidad relacionada.

---

## 6. Estado de migración

### Selects ya migrados a `AsyncSearchSelect`

| Página | Modal | Campos |
|---|---|---|
| `Matriculas.jsx` | Nueva/editar matrícula | `alumno`, `grupo` |
| `Modulos.jsx` | Nuevo/editar módulo | `ciclo` |
| `CiclosFormativos.jsx` | Nuevo/editar ciclo | `centro` (solo SuperAdmin) |
| `Festivos.jsx` | Nuevo/editar festivo | `centro` (opcional, solo SuperAdmin) |
| `Grupos.jsx` | Nuevo/editar grupo | `ciclo`, `centro` (centro solo SuperAdmin) |
| `Imparticiones.jsx` | Nueva/editar impartición | `profesor`, `grupo`, `modulo` (con cascada Grupo→Módulo) |
| `Horarios.jsx` | Nuevo/editar horario | `imparticion` |

### Casos analizados que NO necesitaban migración

| Página | Razón |
|---|---|
| `TablonWidget.jsx` (Comunicados) | El centro se decide con un toggle "global sí/no" que asigna automáticamente el centro del usuario; no hay `<select>` |
| `Configuracion.jsx` (Personalización) | El centro se infiere del usuario actual; no hay selector |
| `Entregas.jsx` | Las imparticiones se muestran como accordion (no select); las tareas se gestionan dentro de la imparticion ya visible |
| `MisFaltas.jsx` / `AsistenciaModal.jsx` | Sin `<select>` de gran cardinalidad |

### Patrón de cascada (caso `Imparticion` en `Imparticiones.jsx`)

El select de **módulo** depende del **grupo** seleccionado: solo módulos del mismo ciclo y curso. Implementación de referencia:

1. El `onChange` del grupo recibe el item completo (segundo argumento del callback) y guarda `{ciclo, curso}` en un estado local `grupoFilter`.
2. El `AsyncSearchSelect` del módulo pasa `grupoFilter.ciclo` y `grupoFilter.curso` como `extraParams`, y se marca `disabled` mientras no haya grupo.
3. En modo edición, `handleOpenModal` hace un `fetch` puntual del grupo para hidratar `grupoFilter` (si no, el modal abriría con módulo libre y la cascada estaría rota).

Backend: añadido `'curso' => 'exact'` al `SearchFilter` de `Modulo` para soportar el filtrado.

### Selects de `Imparticion` en otras páginas

`Imparticion` no tiene campos de texto propios (es una tabla puente profesor↔módulo↔grupo). El `SearchAnyFilter` se ha extendido para soportar paths con `.` (joins implícitos), declarado así en la entidad:

```php
#[ApiFilter(SearchAnyFilter::class, properties: [
    'profesor.nombre', 'profesor.apellidos',
    'modulo.nombre', 'modulo.abreviatura', 'modulo.codigoOficial',
    'grupo.nombre', 'grupo.abreviatura'
])]
```

El filtro hace `LEFT JOIN` lazy con alias deterministas (`sa_<segmento>`) reutilizados entre propiedades del mismo path, y aplica `OR` con `LIKE %q%` sobre cada hoja. Funciona tanto para campos directos como con cualquier profundidad de relación (siempre que cada segmento sea un identificador SQL válido).

---

## 7. Tradeoffs y limitaciones conocidas

- **Una petición por keystroke (debounced).** A 300ms de debounce y la mayoría de usuarios tecleando ~150ms entre teclas, se hace una sola petición al final de cada palabra. Aceptable. Si fuese problema, subir el debounce a 400-500ms.
- **Sin cache entre aperturas.** Cada vez que se abre el dropdown se vuelve a pedir la primera página. No es caro (~20 items, ms a la base de datos), pero si lo fuera, se podría memoizar resultados con `useMemo` por `(endpoint, extraParams, query)`.
- **`SearchAnyFilter` solo busca campos directos.** No soporta `relacion.campo` (joins). Si una entidad necesita buscar a través de una relación, hay que extender el filtro o usar el `SearchFilter` estándar de API Platform en paralelo.
- **El componente no soporta multi-select.** Si se necesita en algún momento, se puede añadir como prop `multiple` que mantenga un array de items en lugar de uno solo.
- **No hay paginación dentro del dropdown.** Solo se ven los primeros `itemsPerPage` resultados de la búsqueda. Esto es deliberado: si el usuario no encuentra lo que busca tras 20 candidatos, debe afinar la query, no scrollear infinito.

---

## 8. Bugs históricos (no los repitas)

Mientras se montó este sistema aparecieron tres trampas bien escondidas. Quedan documentadas para que cualquier futuro trabajo (extender el filtro, añadirlo a una nueva entidad, escribir otro componente parecido) no caiga en las mismas.

### Bug 1 — `properties` flat se convierte en mapping con `null`s

- **Síntoma:** todas las queries `?q=...` llegaban al backend, el filtro se invocaba (lo verificamos con `error_log` en `apply()`), pero **no filtraba nada**: la respuesta era idéntica para `q=n`, `q=no`, `q=noa`. El log mostraba `properties={"nombre":null,"apellidos":null,...}`.
- **Causa:** API Platform interpreta el atributo `#[ApiFilter(X::class, properties: ['nombre', 'apellidos'])]` como el formato del `SearchFilter` estándar, donde `properties` es un mapping `propiedad => strategy`. Convierte la lista plana a `['nombre' => null, 'apellidos' => null, ...]` antes de pasarla al constructor de tu filtro. Un `foreach ($this->properties as $field)` sobre eso recoge los **valores** (`null`), no las claves.
- **Fix aplicado:** `SearchAnyFilter::apply()` itera con `foreach ($this->properties as $key => $val)` y hace `$field = is_int($key) ? $val : $key`. Soporta los dos formatos.
- **Lección:** si extiendes este filtro o escribes otro parecido, **nunca asumas que `$this->properties` es una lista plana**. Lee la clave si es string.

### Bug 2 — `cache:clear` sin reiniciar Apache

- **Síntoma:** tras añadir `#[ApiFilter(SearchAnyFilter::class, ...)]` a varias entidades y ejecutar `clear_cache_hard.sh`, las peticiones empezaban a devolver **500 Internal Server Error** con texto del tipo `require(/var/www/html/var/cache/dev/ContainerKuAnnvO/getApiPlatform_State_ErrorProviderService.php): Failed to open stream`.
- **Causa:** el script borraba `var/cache/dev` y volvía a generar el container PHP, pero el **opcache de Apache** dentro del contenedor seguía referenciando rutas del container antiguo. Apache cargaba clases buscándolas en una carpeta `ContainerXXX/` que ya no existía.
- **Fix aplicado:** `clear_cache_hard.sh` (y el `.bat`) ahora ejecutan `docker compose restart backend` al final. Esto reinicia Apache y libera el opcache.
- **Lección:** cualquier cambio en metadata de API Platform (nuevos filtros, cambios en `#[ApiResource]`, cambios en `#[ApiFilter]`) requiere reinicio del contenedor además del `cache:clear`. Si alguna vez añades un script que regenere caché, incluye el restart.

### Bug 3 — `?pagination=false` ignorado por defecto en API Platform

- **Síntoma:** se creaba un alumno nuevo (id 78) y al ir a `/matriculas → Nueva matrícula`, **no aparecía en el `<select>`** de alumnos. Antes de que existiera `AsyncSearchSelect`, el código pasaba `?pagination=false&rol_app=alumno` esperando recibir todos los alumnos del centro. La API devolvía siempre 20.
- **Causa:** `api_platform.yaml` no tenía `pagination_client_enabled: true`, así que el parámetro `pagination=false` se ignoraba silenciosamente y la API paginaba a 20. El alumno con id 78 caía fuera de la primera página y nunca se mostraba.
- **Fix aplicado:** activar `pagination_client_enabled: true` en `api_platform.yaml`.
- **Lección:** este flag debe estar siempre activo en este proyecto. Si en el futuro alguien lo desactiva (por seguridad, por ejemplo, para que clientes externos no puedan pedir 1M de items), hay que migrar simultáneamente cualquier sitio que use `pagination=false` a `AsyncSearchSelect` o a paginación explícita.

### Bug 4 — Foco perdido en portales montados condicionalmente

- **Síntoma:** abrías el modal de Matriculas, hacías click en el dropdown del `AsyncSearchSelect`, **escribías "ivan" y no pasaba nada**. Las teclas se las comía algún sitio (probablemente el botón "Guardar"). En consola, aviso de Chrome: *"Blocked aria-hidden on an element because its descendant retained focus. Element with focus: <button._button_..._primary_...>"*.
- **Causa:** mi `handleOpen()` hacía `setOpen(true)` y a continuación `setTimeout(() => inputRef.current?.focus(), 0)`. Pero el portal del dropdown está condicionado a `{open && pos && createPortal(...)}` y `pos` se calcula en un `useLayoutEffect` posterior. En el primer render con `open=true` el portal todavía no se monta, así que `inputRef.current` es `null` cuando el setTimeout dispara. `?.focus()` falla silenciosamente. Sin foco en el input, las teclas no actualizan `query`, no se dispara fetch debounced, y el dropdown nunca se actualiza.
- **Fix aplicado:** un `useEffect([open, pos])` aparte que enfoca el input **cuando ya están ambos a `true`** (es decir, cuando el portal está realmente montado).
- **Lección:** si copias este patrón portal-en-doble-render para otro componente, el foco inicial **no puede** disparase desde el handler que abre — tiene que disparase desde un effect que reaccione al estado "portal listo".

### Diagnóstico cuando algo no funciona

Pasos en este orden:

1. **¿La petición sale con `?q=`?** Network tab del navegador. Si no sale ninguna petición nueva al teclear → bug en el frontend (probablemente foco, ver bug 4).
2. **¿La petición devuelve menos resultados al filtrar?** Si devuelve siempre el mismo tamaño de payload → backend no está filtrando.
3. **¿Está el filtro registrado?** `debug:container | grep SearchAnyFilter`. Debe haber un servicio por entidad afectada.
4. **¿`apply()` se invoca?** Añade temporalmente `error_log('[SearchAnyFilter] q=' . ($context['filters']['q'] ?? 'null'))` al inicio del método, lanza una búsqueda, y mira `docker compose logs backend | grep SearchAnyFilter`.
5. **¿`$this->properties` tiene los campos correctos?** Mismo error_log, pero pintando `json_encode($this->properties)`. Si aparecen como `{"nombre":null,...}` y tu iteración esperaba lista plana → bug 1.
6. **¿La caché está limpia y el contenedor reiniciado?** `sudo ./scripts/clear_cache_hard.sh`. Si tras eso aparecen 500s → es probable que el restart no se haya hecho.
