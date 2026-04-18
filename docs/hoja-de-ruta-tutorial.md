# Hoja de Ruta: Tutorial Interactivo de Onboarding

## Problema Actual

Loggex tiene muchas funciones distribuidas por rol (SuperAdmin, Admin, Profesor, Alumno) y hoy no hay nada que guíe al usuario al entrar por primera vez:

- Un alumno nuevo no sabe dónde ver sus tareas pendientes ni cómo entregar una.
- Un profesor no descubre que puede arrastrar imparticiones sobre la rejilla semanal en el editor de horarios.
- Un admin de centro no sabe que puede tematizar la interfaz desde Personalización.
- Funciones útiles (exportar PDF, firma digital, calendario de asistencia) se pasan por alto porque no tienen ruta de descubrimiento.

**Consecuencia:** curva de aprendizaje alta, dependencia de formación externa o captura de pantalla vía mensajería. El valor del producto se aprovecha parcialmente.

---

## Objetivo

Un sistema de tutoriales interactivos que:

1. **Se active automáticamente** la primera vez que un usuario entra a la app (con opción "saltar").
2. **Sea modular**: muchos mini-tours por tarea concreta, no uno monolítico. Cada tour cubre una feature (ej. "entregar una tarea", "crear un horario", "poner una nota").
3. **Se adapte al rol**: el alumno ve tours de alumno, el profesor los suyos, etc.
4. **Sea re-lanzable en cualquier momento** desde un menú de ayuda.
5. **Persista el progreso en el backend** por usuario, para que al cambiar de dispositivo o navegador no vuelva a salir lo ya visto.
6. **Sea resistente a cambios de UI**: usa atributos `data-tour="..."` sobre los elementos, no selectores CSS que se rompen al refactorizar.

---

## Arquitectura Objetivo

```
Frontend
  ├── TourProvider (Context)
  │      ├── carga tours disponibles del backend al login
  │      ├── consulta al usuario qué ha completado
  │      ├── expone: startTour(id), skipTour(id), currentTour
  │      └── escucha cambios de ruta: auto-lanza si está marcado isAutoStart
  │
  ├── <Tour /> (wrapper sobre react-joyride)
  │      ├── lee currentTour del provider
  │      ├── traduce steps (cada step tiene clave i18n)
  │      └── al terminar: POST /api/me/tutorials/:id/complete
  │
  ├── tours/ (registro de tours, JS/TS data)
  │      ├── common/primer-login.js        (todos los roles)
  │      ├── alumno/entregar-tarea.js
  │      ├── profesor/calificar.js
  │      ├── profesor/editor-horarios.js
  │      ├── admin/personalizar-centro.js
  │      └── ...
  │
  └── Menú "Ayuda" en Header
         └── lista todos los tours disponibles para el rol del usuario
             con indicador "ya visto" / "nuevo"

Backend
  ├── User.tutorialsCompleted (JSON column)
  │      array de strings: ["primer-login", "entregar-tarea", ...]
  │
  ├── POST /api/me/tutorials/:id/complete
  └── GET  /api/me/tutorials/status
         devuelve { completed: [...], available: [...] }
```

### Por qué react-joyride

| Opción | Pros | Contras |
|---|---|---|
| **react-joyride** ✅ | React-first, maneja posicionamiento / scroll / mask / focus, estilable, navegación entre páginas, beacons, soporte TypeScript | Dependencia JS (~15kB gz), API algo verbosa |
| driver.js | Framework-agnostic, muy ligero (~5kB gz), API simple | No integra con React lifecycle, manejo manual de pasos por página |
| shepherd.js | Muy completo | Más peso, orientado a Vue, integración React rocosa |
| Custom desde 0 | Control total, 0 deps | Mucho trabajo: z-index, scroll-into-view, responsive, a11y, foco, portales |

