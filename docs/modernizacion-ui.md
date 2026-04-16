# Modernización UI — Loggex v02

Registro vivo de la modernización visual/interactiva de la interfaz. Sirve como **estado actual** + **hoja de ruta** + **manual de uso de los plugins** asociados.

> ⚠️ **REGLA DE ORO — NO ROMPER LOS TEMAS**
> La página `Configuracion.jsx` es un editor de tema **en vivo**: el usuario elige ~80+ variables CSS (colores, opacidades, radios, blur, fondos animados, paginación...) que se inyectan dinámicamente vía `frontend/src/utils/theme.js` sobre `:root`.
>
> **Prohibido:**
> - Hardcodear colores hex en componentes (excepto semánticos: success/error/warning).
> - Definir valores fijos para fondos, bordes, radios, sombras de componentes que el usuario tematiza.
> - Cambiar nombres de variables existentes (`--bg-card`, `--color-primary-*`, `--bg-sidebar`, etc.).
>
> **Permitido:**
> - Añadir tokens de **motion** (durations, easings) — son ortogonales al tema.
> - `color-mix(in srgb, var(--color-primary-500), …)` para derivados sutiles (focus rings, hovers).
> - Sombras en capas (incluyendo inset highlights con `color-mix(white X%, transparent)`).
> - Tipografía, espaciado, micro-interacciones, animaciones, focus-visible.

---

## Plugins instalados (Claude Code)

Dos plugins se usan obligatoriamente en cualquier tarea de UI:

### 1. `ui-ux-pro-max` (`nextlevelbuilder/ui-ux-pro-max-skill`)

**Propósito:** guía de diseño / UX. Aporta:
- 99 reglas de UX organizadas por prioridad (accesibilidad → animación → forms…)
- Catálogo de estilos, paletas, tipografías, patrones por tipo de producto
- Tokens de motion estándar (duraciones, easings)

**Cuándo invocar:** *antes* de tocar código, para **planificar** lenguaje visual, decidir easings/duraciones, validar accesibilidad y patrones de interacción.

**Cómo invocar:** `Skill ui-ux-pro-max:ui-ux-pro-max` con argumentos describiendo el contexto y restricciones.

### 2. `frontend-design` (`claude-plugins-official`)

**Propósito:** generación de código frontend con calidad de producción, evitando "estética genérica de IA".

**Cuándo invocar:** *después* de planificar con `ui-ux-pro-max`, para **producir** los cambios concretos en JSX/CSS.

**Cómo invocar:** `Skill frontend-design:frontend-design` con spec detallado (qué archivos, qué patrones, qué restricciones).

### Flujo recomendado por tarea de modernización

1. **Mapear** el componente y sus dependencias anidadas (Glob + Read).
2. **Plan con `ui-ux-pro-max`** → obtener directrices de motion/elevación/microinteracciones que respeten el sistema de temas.
3. **Implementación con `frontend-design`** → CSS Modules + JSX mínimos.
4. **Verificar HMR** sin errores (`docker compose logs frontend --tail`).
5. **Anotar** lo aplicado en este documento (sección "Implementado").

---

## Tokens de motion (globales)

Declarados en `frontend/src/index.css` dentro de `:root`. **Reutilizar siempre estos tokens**, no inventar valores nuevos:

```css
--dur-fast: 150ms;       /* hovers micro, active feedback */
--dur-base: 220ms;       /* transiciones estándar */
--dur-slow: 320ms;       /* entradas, transiciones de panel */
--dur-exit: 160ms;       /* salidas (más rápidas que entradas) */

--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);    /* entradas suaves */
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1); /* spring playful */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);      /* Material standard */
```

Patrón obligatorio:

```css
@media (prefers-reduced-motion: reduce) {
  /* desactivar animaciones/transformaciones */
}
```

---

## Implementado

### `Configuracion.jsx` + `Configuracion.module.css`

