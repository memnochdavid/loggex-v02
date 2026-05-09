# Hoja de ruta: comercialización de Loggex

> **Estado (2026-05-09)**: 🔴 sin empezar — auditoría inicial cerrada en sesión 2026-05-09.
> **Origen**: evaluación completa del producto como SaaS vendible a centros educativos
> españoles (FP, ESO, Bach, Universidad). El núcleo de dominio (modelo semanal,
> solver, catálogo CCAA, clases compartidas, intercambios, notificaciones) está
> sobresaliente; lo que falta es la capa de **producto** (no features): CI, deploy
> a producción, RGPD, accesibilidad, manuales, integraciones operativas.
>
> **Branch sugerida** cuando se aborde: `chore/comercializacion-fase1` para los
> bloqueantes absolutos. El resto vienen detrás en branches por fase.

---

## ⚡ Snapshot para retomar

### Veredicto en una línea

Producto con fondo de dominio excepcional pero infraestructura de prototipo.
**No vendible hoy** sin asumir riesgos legales y operativos. Estimación honesta:
**8–12 semanas full-time** desde hoy a primer cliente piloto pagando, asumiendo
una persona; **5–7 semanas** con dos devs.

### Estado por fase (al crear el doc)

| Fase | Estado | Esfuerzo | Bloquea |
|---|---|---|---|
| **F1** Bloqueantes absolutos (🔴) | 🔴 sin empezar | 3–4 semanas | Demo a director / cualquier piloto |
| **F2** Bloqueantes legales (🟠) | 🔴 sin empezar | 2–3 semanas | Firma de contrato real |
| **F3** Bloqueantes operativos (🟡) | 🔴 sin empezar | 3–4 semanas | Renovación / cliente nº 2 |
| **F4** Diferibles (🟢) | 🔴 sin empezar | open-ended | — (mejora competitiva) |

### Próxima acción

Cerrar **F1.1 Backups automatizados a remoto + rotación**, único ítem que si
se rompe puede provocar litigio inmediato (calificaciones perdidas = RGPD +
contrato roto). 1–2 sesiones.

---

## 0. Reglas y convenciones del doc

- **Cada fase** se enumera por color de bloqueo (F1 = rojo, F4 = verde) y por
  ítem dentro (F1.1, F1.2…). Las fases NO son cronológicas estrictas: F1 debe
  cerrarse antes de F2 mayoritariamente, pero F3 puede solaparse parcialmente
  con F2.
- **Cada ítem** lleva: estado, esfuerzo estimado en sesiones, descripción
  operativa, criterio de "Done" verificable, dependencias.
- **Sin ítem se da por cerrado** sin actualizar este doc + el `INDEX.md`.
- **Branches por fase**: `chore/comercializacion-fase1`, `…-fase2`, `…-fase3`.
- **No mezclar features de dominio con esta ruta**: si en mitad de Fase 1 surge
  algo de horarios o catálogo, va a su roadmap propio. Esta ruta es solo
  "producto" (cosas no-funcionales que el cliente no ve pero exige).

---

## 1. Estado del producto al crear el doc (2026-05-09)

### 1.1 Lo que SÍ tienes

- **Modelo semanal puro** (PL = semana lectiva), validado E2E.
- **Solver de horarios** (bin-packing + iterativo + ILP), factor 7× mejora.
- **Catálogo oficial nacional**: 230 ciclos + 2 230 materias con trazabilidad
  BOE/TodoFP.
- **Calendario CCAA real** (BOJA Sevilla 2025-26 piloto), festivos por ámbito.
- **Clases compartidas entre grupos** (gemelos sincronizados, A+B+C+D ✅).
- **Incidencias / intercambios / sustituciones** (`ExcepcionHorario`, 4 tipos).
- **Notificaciones del sistema en vivo** (Mercure + 5 tipos cableados).
- **Modalidad de imparticion** (PRESENCIAL/FCT/NO_REGULAR/AUTONOMA), cubre
  todo FP LOMLOE.
- **Tematización por centro** (80+ vars CSS, multi-tema con persistencia).
- **i18n 5 idiomas** (es/en/ca/gl/eu) — único en su categoría.
- **Validaciones DNI/NIE/CIF** (mod 23 + Luhn modificado, FE+BE espejo).
- **Sesión por inactividad** + auto-cierre con confirm modal.
- **Bulk delete coherente** en 11 tablas con hook reusable.
- **Stack moderno**: React 19 + Symfony 8 + API Platform 4 + Doctrine 3 +
  MariaDB + MinIO + Caddy + Mercure + Redis.