El proyecto ya usa React 19, CSS Modules, i18next, contextos (AuthContext, UIContext). `react-joyride` encaja sin fricción y se puede reestilar completamente con la paleta del centro (tematización dinámica ya funciona).

### Por qué `data-tour="..."` en vez de selectores CSS

```jsx
<button className={styles.submitBtn} data-tour="entregar-tarea-submit">
  Entregar
</button>
```

El tour referencia `[data-tour="entregar-tarea-submit"]`. Si alguien refactoriza el CSS Module y renombra `.submitBtn` a `.sendBtn`, el tour sigue funcionando. Los selectores de clase son detalle de implementación; los atributos `data-tour` son contrato explícito.

### Por qué mini-tours en vez de uno largo

Un tour de 25 pasos cansa y el usuario lo salta entero. Tours de 3-6 pasos por tarea concreta se completan, se recuerdan y se pueden re-ejecutar puntualmente cuando haces esa tarea meses después.

---

## Fases de Implementación

### Fase 1: MVP — un tour, persistencia local, menú de ayuda

**Objetivo:** probar el encaje del componente y el flujo básico con un solo tour completo. Persistencia solo en `localStorage` (sin backend todavía).

#### Dependencias

```bash
docker compose exec frontend npm install react-joyride
```

#### Componente `<Tour />`

```jsx
// frontend/src/components/Tour.jsx
import Joyride, { EVENTS, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useTour } from '../context/TourContext';

export default function Tour() {
    const { t } = useTranslation();
    const { currentTour, finishTour } = useTour();

    if (!currentTour) return null;

    const steps = currentTour.steps.map(s => ({
        target: `[data-tour="${s.targetId}"]`,
        content: t(s.contentKey),
        title: s.titleKey ? t(s.titleKey) : undefined,
        placement: s.placement || 'auto',
        disableBeacon: s.beacon === false,
    }));

    return (
        <Joyride
            steps={steps}
            run
            continuous
            showProgress
            showSkipButton
            locale={{
                back: t('tour.back'),
                close: t('tour.close'),
                last: t('tour.last'),
                next: t('tour.next'),
                skip: t('tour.skip'),
            }}
            styles={{
                options: {
                    primaryColor: 'var(--primary-color)',
                    textColor: 'var(--text-color)',
                    backgroundColor: 'var(--card-bg)',
                    arrowColor: 'var(--card-bg)',
                    zIndex: 10000,
                },
            }}
            callback={(data) => {
                const { status, type } = data;
                if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
                    finishTour(status === STATUS.FINISHED ? 'completed' : 'skipped');
                }
            }}
        />
    );
}
```

#### TourContext

```jsx
// frontend/src/context/TourContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import { tourRegistry } from '../tours';

const TourContext = createContext(null);

export function TourProvider({ children }) {
    const [currentTour, setCurrentTour] = useState(null);

    const isCompleted = (id) => {
        const raw = localStorage.getItem('loggex.tours.completed');
        return raw ? JSON.parse(raw).includes(id) : false;
    };

    const markCompleted = (id) => {
        const raw = localStorage.getItem('loggex.tours.completed');
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
            list.push(id);
            localStorage.setItem('loggex.tours.completed', JSON.stringify(list));
        }
    };

    const startTour = useCallback((id) => {
        const tour = tourRegistry.find(t => t.id === id);
        if (!tour) return;
        setCurrentTour(tour);
    }, []);

    const finishTour = useCallback((outcome) => {
        if (currentTour && outcome === 'completed') {
            markCompleted(currentTour.id);
        }
        setCurrentTour(null);
    }, [currentTour]);

    return (
        <TourContext.Provider value={{ currentTour, startTour, finishTour, isCompleted }}>
            {children}
        </TourContext.Provider>
    );
}

export const useTour = () => useContext(TourContext);
```

#### Registro de tours

```js
// frontend/src/tours/index.js
import primerLogin from './common/primer-login';

export const tourRegistry = [
    primerLogin,
    // aquí se irán añadiendo más en fases siguientes
];
```