- Tab buttons: indicador pill animado (`::before` con `scaleY` + `--ease-out-back`), hover `translateX(2px)`, active `scale(0.97)`, stagger entry 30ms via `--i` inline.
- Tab content: animación `tabPanelIn` (fade + slide 8px) usando `key={activeTab}`.
- Preview wrap: misma animación con `key={activeTab + '-preview'}`.
- Cards (`formSection`, `previewBox`): hover lift `translateY(-1px)` + shadow `--shadow-md` + border shift hacia `--color-primary-200` + inset highlight glassmorphism.
- Inputs: focus ring 3px con `color-mix` sobre `--color-primary-500`. Color swatch escala 1.06 al hover.
- Theme cards: stagger 50ms via `--i` (índice), hover lift `translateY(-3px)` + shadow `--shadow-lg`, button preview `scaleX(1.08)`.
- iconButton: hover `scale(1.08)` + shadow primary, active `scale(0.92)`, focus-visible.
- Mensajes (`.message`): `slideInDown` + box-shadow.
- `prefers-reduced-motion`: bloque completo.

### `Button.module.css`

- Transiciones explícitas con tokens (no `all`).
- Focus-visible: ring 3px primary.
- `:active scale(0.96)` (antes 0.9, demasiado agresivo).
- Inset highlight en variantes `primary` y `danger`.
- Estado `:disabled` con `opacity: 0.55` + `cursor: not-allowed`.

### `CrudHeader.module.css`

- Title con `letter-spacing: -0.015em`.
- Stagger entry: `titleGroup` → `middle` (60ms) → `actions` (120ms).
- Logo container: `scale(1.05) rotate(-2deg)` al hover sobre `titleGroup`.

### `DataTable.module.css`

- Container con inset highlight + shadow suave.
- `pageButton`: hover `translateY(-1px)` + shadow, active `scale(0.95)`, focus-visible ring.
- `select`: focus ring primary.
- `mobileRow` hover lift + tinte primary sutil con `color-mix`.
- `pageNumber` con `font-variant-numeric: tabular-nums`.
- `sortIcon` y `emptyState` con animación de entrada.

### `ModalView.jsx` + `ModalView.module.css`

**CSS:**
- Overlay con `backdrop-filter: blur(8px)` + color vía `color-mix(--color-gray-900, 55%)` (antes: `rgba(15,23,42,0.55)` hardcoded).
- Scale entry con `--ease-out-back` (efecto spring).
- `closeButton` con `rotate(90deg)` en hover, `scale(0.92)` en active, focus-visible ring `color-mix(--color-primary-500, 38%)`.
- Header icon con `scale(1.08) rotate(-3deg)` al hover sobre el handle de arrastre.
- Inset highlight + shadow lg en `modalContent`.
- Scroll shadow en `modalBody` via `mask-image` (fade 12px top/bottom).
- `scrollbar-gutter: stable` en body → evita jumps al aparecer scrollbar.
- Footer con `box-shadow: inset 0 1px 0` sutil para separación visual.
- `modalContent:focus` sin outline (recibe foco programático al abrir, pero no debe mostrar ring).