- **Disciplina técnica visible**: regla de tematización, bitácoras
  obligatorias, helpers reusables, commits descriptivos.

### 1.2 Lo que NO tienes (motiva esta hoja de ruta)

Detallado en F1, F2, F3 abajo. Resumen alto nivel:

- **No tests, no CI/CD**.
- **No despliegue real** (`docker-compose.yml` es dev-only con credenciales
  hardcodeadas, frontend en `npm run dev`, Caddy en `tls internal`).
- **No backups automatizados** a remoto.
- **No anonimización RGPD** (soft-delete deja datos personales en BD).
- **No headers de seguridad** (CSP, X-Frame-Options, HSTS).
- **No audit log**.
- **No accesibilidad WCAG AA** (obligatorio por RD 1112/2018).
- **No políticas legales** (privacidad, cookies, términos).
- **No SSO** (Google Workspace / Microsoft 365).
- **No SMTP real** (recuperación de password no funciona).
- **No manuales de usuario**.
- **HorariosEditor inusable en móvil**.

### 1.3 Brecha competitiva

**Loggex gana** vs Educamos / Alexia / TokApp / Sallenet / Esemtia en:

- Modelo de datos LOMLOE-aware (modalidad, etapas, currículo CCAA con
  trazabilidad oficial).
- Solver real (no manual).
- Personalización profunda + multi-idioma desde diseño.
- UX moderna (React 19, dark theme nativo, validaciones inline, animaciones
  cuidadas).
- Clases compartidas con sincronización automática (sin equivalente conocido).
- Intercambios/sustituciones con cascade automático.

**Loggex pierde** en:

- Madurez operativa (10–15 años de los demás).
- Soporte 24/7, comerciales, formación presencial.
- Integración nativa Google Workspace / Microsoft 365.
- Apps móviles nativas iOS/Android.
- Reportería avanzada para inspección, memorias anuales.
- Pasarelas de pago (matrículas, comedor, extraescolares).

---

## 2. Fase 1 — Bloqueantes absolutos (🔴)

**No vendas hasta cerrar esto.** Cualquier cliente serio que mire
debajo de la alfombra cancela la negociación si encuentra alguno de estos.

### F1.1 — Backups automatizados a remoto + rotación

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 1–2 sesiones.

Hoy `scripts/backup_db.sh` y `scripts/backup_storage.sh` existen pero:
- Sin cron / systemd timer.
- Sin rotación (cada ejecución sobrescribe).
- Sin compresión (.sql plano).
- Sin remoto (todo local, mismo disco que la BD).

**Acciones**:
1. Cron job nightly (3:00 AM) que ejecuta `backup_db.sh` + `backup_storage.sh`.
2. Rotación: 7 diarios + 4 semanales + 12 mensuales. Script con `find -mtime`.
3. Compresión gzip / zstd (ratio típico 10× en SQL dumps).
4. Subida automática a S3 / BackBlaze B2 / Hetzner Storage Box. Credenciales
   en `.env.prod`.
5. Verificación: notificación email/Slack si el backup falla.
6. Restore test mensual documentado: levanta contenedor temporal con backup +
   smoke test (login + 1 query).

**Done cuando**: tras tirar la BD a propósito en un entorno de staging, puedes
restaurarla desde el último backup en < 30 minutos siguiendo solo el manual
en `docs/restore-procedimiento.md`.

---

### F1.2 — Tests + CI/CD básico

**Estado**: 🔴 sin empezar (`backend/tests/` solo bootstrap, frontend 0 specs).
**Esfuerzo**: 3–5 sesiones (es la más grande de F1).

**Backend (PHPUnit)**:
- Configurar `phpunit.dist.xml` con BD de test (sqlite o mariadb separada).
- Fixtures mínimos via DoctrineFixturesBundle (1 centro, 2 grupos, 5 alumnos,
  catálogo reducido).