```js
// frontend/src/tours/common/primer-login.js
export default {
    id: 'primer-login',
    titleKey: 'tour.primerLogin.title',
    roles: ['ROLE_ALUMNO', 'ROLE_PROFESOR', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    isAutoStart: true,       // se lanza solo al entrar
    steps: [
        {
            targetId: 'sidebar-home',
            contentKey: 'tour.primerLogin.step1',
        },
        {
            targetId: 'header-notifications',
            contentKey: 'tour.primerLogin.step2',
        },
        {
            targetId: 'sidebar-mensajes',
            contentKey: 'tour.primerLogin.step3',
        },
        {
            targetId: 'header-user-menu',
            contentKey: 'tour.primerLogin.step4',
        },
    ],
};
```

#### Marcar elementos con `data-tour`

En cada componente del Sidebar, Header, etc., añadir el atributo:

```jsx
<Link to="/home" data-tour="sidebar-home">...</Link>
<button data-tour="header-notifications">...</button>
```

#### Menú de ayuda

Añadir un item "Tutorial" en el dropdown de usuario del `Header` que abre un modal con la lista de tours del rol:

```jsx
// dentro de HelpMenu.jsx
const { startTour, isCompleted } = useTour();
const toursForRole = tourRegistry.filter(t => t.roles.includes(user.roles[0]));

toursForRole.map(t => (
    <button key={t.id} onClick={() => startTour(t.id)}>
        {t(t.titleKey)} {isCompleted(t.id) && <Check />}
    </button>
));
```

#### Resultado de Fase 1

Un usuario entra por primera vez → se lanza el tour de bienvenida automáticamente → puede saltar o completar → no vuelve a salir. Puede re-lanzarlo desde el menú de ayuda. Todo vive en `localStorage`.

---

### Fase 2: Backend persistence + tours por rol

**Objetivo:** el progreso sobrevive a cambios de navegador/dispositivo. Añadir 4-6 tours más, uno por rol y tarea principal.

#### Backend — entidad User

```php
// src/Entity/User.php
#[ORM\Column(type: Types::JSON)]
private array $tutorialsCompleted = [];

public function getTutorialsCompleted(): array
{
    return $this->tutorialsCompleted;
}

public function markTutorialCompleted(string $id): static
{
    if (!in_array($id, $this->tutorialsCompleted, true)) {
        $this->tutorialsCompleted[] = $id;
    }
    return $this;
}
```

Migración Doctrine:
```bash
docker compose exec backend php bin/console make:migration
docker compose exec backend php bin/console doctrine:migrations:migrate
```

#### Controller

```php
// src/Controller/TutorialController.php
#[Route('/api/me/tutorials/status', methods: ['GET'])]
public function status(#[CurrentUser] User $user): JsonResponse
{
    return $this->json(['completed' => $user->getTutorialsCompleted()]);
}

#[Route('/api/me/tutorials/{id}/complete', methods: ['POST'])]
public function complete(
    string $id,
    #[CurrentUser] User $user,
    EntityManagerInterface $em
): JsonResponse {
    $user->markTutorialCompleted($id);
    $em->flush();
    return $this->json(['ok' => true]);
}
```

#### Frontend — sincronización

`TourContext` se amplía para cargar del backend al montarse y enviar `POST .../complete` cuando termina un tour. Cache local como fallback si el POST falla.

#### Tours adicionales

| ID | Rol | Pasos |
|---|---|---|
| `alumno-entregar-tarea` | ALUMNO | abrir tareas → seleccionar una → adjuntar archivo → enviar |
| `alumno-ver-calificaciones` | ALUMNO | ir a calificaciones → filtrar por módulo → ver media |
| `profesor-poner-nota` | PROFESOR | abrir módulo → entregas → calificar → guardar |
| `profesor-editor-horarios` | PROFESOR, ADMIN | abrir editor → arrastrar imparticion → colocar en rejilla → guardar |
| `admin-personalizar-centro` | ADMIN, SUPERADMIN | ir a Personalización → cambiar color primario → ver preview → guardar |
| `admin-crear-grupo` | ADMIN, SUPERADMIN | grupos → nuevo → asignar ciclo → añadir alumnos |