**JSX (a11y + focus management):**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` enlazado al título vía `useId()`.
- `aria-label` en el botón de cerrar (nueva clave `modal.close` en los 5 idiomas).
- `aria-hidden="true"` en icono del header y en el `<X/>` decorativo.
- **Auto-focus** al abrir: enfoca el primer elemento focuseable del modal (input/button/etc.) o el propio contenedor si no hay ninguno.
- **Restore focus** al cerrar: devuelve el foco al trigger original (`document.activeElement` guardado al abrir).
- **Focus trap**: Tab/Shift+Tab ciclan dentro del modal (primer ↔ último focusable).
- **Body scroll lock**: `document.body.style.overflow = 'hidden'` mientras el modal es visible; se restaura al desmontar.
- Fix del gap de animación de cierre: timeout `300ms` → `180ms` (coincide con `--dur-exit` + margen).

### `AccordionView.module.css`

- Item entry stagger via `:nth-child` (sin tocar JSX).
- Inset highlight + shadow lift en hover/open.
- Chevron con `--ease-out-back`.
- Content con animación de entrada al abrir.

### `LoadingView.module.css`

- Fade-in del contenedor + pulse sutil (1.6s) del texto.

### `index.css`

- Bloque de **MOTION TOKENS** añadido en `:root`.

### `index.css` — Focus-visible global

- Selector universal para `button`, `a`, `input`, `select`, `textarea`, `summary`, `[role="button"]`, `[tabindex]`.
- Ring 2px con `color-mix(--color-primary-400, 72%)` + `outline-offset: 2px`.
- Regla `:focus:not(:focus-visible) { outline: none }` para eliminar el outline nativo al click/tap.
- Los CSS Modules locales ganan por especificidad y siguen pudiendo pisar este estilo.

### `Skeleton.jsx` + `Skeleton.module.css` (nuevos)

Primitiva reusable con shimmer adaptativo. Exportes:

- **`Skeleton`** — bloque individual. Props: `width`, `height`, `variant` (`line` | `rect` | `circle`).
- **`TableSkeleton`** — repite filas `<tr>`/`<td>` con ancho variable; se usa dentro de `<tbody>`.
- **`MobileListSkeleton`** — tarjetas con header (circle + line) + 2 líneas de contenido.

Implementación:

- Color vía `color-mix(currentColor, transparent N%)` → adapta automáticamente a light/dark sin tocar tokens.
- Shimmer con `background-size: 200%` + `animation: skeletonShimmer 1.4s linear infinite`.
- Stagger de entrada por `:nth-child` (40ms) en `TableSkeleton`, (50ms) en `MobileListSkeleton`.
- `prefers-reduced-motion`: desactiva shimmer (`background` plano) y stagger.

Integrado en `DataTable.jsx`: ambos `<LoadingView />` (vista escritorio + móvil) sustituidos por `TableSkeleton` / `MobileListSkeleton`. El número de filas en tabla respeta `itemsPerPage` (máx 8). `LoadingView` sigue disponible para las páginas que lo importan directamente.

### Tabs horizontales (`Calificaciones.module.css`)

Las clases `.tabBar` / `.tab` / `.tabActive` / `.tabCount` / `.tabContent` viven en `Calificaciones.module.css` pero se reutilizan en 6 archivos (`HorariosAdmin`, `Fechas`, `MisCalificaciones`, `CalificacionesAdmin`, `CalificacionesDetalle`, `CalificacionesGrupo`) — modernizarlas aquí afecta a todos los tabs del sistema.

- `.tabBar`: `flex-wrap: wrap`, `min-width: 0`, `border-bottom: 1px` (antes `2px` grueso).
- `.tab`: posición relative + `isolation: isolate`, `border-radius` superior, `white-space: nowrap`, transiciones con tokens motion.
- **Underline pill animado** (`::after`): barra de 2px que escala con `scaleX(0) → scaleX(1)` + `--ease-out-back` (spring sutil) al activar. Sustituye el `border-bottom-color` que saltaba.
- **Hover**: tinte `color-mix(--color-primary-500, 8%)` + color más oscuro.
- **Active**: `scale(0.97)` (press feedback).
- **Focus-visible**: ring 2px `color-mix(--color-primary-400, 72%)` con offset — ahora alcanzable por teclado.
- `.tabContent`: animación migrada a `--dur-slow --ease-out-quart backwards` (antes `0.22s ease-out`; `backwards` evita stacking context residual).
- `.tabCount`: transiciones con tokens para el cambio de color al activar.
- `prefers-reduced-motion`: desactiva animaciones y fija el pill `scaleX(1)`.

### `CrudHeader` prop `stackActionsEarly` (headers densos)

Páginas con muchos controles (actualmente `HorariosEditor`) llevaban a que `.middle` (tabs) se partiera en dos líneas cuando `.actions` competía por espacio en la misma fila.

- Nueva prop `stackActionsEarly` (boolean) en `CrudHeader`.
- Cuando activa, en la franja **1101–1600px** el grid pasa de `auto 1fr auto` → `auto 1fr` y `.actions` ocupa la segunda fila completa (`grid-column: 1 / -1`) con `justify-content: flex-end`.
- Por encima de 1600px siguen cabiendo las 3 columnas en una línea.
- Por debajo de 1100px ya aplicaba la media query general que apila todo.
- Activada en `HorariosEditor.jsx`.
- **Reparto izquierda/derecha**: cuando `.actions` ocupa fila completa, el primer `<button>` hijo directo lleva `margin-left: auto` → los divs previos (filtros como `ThemedSelect`) quedan a la izquierda y los botones posteriores se alinean a la derecha. En viewports anchos, donde todo queda compacto al final de la fila, no tiene efecto visible.

### Filtros del `CrudHeader` adaptativos (shrink-before-overflow)

Regla: los filtros del header (`.actions`, `.middle`) tienen un **tamaño mínimo** pero se **encogen antes que desbordar**. Nunca provocan scroll horizontal; si siguen sin caber, wrappan a nueva línea.

**`CrudHeader.module.css`:**
- `.actions` y `.middle` → `flex-wrap: wrap`, `gap: var(--space-2) var(--space-3)` (row/column), `min-width: 0`.
- `.actions > *` y `.middle > *` → `min-width: 0; max-width: 100%` (permite shrink, límite al 100% del padre). Cada hijo mantiene su propio `flex` para no forzar comportamientos ajenos.
- Eliminado el antiguo `flex-wrap: nowrap` que forzaba scroll horizontal.

**`ThemedSelect.jsx` + `ThemedSelect.module.css`:**
- El prop `minWidth` se aplica al `.container` (antes iba al `<button>` trigger).
- `.container` → `display: inline-flex; max-width: 100%`; el botón interno ocupa `width: 100%`.
- Resultado: el componente tiene un mínimo respetado, pero cuando el padre flex le dice "encoge", encoge hasta ese mínimo sin desbordar.

**`SearchBar.module.css`:**
- `.container` → `flex: 0 1 auto; width: 280px; min-width: 180px; max-width: 320px`.
- Ancho "deseado" fijo para que el search no devore espacio y fuerce wrap innecesario del resto del header. Encoge hasta 180px antes de wrappar.
- `.inputWrapper` → `flex: 1 1 0; min-width: 0` para que el input interno pueda encoger sin resistirse al min-content del placeholder.

### Scrollbars flotantes globales (`index.css` + `theme.js`)

**Regla:** los scrolls **siempre** son flotantes — track transparente, thumb delgado translúcido, sin reservar layout estable. Independiente del tema.

**`index.css`** — fallback global:
- `scrollbar-width: thin` + `scrollbar-color: color-mix(currentColor, 22%) transparent` (Firefox).
- `::-webkit-scrollbar { width: 10px; background: transparent }` + track/corner transparentes.
- Thumb con `border: 2px solid transparent` + `background-clip: padding-box` → pista 10px pero thumb visible ~6px, efecto flotante.
- Hover y active intensifican el thumb (`currentColor` 22% → 42% → 55%).
- `currentColor` se adapta solo a light/dark sin tokens dedicados.
- `overscroll-behavior: none` en html/body — sin bounce ni pull-to-refresh.

**`theme.js`** — inyección dinámica actualizada:
- Misma "forma" flotante (track transparente, pill thumb, padding transparente).
- Acepta `scrollbarWidth`, `scrollbarThumbColor`, `scrollbarHoverColor` del tema (defaults con `currentColor`).
- `scrollbarTrackColor` queda ignorado (track siempre transparent para mantener el efecto flotante).
- Fix: `scrollbar-width` siempre fue `'auto'` por bug ternario — ahora fijo a `thin`.

Retirado `scrollbar-gutter: stable` de `ModalView.modalBody` y `Crud.textarea` (reservaba espacio aunque no hubiera overflow — contrario a flotante).

### `index.css` — Tokens de input

Añadidos al bloque de variables de personalización:
```css
--text-input: var(--text-main);
--border-input: var(--border-color);
--input-focus-border: var(--color-primary-500);
--input-focus-shadow: color-mix(in srgb, var(--color-primary-500) 22%, transparent);
--input-hover-bg: color-mix(in srgb, var(--bg-input) 95%, var(--text-main) 5%);
```
Antes estos eran sólo fallbacks en `var(... , fallback)` — ahora se resuelven a un valor concreto y pueden tematizarse.

### `Crud.module.css` — Inputs, selects y checkboxes unificados

- **`.input`, `.select`, `.textarea`** (nueva clase): altura unificada `min-height: 38px` (matchea `ThemedSelect`), `box-sizing: border-box`, `font-family: inherit`, transiciones con tokens motion (`--dur-base`, `--dur-fast`, `--ease-standard`).
- **Hover**: border con tinte primary + fondo `--input-hover-bg`. Sólo cuando `:not(:focus):not(:disabled)`.
- **Focus**: border → `--input-focus-border`, ring 3px con `--input-focus-shadow` (tokenizado). `outline: none` en `:focus-visible` local para evitar el doble anillo con el global de `index.css`.
- **Disabled**: `opacity: 0.55`, `cursor: not-allowed`, fondo mix con `--text-muted`.
- **`aria-invalid="true"`**: borde + ring rojos con `color-mix` sobre `--color-error`.
- **Placeholder**: color `--text-muted` + `opacity: 0.8`.
- **`.textarea`**: `min-height: 96px`, `resize: vertical`, `scrollbar-gutter: stable` para evitar jumps.
- **`.select`**: `appearance: none`, chevron SVG con `currentColor`, `padding-right: 2.25rem`, `cursor: pointer`.
- **`.label`**: `letter-spacing: 0.005em`.
- **`.fileInput`**: cursor pointer, color `--text-muted`. El `::file-selector-button` usa tokens (`--bg-input`, `--border-input`), hover con `--input-hover-bg` + tinte primary, `scale(0.97)` al pulsar.
- **`.checkboxLabel`**: convertida en área pulsable con `padding` + `border-radius` + hover tint primary 8%. `input[type="checkbox"]` con `accent-color: var(--color-primary-500)` y tamaño fijo 16×16.
- **`.errorContainer`**: `#fef2f2` hardcoded → `color-mix(--color-error, 10%)` + inset highlight para look más pulido.