- Tests críticos:
  - `CurrentUserExtensionTest`: usuario A no ve datos de centro B (iteración
    sobre 11 entidades cubiertas + las que no, para detectar regresiones).
  - `NifEspanolValidatorTest`: tabla de DNIs/NIEs/CIFs válidos e inválidos.
  - `HorarioGemeloSyncSubscriberTest`: el listener propaga soft-delete y
    cambios físicos al gemelo.
  - `IntercambioGrupoCascadeSubscriberTest`: cambio de estado cascadea por
    UUID.
  - `HorarioBatchControllerTest`: bulk delete + concurrencia con
    `baselineMaxUpdatedAt`.
  - `LimpiarNotificacionesControllerTest`, `MarcarNotificacionesLeidasController`.
  - Solvers: 1–2 escenarios determinísticos por solver (entrada conocida →
    salida conocida).

**Frontend (Vitest + React Testing Library)**:
- Configurar Vitest (más rápido que Jest, integra con Vite nativo).
- Tests críticos:
  - `useFormValidation` — esquemas + validateAll/validateField.
  - `useBulkDelete` — toast success/warning/error según parciales.
  - `nifValidator` — espejo del backend, mismas tablas de prueba.
  - `useIdleTimeout` — schedule + extend + onExpire (usar fake timers).
  - `parseErrorResponse` — messageKey/messageParams + status fallbacks.
  - Smoke test render de `Login`, `Usuarios`, `Matriculas` (sin error).

**CI (GitHub Actions)** — `.github/workflows/`:
- `lint.yml`: PHP CS Fixer + ESLint en cada PR.
- `test.yml`: backend tests + frontend tests + frontend `npm run build`.
- Bloquea merge si rojo (branch protection rules en GitHub).
- Coverage report como comentario en el PR.

**Done cuando**: PR a `master` desencadena lint+test+build automático y
muestra coverage. Sin verde, no se mergea.

---

### F1.3 — `docker-compose.prod.yml` real

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 1–2 sesiones.

Hoy:
- `docker-compose.yml` es dev: credenciales hardcoded (`app_password`,
  `!ChangeThisMercureHubSecret!`), frontend en `npm run dev` con HMR, MinIO
  con `minio_user/minio_password`, BD inicializada vía `initdb.d/` SQL dump.
- Caddyfile usa `tls internal` (CA local), no Let's Encrypt.
- Backend Dockerfile single-stage, instala Composer en runtime sin cache layer.
- Frontend Dockerfile expone Vite dev server (no estático).

**Acciones**:
1. `docker-compose.prod.yml` separado:
   - Variables externalizadas via `env_file: .env.prod` (gitignored, gestionado
     por CI / Vault).
   - Frontend: contenedor que ejecuta `npm run build` en build-time y sirve
     `dist/` desde nginx alpine (o desde Caddy directamente).
   - Backend: Dockerfile multi-stage (composer install en stage 1, runtime
     PHP-FPM en stage 2 con OPcache + JIT habilitados).
   - Healthchecks en cada servicio (`HEALTHCHECK` directive + dependencias
     correctas via `depends_on.condition: service_healthy`).
   - Sin volúmenes de código fuente (todo construido en imagen).
2. `Caddyfile.prod`:
   - Bloque `{$DOMAIN}` con Let's Encrypt automático.
   - Headers de seguridad globales (ver F2.1).
   - Redirect HTTP → HTTPS.
3. `docs/deployment.md`:
   - Checklist pre-deploy (`.env.prod` configurado, secretos generados,
     dominio con DNS apuntado, BD vacía + migrations + seed inicial).
   - Comando único de despliegue: `docker compose -f docker-compose.prod.yml up -d`.
   - Procedimiento de rollback (revertir tag de imagen + restore BD si
     migration destructiva).

**Done cuando**: en una VM Hetzner / DigitalOcean limpia con Docker, sigues
`docs/deployment.md` y en < 30 min tienes Loggex sirviendo en
`https://demo.loggex.com` con HTTPS válido y BD inicializada.

---

### F1.4 — JWT TTL explícito y refresh

**Estado**: 🔴 sin empezar (`lexik_jwt_authentication.yaml` sin `token_ttl`).
**Esfuerzo**: 0.5 sesión.

**Acciones**:
1. Configurar `token_ttl: 3600` (1h) explícito en
   `config/packages/lexik_jwt_authentication.yaml`.
2. Documentar en `docs/security.md` la decisión y cómo cambiarla.
3. **Opcional pero recomendado**: refresh token con
   `gesdinet/jwt-refresh-token-bundle`. TTL access 1h, refresh 24h, almacén
   en BD con revoke list.

**Done cuando**: JWT expira a la hora exacta verificable, con prueba E2E
(login → esperar 61 min → request → 401).