Cada uno son 3-6 pasos. El `roles` del tour lo filtra en el menú de ayuda y en el auto-start.

#### Resultado de Fase 2

Un profesor ve solo los 3-4 tours que le importan. Cambia al portátil de casa y su progreso persiste. Los tours "auto-start" (primer-login) solo salen una vez por usuario, nunca por dispositivo.

---

### Fase 3: Contextual help + condicionales

**Objetivo:** no esperar al primer login — ofrecer ayuda en el momento en que el usuario la necesita.

#### Trigger por ruta

Cuando el usuario entra a una página por primera vez y hay un tour asociado a esa página que no ha visto, mostrar un badge flotante abajo-derecha:

> **¿Necesitas ayuda?**
> Cómo entregar una tarea (3 pasos, 30 s)
> [Mostrar]  [No, gracias]

Si "No, gracias" → marcado como skipped (no vuelve a salir en esa página).
Si "Mostrar" → lanza el tour normal.

Implementación: nuevo campo `trigger` en la definición de tour:

```js
{
    id: 'alumno-entregar-tarea',
    trigger: { route: '/tareas/:id', condition: 'user.roles.includes(ROLE_ALUMNO)' },
    ...
}
```

El `TourContext` escucha `useLocation()`; cuando la ruta matchea y el tour no está completado, renderiza el badge.

#### Pasos condicionales

Algunos steps solo tienen sentido si el usuario cumple cierta condición. Ej. en el tour "editor-horarios", el paso sobre el botón "Auto-generar" solo se muestra si el centro tiene imparticiones sin horario.

```js
{
    targetId: 'horario-auto-generar',
    contentKey: 'tour.horarios.autoGenerar',
    condition: (ctx) => ctx.impartionesSinHorario > 0,
}
```

El contexto se pasa al `<Tour />` desde la página (props drilling corto) o vía un hook `useTourContext()`.

#### Resultado de Fase 3

Un alumno que nunca abrió la vista de tareas, cuando la abre, ve un badge discreto proponiendo un mini-tour. Lo puede aceptar o descartar. No hay interrupciones no solicitadas en el resto de la app.

---

## Orden de Ejecución Recomendado

```
Fase 1 (MVP)
  ├── npm install react-joyride
  ├── TourContext + TourProvider en App.jsx
  ├── <Tour /> component
  ├── Registro inicial con tour "primer-login"
  ├── data-tour en Sidebar + Header
  ├── Menú "Ayuda" en Header
  ├── i18n tour.* keys (español, resto fallback)
  └── Verificar: primer login lanza tour, localStorage persiste
         ↓
Fase 2 (Backend + multi-rol)
  ├── Migración User.tutorialsCompleted
  ├── Controller /api/me/tutorials/*
  ├── TourContext sincroniza con backend
  ├── 5-6 tours por rol
  ├── data-tour en páginas target
  ├── Traducciones i18n completas
  └── Verificar: progreso sobrevive logout, filtrado por rol correcto
         ↓
Fase 3 (Contextual)
  ├── Badge flotante "¿Necesitas ayuda?"
  ├── Trigger por ruta en definición de tour
  ├── Pasos condicionales con función predicate
  ├── Settings: permitir desactivar badges desde perfil
  └── Verificar: badge sale solo cuando procede, nunca molesta 2 veces
```

---

## Impacto en Archivos Existentes