### `ThemedSelect.jsx` + `ThemedSelect.module.css` (refactor a portal)

Problema raíz resuelto: el `.dropdown` se posicionaba `position: absolute` dentro del `.container` del componente. Cualquier ancestor con `overflow: hidden` (p.ej. `.container` del `DataTable`) o con stacking context activo (p.ej. `.actions` del `CrudHeader` durante animación) clipeaba o atrapaba el popup.

**Solución:**
- El `.dropdown` se renderiza vía `createPortal(document.body)` con `position: fixed` + `top/left/bottom` calculados desde `getBoundingClientRect()` del trigger.
- **Auto-flip**: nueva prop `placement` (`'auto' | 'top' | 'bottom'`, default `'auto'`). Con `auto`, si no hay espacio abajo y hay más arriba, abre hacia arriba (variante `.openUp` con `tsSlideUp` y `transform-origin: bottom`).
- `maxHeight` dinámico: se ajusta al espacio disponible en viewport.
- Se cierra al scroll de cualquier ancestor (listener con `capture: true`) para evitar que quede desalineado.
- `z-index: 10010` → por encima de modales (`1000`) para que también funcione dentro de modales.
- `Esc` cierra y devuelve foco al trigger.
- A11y: `role="listbox"` en dropdown, `role="option"` + `aria-selected` en items, `aria-haspopup="listbox"` + `aria-expanded` en trigger.
- `prefers-reduced-motion`: sin animación de slide.