---

### F1.5 — Hard-delete + anonimización RGPD

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 2–3 sesiones.

Hoy `SoftDeletableTrait` deja `nombre/email/nif` en BD para siempre. RGPD
artículo 17 (derecho al olvido) exige hard-delete o anonimización.

**Acciones**:
1. **Comando** `app:rgpd:anonimizar-usuario --id=X` que:
   - Reemplaza `nombre`, `apellidos`, `email`, `nif`, `telefono`, `foto`,
     `firma` con valores anónimos (`Usuario#X`, `eliminado-X@anon.local`,
     null para opcionales).
   - Mantiene FK intacta (calificaciones e historial siguen vinculados a un
     "usuario eliminado" para no romper integridad referencial).
   - Marca `deleted=true` y `anonimizado=true` (campo nuevo).
2. **Cron mensual** `app:rgpd:purga-soft-deleted`:
   - Hard-delete de soft-deleted con `deletedAt < now() - 30 días` (excepto
     calificaciones / asistencia que requieren retención legal — verificar
     plazos exactos).
3. **UI admin**: en `/admin/usuarios`, opción "Anonimizar (RGPD)" en el
   menú de cada usuario (admin/superadmin). Confirm modal con explicación
   del proceso.
4. **Endpoint público** `POST /api/me/solicitar-borrado` que el alumno puede
   invocar (genera ticket interno para que el admin del centro apruebe).

**Done cuando**: un alumno puede ejercitar derecho al olvido vía endpoint;
admin lo aprueba en < 1 click; tras 30 días el cron limpia hard-delete; los
datos personales NO aparecen en backups posteriores.

---

### F1.6 — Headers de seguridad

**Estado**: 🔴 sin empezar (Caddy no añade headers globales).
**Esfuerzo**: 0.5 sesión.

**Acciones**:
1. En `Caddyfile.prod` (F1.3), añadir directiva `header`:
   ```caddyfile
   header {
       Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
       X-Content-Type-Options "nosniff"
       X-Frame-Options "DENY"
       Referrer-Policy "strict-origin-when-cross-origin"
       Permissions-Policy "geolocation=(), microphone=(), camera=()"
       Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.mercure.com wss:;"
   }
   ```