### Frontend (nuevo)
- `src/context/TourContext.jsx`
- `src/components/Tour.jsx`
- `src/components/HelpMenu.jsx`
- `src/components/ContextualHelpBadge.jsx` (Fase 3)
- `src/tours/index.js` (registro)
- `src/tours/common/primer-login.js`
- `src/tours/alumno/*.js`
- `src/tours/profesor/*.js`
- `src/tours/admin/*.js`
- `src/hooks/useTourSync.js` (Fase 2, sync con backend)
- `src/i18n/locales/*.json` — bloque `tour.*`

### Frontend (modificar)
- `src/App.jsx` — envolver con `<TourProvider>` y añadir `<Tour />` al root
- `src/context/AuthContext.jsx` — exponer roles del usuario para filtrar tours
- `src/layout/Header.jsx` — item "Ayuda" en el dropdown de usuario
- `src/layout/Sidebar.jsx` — `data-tour` en items principales
- `src/pages/Home.jsx`, `Mensajes.jsx`, `Tareas.jsx`, etc. — `data-tour` en botones/regiones guiadas
- Componentes de CRUD — `data-tour` en acciones (crear, editar, firmar, exportar PDF)

### Backend (nuevo)
- `src/Controller/TutorialController.php`
- Migración Doctrine para `user.tutorials_completed`

### Backend (modificar)
- `src/Entity/User.php` — campo `tutorialsCompleted` + getters/setters

### Sin cambios
- Stack de tiempo real (Redis, Mercure, Workers) — no interfiere.
- API Platform resources existentes.
- Tematización dinámica (el tour respeta las CSS variables del centro).

---

## Comparativa: Antes vs Después

| Métrica | Antes | Después |
|---|---|---|
| Time-to-first-value usuario nuevo | 15-30 min (explorando) | 30-90 s (tour guiado) |
| % de features descubiertas por usuario medio | ~40% | ~80% (estimado) |
| Emails/mensajes de soporte sobre "cómo hago X" | alto | bajo |
| Fricción al incorporar rol nuevo | alta | baja (tours ya existen) |
| Coste de refactor de UI | medio (tests + manuales) | medio+ (hay que mantener `data-tour`) |

---

## Decisiones pendientes (al empezar)

1. **Idioma de los textos del tour**: ¿español como lengua principal y traducir después, o todas desde el inicio? Recomendación: solo español en Fase 1, resto via fallback.
2. **Estilo visual del tooltip**: ¿seguimos el look pastel/suave del resto de la app o usamos un look "destacado" (bordes marcados, acento llamativo) para que se distinga del contenido?
3. **¿Tours obligatorios?** Los hay de dos tipos: (a) informativos (pueden saltarse), (b) mandatorios (ej. nuevo profesor debe completar "cómo calificar" antes de poder poner notas). La fase 1-2 los trata todos como saltables; si interesan los mandatorios, es Fase 4.
4. **Analítica**: ¿medir cuántos usuarios completan cada tour? Para TFG quizá sea overkill; si sí, usar un endpoint `POST /api/me/tutorials/:id/event` con eventos `started/step-n/completed/skipped`.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Refactor de UI rompe selectores del tour | Usar `data-tour` (contrato explícito), no clases CSS |
| Paso target no existe (feature gated) | `react-joyride` salta a siguiente step si el target no se encuentra; además el `condition` del step lo hace explícito |
| Responsive: elementos ocultos en móvil | Definir `skipOnMobile: true` en steps afectados, o duplicar step con selector alternativo para móvil |
| Tours obsoletos tras renombrar una feature | Tests e2e ligeros (Playwright) que recorran los tours principales; o checklist manual antes de cada release |
| Usuario abre tour y navega fuera de la página sin querer | `react-joyride` tiene opción `disableOverlayClose` — el overlay no cierra; solo el botón explícito |
| Accesibilidad (lector de pantalla, teclado) | react-joyride maneja aria-label, focus trap, ESC para cerrar; auditar con axe-core al terminar cada fase |