### `DataTable.jsx` — swap del paginador

- `<select>` nativo HTML del paginador sustituido por `<ThemedSelect>` → consistencia visual con los filtros del `CrudHeader`.
- `placement="top"` en `paginationBottom` y `placement="bottom"` en `paginationTop` (evita que el dropdown salga fuera de viewport en el paginador inferior).
- Borrado `handleItemsPerPageChange` huérfano; `onItemsPerPageChange` llamado directamente con el valor.

### `Sidebar.module.css`

- **Indicador activo:** barra acento izquierda (`::before` pill 3px) con `scaleY` y `--ease-out-back`; en colapsado desplazada a `left: 4px` y altura reducida para lecturabilidad.
- **Tinte activo/hover:** vía `color-mix(in srgb, var(--color-primary-500) 10–14%, transparent)` — respeta tokens tematizables (`--bg-sidebar-active/hover`).
- **Hover ítem:** `translateX(2px)` + icono `scale(1.08)`, `--dur-fast` `--ease-standard`.
- **Press ítem:** `translateX(2px) scale(0.97)` (colapsado: `scale(0.94)` sin translate).
- **Stagger entry:** `:nth-child(1..10)` con `animation-delay` en pasos de 40ms, `translateX(-8px) → 0`, `--dur-slow` `--ease-out-quart`.
- **Colapso/expansión:** transición explícita de `width` + `padding` con `--dur-slow --ease-out-quart` (antes: `width 0.3s ease`).
- **`collapseBtn`:** hover `scale(1.08)` + halo primary 22% + sombra md; active `scale(0.92)`; focus-visible ring 2px. En colapsado, halo plano.
- **Focus-visible global en ítems:** ring 2px `color-mix(--color-primary-400, 75%)` con `outline-offset: 2px`.
- **Scroll shadow:** `mask-image` con fade top/bottom 14px en `.accordionContent` abierto — el contenido largo se difumina en los extremos.
- **Logout (footer):** hover con tinte error 16% + texto/icono desplazados hacia `--color-error`, icono con `rotate(-6deg)`. Neutro en reposo para no gritar "destructivo" permanentemente (regla `destructive-nav-separation` aplicada por contraste de color, no por énfasis constante).
- **Overlay móvil:** `backdrop-filter: blur(6px)` + scrim `color-mix(black, 48%)` (dentro del rango WCAG 40–60%), con animación `overlayIn`.
- **Sidebar móvil:** animación `slideInLeft` migrada a `--dur-slow --ease-out-quart`, sombra lateral suavizada con `color-mix`.
- **`prefers-reduced-motion`:** bloque completo que preserva el cambio de color pero desactiva `transform`, `animation-delay` y `animation-duration`; fuerza indicador activo estático y `opacity: 1` sin stagger.