2. Validar con [securityheaders.com](https://securityheaders.com) tras deploy
   — meta: A o A+ rating.
3. Test E2E: una page con `<iframe src="https://demo.loggex.com">` debe ser
   bloqueada por X-Frame-Options.

**Done cuando**: securityheaders.com da A+ y el sitio sigue funcionando
(Mercure no roto por CSP, fonts cargadas, etc.).

---

### F1.7 — Audit log

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 1–2 sesiones.

**Acciones**:
1. Entidad nueva `AuditLog`:
   ```
   id            int
   usuario       FK User (quien hizo la acción)
   centro        FK Centro
   accion        string (CREATE | UPDATE | DELETE | LOGIN | LOGOUT | EXPORT)
   entidad       string (nombre clase)
   entidadId     int
   cambios       json (diff antes/después)
   ip            string
   userAgent     string
   timestamp     datetime
   ```
2. **Doctrine subscriber** `AuditLogSubscriber` que escucha `postPersist`,
   `postUpdate`, `postRemove` para entidades sensibles: `Calificacion`,
   `Asistencia`, `User` (cambio de roles), `Matricula`,
   `ExcepcionHorario` (estado).
3. **Vista admin** `/admin/auditoria`:
   - Filtros: usuario, fecha, tipo de acción, entidad.
   - Solo lectura.
   - Exportable a CSV.
4. **Cron de retención**: purgar entradas > 5 años (configurable por centro
   según política de archivo).

**Done cuando**: cualquier cambio en una calificación se registra
automáticamente, recuperable por inspector educativo en
`/admin/auditoria?entidad=Calificacion&id=42`.

---

## 3. Fase 2 — Bloqueantes legales (🟠)

**Sin esto un contrato real es imposible o muy arriesgado.**

### F2.1 — WCAG AA

**Estado**: 🔴 sin empezar (88 ARIA en 32/105 archivos).
**Esfuerzo**: 3–5 sesiones (muy disperso, va por componentes).

**Marco legal**: RD 1112/2018 transpone Directiva UE 2016/2102 — accesibilidad
WCAG 2.1 AA es **obligatoria** en sector público español (educación incluida).

**Acciones**:
1. Scan automático en CI: `axe-core` + `pa11y` sobre cada PR.
2. Fixes prioritarios:
   - `<html lang={i18n.language}>` dinámico.
   - Trap focus + `aria-modal="true"` + `aria-labelledby` en `ModalView` y
     todos sus consumidores.
   - Navegación teclado en `HorariosEditor` (drag-drop con Space + flechas
     vía `@dnd-kit/keyboard-coordinates-getter`).
   - `aria-describedby` en inputs con error inline (link al `errorText`).
   - Skip-link "Saltar al contenido" en Layout.
   - Color contrast checker en `Configuracion` (rechazar combos < 4.5:1).
3. Auditoría manual con NVDA + VoiceOver (lectores de pantalla) en flujos
   críticos: login, ver horario, entregar tarea, ver calificación.
4. Declaración de accesibilidad pública en `/accesibilidad` con nivel AA y
   excepciones documentadas (HorariosEditor todavía parcial → comprometer
   roadmap de mejora).

**Done cuando**: pa11y CI verde + auditoría manual con NVDA pasa en flujos
críticos + página `/accesibilidad` publicada con declaración formal.

---

### F2.2 — Política de privacidad / cookies / términos

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 1 sesión técnica + tiempo legal externo.

**Acciones**:
1. Plantillas legales redactadas por abogado especializado en RGPD educativo.
   Costo: 500–1500€ una vez.
2. Páginas frontend `/privacidad`, `/cookies`, `/terminos` (no requieren
   login). Plantilla simple, contenido i18n × 5.
3. Banner de cookies con consentimiento explícito (sin contar cookies
   técnicas necesarias). Librería `react-cookie-consent` o custom.
4. Footer del Layout enlaza a las tres páginas.
5. Checkbox "He leído y acepto" en Login y en cualquier registro nuevo.
6. **Encargado de tratamiento**: contrato firmado con cada centro cliente
   (DPA - Data Processing Agreement). Plantilla genérica + adaptación por
   cliente.

**Done cuando**: tres páginas publicadas, banner cookies funcional, DPA
firmable disponible para cualquier prospecto.

---

### F2.3 — Multi-tenancy hardening

**Estado**: 🟠 parcial (`CurrentUserExtension` cubre 11/47 entidades; resto
depende de filtros manuales).
**Esfuerzo**: 2–3 sesiones.

**Acciones**:
1. **Auditoría exhaustiva**:
   - Lista las 47 entidades.
   - Para cada una: ¿debería filtrar por centro? ¿lo hace `CurrentUserExtension`?
     ¿hay endpoints custom que la consultan saltándose la extensión?
   - Documentar en `docs/multi-tenancy.md` la matriz completa.
2. **Hardening ApiResource**:
   - `Centro` debe tener `security: "is_granted('ROLE_SUPERADMIN')"` en todas
     las operaciones (DELETE incluido).
   - Resto: revisar uno por uno; añadir `security` por operación según rol.
3. **Tests cross-tenant** (relacionado con F1.2):
   - Test que como admin de centro A intenta GET/POST/DELETE recursos del
     centro B y verifica 403/404.
   - Iterar sobre todos los endpoints custom.
4. **QueryBuilder lint**: regex pre-commit que detecte `joins` sin
   `setParameter('centro', ...)` en archivos `Repository/`. Soft-warning para
   audit manual.

**Done cuando**: matriz de 47 entidades documentada, tests cross-tenant
verdes para todos los endpoints, `Centro` blindado a SUPERADMIN, lint
pre-commit configurado.

---

### F2.4 — i18n completion

**Estado**: 🟠 parcial (5 idiomas, 695 `defaultValue:` inline = claves nunca
traducidas).
**Esfuerzo**: 2 sesiones (script semi-automático).

**Acciones**:
1. **Script de extracción**: `scripts/extract-i18n-todos.js` que parsea
   `frontend/src/**/*.jsx` buscando `t('key', { defaultValue: '...' })` y
   genera un report de 695 claves faltantes con su defaultValue español.
2. **Carga al locale ES** automática (las claves ya están con el value en
   español).
3. **Traducción** a en/ca/gl/eu con servicio profesional o LLM + revisión.
   Coste 200–500€ con servicio profesional, 0€ con LLM + 1 día revisión
   manual.
4. **Backend**: mover validators y mensajes custom a
   `translations/messages.{locale}.yaml` con `Translator` de Symfony. Locale
   se determina del header `Accept-Language` o del `User.idiomaPreferido`.
5. **CI check**: script en CI que falla si aparece nuevo `defaultValue:` sin
   clave correspondiente en es.json.

**Done cuando**: `defaultValue:` count = 0, locales × 5 al 100%, backend
emite mensajes en idioma del usuario.

---

## 4. Fase 3 — Bloqueantes operativos (🟡)

**Sin esto el cliente nº 2 no llega.** El primer piloto puede aceptar
limitaciones; el segundo cliente o la renovación del primero exigirá
cosas operativas.

### F3.1 — SMTP real

**Estado**: 🔴 sin empezar (`MAILER_DSN` no configurado).
**Esfuerzo**: 0.5 sesión.

**Acciones**:
1. `MAILER_DSN` en `.env.prod` apuntando a SendGrid / AWS SES / Postmark.
2. Plantillas Twig en `templates/email/`:
   - `recuperacion-password.html.twig`
   - `bienvenida-nuevo-usuario.html.twig`
   - `notificacion-importante.html.twig` (digest semanal de notifs no leídas).
3. Endpoint `POST /api/recuperar-password` ya existe / no — verificar y
   completar.
4. Test: enviar email a Mailtrap en CI, verificar HTML válido.

**Done cuando**: usuario olvida password → recibe email con link de reset
→ resetea sin intervención de admin.

---

### F3.2 — SSO Google Workspace / Microsoft 365

**Estado**: 🔴 sin empezar.
**Esfuerzo**: 2–3 sesiones.

95% de centros españoles ya tienen Google Workspace o Microsoft 365. Sin SSO
el admin crea cuentas a mano = friction inaceptable.

**Acciones**:
1. Bundle `knpuniversity/oauth2-client-bundle` + providers Google/Microsoft.
2. Botones "Entrar con Google" / "Entrar con Microsoft" en `/login`.
3. Callback que mappea email → User (autoprovisión opcional si admin lo
   permite por centro).
4. Mapeo de roles vía claims (Google Workspace tiene `org` units, Microsoft
   AD tiene grupos).
5. Configuración por centro (admin del centro mete sus client_id/secret en
   Personalizacion).

**Done cuando**: admin de un instituto con Google Workspace puede configurar
SSO en 5 min y sus 200 alumnos entran con su cuenta `@institutoxyz.es` sin
crear nada manualmente.

---

### F3.3 — Onboarding del cliente nuevo

**Estado**: 🔴 sin empezar (cada cliente nuevo es trabajo manual).
**Esfuerzo**: 2 sesiones.

**Acciones**:
1. **Comando CLI** `app:init-customer`:
   ```bash
   app:init-customer \
     --nombre="IES Pablo Picasso" \
     --ccaa="andalucia" \
     --provincia="malaga" \
     --etapas="fp,eso" \
     --admin-email="director@iespicasso.es" \
     --admin-password-tmp="..."
   ```
   Crea Centro + carga catálogo CCAA pertinente + crea calendario lectivo
   sugerido + crea usuario admin con password temporal + envía email de
   bienvenida.
2. **Wizard frontend** `/setup` (paso a paso) que el admin ve la primera vez
   que entra y guía:
   - Paso 1: subir logo del centro.
   - Paso 2: confirmar etapas educativas.
   - Paso 3: crear primer itinerario / grupo.
   - Paso 4: invitar profesores.
3. **Documentación técnica** `docs/onboarding-cliente-nuevo.md` con checklist
   de 1h: DNS, certificados, init-customer, smoke tests.

**Done cuando**: en < 1h, sigues `docs/onboarding-cliente-nuevo.md` y un
nuevo cliente está operativo con su admin pudiendo invitar profes.

---

### F3.4 — HorariosEditor mobile/tablet

**Estado**: 🔴 sin empezar (6 026 líneas, drag-drop, multi-grupo).
**Esfuerzo**: 4–6 sesiones (es el ítem más grande de F3).

**Acciones**:
1. **Tablet** (768–1024px):
   - Layout en accordion por grupo (un grupo expandible a la vez).
   - Touch-friendly drag con `@dnd-kit/sensors/TouchSensor`.
2. **Mobile** (< 768px):
   - Selector dropdown de grupo.
   - Vista por día (no semana) con scroll horizontal.
   - Read-only por defecto; edición opt-in con warning de UX limitada.
3. Test en BrowserStack iOS + Android antes de release.

**Done cuando**: profesor puede consultar y editar el horario de su grupo
desde iPad de aula con experiencia razonable; alumno consulta su horario
desde móvil sin scroll horizontal molesto.

---

### F3.5 — Manuales de usuario

**Estado**: 🔴 sin empezar (`react-joyride` en stack pero no claro si los
tours están poblados).
**Esfuerzo**: 3 sesiones (texto + screenshots + grabación de vídeos).

**Acciones**:
1. **Tours en-app** con `react-joyride`:
   - Tour Admin Quickstart (3 pasos: itinerario → grupo → catálogo).
   - Tour Profe Quickstart (4 pasos: ver horario → subir tarea → calificar
     → asistencia).
   - Tour Alumno Quickstart (3 pasos: foto → horario → entrega).
2. **Manuales markdown** en `docs/manual/`:
   - `manual-admin.md`
   - `manual-profe.md`
   - `manual-alumno.md`
   - Renderizados en `/ayuda` con MDX o markdown-it.
3. **Vídeos screencast** (5 min cada uno) hosteados en Vimeo:
   - "Configurar tu centro en 10 min"
   - "Crear el horario óptimo"
   - "Calificar y comunicar a alumnos"
   - "Resolver incidencias e intercambios"
4. **FAQ** dentro de la app con búsqueda (`/ayuda/faq`).

**Done cuando**: nuevo admin de centro puede llegar a horarios funcionando
en 1h sin asistencia humana usando solo manuales + tours.

---

## 5. Fase 4 — Diferibles (🟢)

Mejoras competitivas. **Producto vendible sin estos**, pero los necesitas
en 6–12 meses para no perder cuota.

### F4.1 — Lazy routing del frontend
**Esfuerzo**: 0.5 sesión. Bundle + first paint mejor.

### F4.2 — N+1 audit y query optimization
**Esfuerzo**: 1–2 sesiones. `doctrine:query:sql --profile` en endpoints clave.

### F4.3 — Webhooks salientes
**Esfuerzo**: 1–2 sesiones. Eventos `tarea.entregada`, `calificacion.publicada`,
etc. para integraciones cliente.

### F4.4 — White-label / custom domains
**Esfuerzo**: 2–3 sesiones. Centro contrata "white label" → retira branding
Loggex; opcionalmente `cliente.dominio-cliente.com`.

### F4.5 — PWA con offline para entregas
**Esfuerzo**: 3 sesiones. Service worker real, queue de entregas offline,
sync background.

### F4.6 — Reportería avanzada (memorias, inspección)
**Esfuerzo**: 4+ sesiones. Plantillas de informe configurables, exportables
a PDF/Excel.

### F4.7 — Apps móviles nativas iOS/Android
**Esfuerzo**: 8–12 semanas (proyecto aparte). React Native sobre la API
existente. Solo si el negocio lo justifica.

### F4.8 — Pasarelas de pago (matrículas, comedor)
**Esfuerzo**: 4+ sesiones por proveedor. Stripe / Redsys / Bizum.

### F4.9 — Integración AEAT, sello de tiempo, firma digital cualificada
**Esfuerzo**: 4+ sesiones por integración. Solo si vendes a sector público
formal donde lo exigen.

### F4.10 — Reportería para inspección educativa
**Esfuerzo**: 3 sesiones. Plantillas oficiales por CCAA.

---

## 6. Tres caminos a mercado

### Camino A — SaaS centralizado (recomendado)

Tú hosteas, clientes contratan suscripción anual.

- **Ventajas**: control total, monetización limpia, escala lineal con clientes,
  soporte centralizado.
- **Desventajas**: tú asumes infra, soporte 24/7, cumplimiento RGPD como
  encargado de tratamiento.
- **Pre-requisitos**: F1 + F2 completas. F3 al menos F3.1 (email) y F3.3
  (onboarding) al primer cliente.
- **Pricing sugerido** (mercado español 2026): 2–4€/alumno/año, mínimo 1 000€/
  año por centro. Tier gratis para < 30 alumnos como gancho.
- **Tiempo a primer cliente**: 8–12 semanas full-time desde hoy.

### Camino B — Self-hosted licenciado

Cliente despliega en su servidor; tú vendes licencia + soporte L2 opcional.

- **Ventajas**: cero infra para ti, atractivo a centros con TI propia
  (universidades, fundaciones, redes diocesanas).
- **Desventajas**: cada cliente es un fork; updates fragmentados; soporte
  difícil sin acceso remoto.
- **Pre-requisitos**: F1.3 (compose prod) + F1.5 (RGPD self-service) + F3.5
  (manuales DBA).
- **Tiempo**: 6–8 semanas.

### Camino C — Consultora educativa (servicios + producto)

Vendes el producto + formación + configuración inicial + soporte como
paquete por proyecto.

- **Ventajas**: ingresos rápidos, feedback real de uso, validación con bajo
  riesgo.
- **Desventajas**: poco escalable, tu tiempo es el cuello de botella.
- **Pre-requisitos**: F1.1 + F1.2 + F1.5 + F1.6 + F1.7. F2/F3 negociables
  por contrato.
- **Tiempo**: 4–6 semanas.
- **Modelo recomendado** para validar antes de saltar a A: 2–3 centros
  piloto a precio "amigo" (50% del SaaS futuro) durante 12 meses, luego
  migración a A con feedback acumulado.

---

## 7. Recomendación final

1. **Camino C primero** (4–6 semanas), 2–3 centros piloto a precio reducido.
2. **Migración a Camino A** en mes 12, con feedback real y caso de uso
   probado.
3. **Inversión inicial recomendada**: 1 dev (tú) + presupuesto para:
   - Servicios legales (DPA, plantillas RGPD): 1 000–2 000€.
   - Hosting inicial (1 VPS Hetzner mediano): ~30€/mes.
   - Servicios traducción profesional (opcional): 200–500€.
   - Auditoría externa de seguridad antes del segundo cliente: 1 500–3 000€.
4. **Primera venta realista**: mes 4–5 desde hoy si ejecutas F1 a buen ritmo.

---

## 8. Métricas de "Done" del proyecto comercial

El proyecto NO es vendible hasta que:

| Métrica | Target | Estado |
|---|---|---|
| Tests con CI verde | 100 % de PRs | 🔴 0 % |
| Backups automatizados a remoto | Diario + restore mensual | 🔴 manual |
| `docker-compose.prod.yml` desplegable | < 30 min en VM limpia | 🔴 dev only |
| RGPD: anonimización ejercitable | < 5 min admin | 🔴 sin código |
| Headers seguridad | A+ en securityheaders.com | 🔴 sin medir |
| Audit log de calificaciones | Trazable por inspector | 🔴 sin código |
| WCAG AA validado | pa11y CI verde + NVDA OK | 🔴 sin medir |
| Política de privacidad / DPA | Publicada y firmable | 🔴 sin redactar |
| Multi-tenant hardening | Tests cross-tenant verdes | 🟠 parcial |
| i18n completo | 0 `defaultValue:` inline | 🟠 695 |
| SMTP real funcional | Reset password E2E | 🔴 sin configurar |
| SSO Google Workspace | Auto-provisión usuarios | 🔴 sin código |
| Onboarding cliente nuevo | < 1h con docs/CLI | 🔴 sin script |
| HorariosEditor mobile | Usable en iPad | 🔴 desktop only |
| Manuales de usuario | 3 manuales + tours + 4 vídeos | 🔴 sin contenido |

Cuando 12 de 15 estén verdes (los 3 restantes negociables por contrato),
el producto es vendible bajo cualquiera de los tres caminos.

---

## 9. Bitácora de implementación

### 2026-05-09 — Creación del doc

Tras evaluación completa del producto vs. realidad comercial española
(competencia: Educamos / Alexia / TokApp / Sallenet / Esemtia), se levanta
esta hoja de ruta como la pieza que faltaba: traducir el "código está
listo" a "el producto se puede vender".

Auditoría se basó en:
- Lectura del INDEX y todos los roadmaps cerrados/abiertos.
- Exploración de codebase en áreas no-funcionales: tests, deploy, backups,
  multi-tenancy, RGPD, accesibilidad, i18n completo, performance, mobile,
  integraciones, onboarding, branding.
- Comparación con stack y estado típico de SaaS educativos españoles 2025-26.

Conclusión: producto con dominio sobresaliente pero infraestructura de
prototipo. 8–12 semanas full-time a primer cliente piloto si se ataca F1+F2.

Cross-ref añadida al `INDEX.md` en sección "🔴 Atadas pero sin código" como
ítem prioritario para roadmap comercial; mantiene los roadmaps de dominio
sin contaminar.
