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

### `ModalView.module.css`

- Overlay con `backdrop-filter: blur(6px)` (antes 2px).
- Scale entry con `--ease-out-back` (efecto spring).
- closeButton: `rotate(90deg)` en hover, focus-visible ring.
- Header icon: scale + rotación leve al hover sobre el handle de arrastre.
- Inset highlight + shadow lg en `modalContent`.

### `AccordionView.module.css`

- Item entry stagger via `:nth-child` (sin tocar JSX).
- Inset highlight + shadow lift en hover/open.
- Chevron con `--ease-out-back`.
- Content con animación de entrada al abrir.

### `LoadingView.module.css`

- Fade-in del contenedor + pulse sutil (1.6s) del texto.

### `index.css`

- Bloque de **MOTION TOKENS** añadido en `:root`.

---

## Sugerido (pendiente, sin implementar)

Agrupado por impacto. **Cualquier implementación debe seguir** el flujo `ui-ux-pro-max` → `frontend-design`.

### Componentes que faltan tocar (alto impacto)

1. `Sidebar` — refinar item activo (indicador animado), hover, sub-items, scroll.
2. `Layout` — header global, transiciones entre páginas (route transitions con React Router).
3. Inputs genéricos: `ThemedSelect`, `ThemedNumberInput`, `SearchBar` — focus rings unificados, hover, disabled, validación.
4. `UserAvatar` — fallback sin foto, presence indicator opcional.

### Componentes específicos del dominio académico

5. `TimeTable` — celdas con micro-interacciones, hover sobre eventos, indicador de "ahora" (línea horizontal pulsante).
6. `CalendarView` — días con animación al cambiar mes, festivos destacados.
7. `EventCard` / `UserCard` / `EventsSidebar` — hover lift, click feedback.
8. Widgets dashboard (`TablonWidget`, `UpcomingEventsWidget`, `PendingTasksWidget`) — entrada en cascada, skeletons, empty states ilustrados.

### Sistema / cross-cutting

9. **Skeleton loaders** — sustituir Lottie de carga por skeletons en `DataTable` y widgets (sensación de velocidad mucho mayor).
10. `NotificationList` / Toasts — stacking, swipe-to-dismiss, animación de entrada coherente con motion tokens.
11. **Focus-visible global** — anillo de foco unificado en `index.css` para inputs/links/buttons sin estilos propios.
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