---

## Sugerido (pendiente, sin implementar)

Agrupado por impacto. **Cualquier implementación debe seguir** el flujo `ui-ux-pro-max` → `frontend-design`.

### Componentes que faltan tocar (alto impacto)

1. ~~`Sidebar`~~ ✅ hecho.
2. `Layout` — header global, transiciones entre páginas (route transitions con React Router).
3. Inputs genéricos: ~~`ThemedSelect`~~ ✅ portal + auto-flip. ~~`.input`/`.select`/`.textarea`/`.fileInput`/`.checkboxLabel` en `Crud.module.css`~~ ✅ unificados con tokens. Pendientes afinar `ThemedNumberInput`, `SearchBar` (ya usan tokens parcialmente).
4. `UserAvatar` — fallback sin foto, presence indicator opcional.

### Componentes específicos del dominio académico

5. `TimeTable` — celdas con micro-interacciones, hover sobre eventos, indicador de "ahora" (línea horizontal pulsante).
6. `CalendarView` — días con animación al cambiar mes, festivos destacados.
7. `EventCard` / `UserCard` / `EventsSidebar` — hover lift, click feedback.
8. Widgets dashboard (`TablonWidget`, `UpcomingEventsWidget`, `PendingTasksWidget`) — entrada en cascada, skeletons, empty states ilustrados.

### Sistema / cross-cutting

9. ~~**Skeleton loaders**~~ ✅ hecho en `DataTable`; falta aplicarlos a widgets del dashboard.
10. `NotificationList` / Toasts — stacking, swipe-to-dismiss, animación de entrada coherente con motion tokens.
11. ~~**Focus-visible global**~~ ✅ hecho en `index.css`.
12. **Tabular nums** en columnas numéricas (calificaciones, horas, paginación) — evitar saltos de layout.
13. **Scroll shadow** en tablas/sidebar con overflow.
14. **Empty states** consistentes con ilustración SVG monocroma + CTA.

### Tipografía (cambio mayor opcional)

15. **Variable font** (Inter Variable / Geist) cargada vía `@font-face` o Google Fonts.
16. Revisar escala tipográfica (`--text-*`) en `index.css`.

### Patrones modernos (cambio mayor opcional)

17. Command palette (Cmd+K).
18. Tooltips unificados (a11y + descubrimiento).
19. Page transitions entre rutas.
20. Optimistic UI en formularios.

### Packs sugeridos para iteración guiada

- **Pack A (visual, impacto inmediato):** Sidebar + Inputs genéricos + Skeleton loaders + Focus-visible global.
- **Pack B (dominio):** TimeTable + CalendarView + Widgets dashboard.
- **Pack C (sistema):** Tipografía variable + Tabular nums + Scroll shadow + Empty states.

---

## Checklist al modernizar un nuevo componente

- [ ] Mapeé el componente + sus dependencias anidadas.
- [ ] Invoqué `ui-ux-pro-max` para directrices.
- [ ] Invoqué `frontend-design` para generar el código.
- [ ] Reutilicé los tokens `--dur-*` y `--ease-*` (sin inventar).
- [ ] No hardcodeé ningún hex (salvo success/error/warning semánticos).
- [ ] Usé `color-mix` sobre `--color-primary-*` para derivados.
- [ ] Añadí bloque `@media (prefers-reduced-motion: reduce)`.
- [ ] Añadí estados `:focus-visible` con ring primary.
- [ ] Verifiqué HMR sin errores (`docker compose logs frontend`).
- [ ] Probé el componente con un tema personalizado (no defaults).
- [ ] Anoté lo aplicado en la sección **Implementado** de este doc.
