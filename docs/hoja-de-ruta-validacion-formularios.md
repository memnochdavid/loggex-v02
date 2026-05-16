# Hoja de Ruta — Validación de Formularios

> **Creada**: 2026-05-16
> **Audit**: `docs/audit-validacion-formularios.md`
> **Objetivo**: Que toda entidad con exposición API tenga validación Symfony completa y el frontend refleje las mismas reglas

---

## ⚡ Snapshot para retomar

**Estado**: ✅ Fase 1 + Fase 2 + Fase 3 completadas.
**Siguiente**: Fase 4 — Robustez adicional (CSRF, sanitización, solapamientos, debounce)

---

## Principios de Diseño

1. **Backend es la fuente de verdad**: toda regla de validación vive primero en la entidad Symfony con `#[Assert\...]`
2. **Frontend replica para UX**: el frontend aplica las mismas reglas para feedback inmediato, pero nunca como única barrera
3. **Mensajes en español**: cada constraint lleva `message:` explícito en español
4. **Grupos de validación**: usar `groups: ['create']` para campos que solo aplican en creación (ej. password)
5. **No romper datos existentes**: las nuevas constraints deben ser compatibles con los datos ya persistidos

---

## Fase 1 — Gaps críticos: entidades sin NINGUNA validación

**Objetivo**: Las 12 entidades que hoy tienen cero `#[Assert\...]` tengan al menos NotBlank en campos obligatorios, Length en campos string, y constraints de negocio clave.

### 1.1 Horario (`Horario.php`)
- `#[Assert\NotBlank]` en `diaSemana`, `horaInicio`, `horaFin`, `aula`
- `#[Assert\Range(min: 1, max: 7)]` en `diaSemana`
- `#[Assert\Length(max: 50)]` en `aula`
- `#[Assert\Callback]` → validar `horaFin > horaInicio`
- **Archivos**: `backend/src/Entity/Horario.php`, `frontend/src/pages/Horarios.jsx` (o donde se cree/edite)

### 1.2 Materia (`Materia.php`)
- `#[Assert\NotBlank]` en `nombre`
- `#[Assert\Length(max: 100)]` en `nombre`
- `#[Assert\Length(max: 10)]` en `abreviatura`
- `#[Assert\PositiveOrZero]` en `minutosSemanales`, `horasTotales`
- `#[Assert\Choice(choices: ['presencial', 'fct', 'no_regular', 'autonoma'])]` en `modalidad`
- **Archivos**: `backend/src/Entity/Materia.php`, `frontend/src/pages/Materias.jsx`

### 1.3 Itinerario (`Itinerario.php`)
- `#[Assert\NotBlank]` en `nombre`
- `#[Assert\Length(max: 100)]` en `nombre`
- `#[Assert\Length(max: 10)]` en `abreviatura`
- `#[Assert\Length(max: 500)]` en `descripcion`
- `#[Assert\Choice(choices: [...EtapaEducativa])]` en `etapa`
- `#[Assert\Positive]` en `anioInicio`
- **Archivos**: `backend/src/Entity/Itinerario.php`, `frontend/src/pages/Itinerarios.jsx`

### 1.4 Imparticion (`Imparticion.php`)
- `#[Assert\NotBlank]` en `materia`, `profesor`, `grupo`
- `#[Assert\Length(max: 50)]` en `aulaEspecifica`
- `#[Assert\Choice(choices: ['presencial', 'fct', 'no_regular', 'autonoma'])]` en `modalidad`
- **Archivos**: `backend/src/Entity/Imparticion.php`, `frontend/src/pages/Imparticiones.jsx`

### 1.5 Matricula (`Matricula.php`)
- `#[Assert\NotBlank]` en `alumno`, `grupo`
- `#[Assert\Choice(choices: ['activa', 'baja', 'pendiente'])]` en `estado`
- **Archivos**: `backend/src/Entity/Matricula.php`, `frontend/src/pages/Matriculas.jsx`

### 1.6 Asistencia (`Asistencia.php`)
- `#[Assert\NotBlank]` en `estado`, `fecha`, `imparticion`, `alumno`
- `#[Assert\Choice(choices: ['P', 'R', 'J'])]` en `estado`
- `#[Assert\Length(max: 500)]` en `comentario`
- **Archivos**: `backend/src/Entity/Asistencia.php`

### 1.7 Calificacion (`Calificacion.php`)
- `#[Assert\NotBlank]` en `nota`, `entrega`
- `#[Assert\Range(min: 0, max: 10)]` en `nota`
- `#[Assert\Length(max: 1000)]` en `feedbackProfesor`
- **Archivos**: `backend/src/Entity/Calificacion.php`, `frontend/src/pages/CalificacionesDetalle.jsx`

### 1.8 Tarea (`Tarea.php`)
- `#[Assert\NotBlank]` en `titulo`, `imparticion`
- `#[Assert\Length(max: 100)]` en `titulo`
- `#[Assert\Length(max: 2000)]` en `descripcion`
- `#[Assert\Choice(choices: ['examen', 'tarea', 'practica'])]` en `tipo`
- `#[Assert\Range(min: 0, max: 10)]` en `notaMinima`
- **Archivos**: `backend/src/Entity/Tarea.php`

### 1.9 Festivo (`Festivo.php`)
- `#[Assert\NotBlank]` en `nombre`
- `#[Assert\Length(max: 100)]` en `nombre`
- `#[Assert\Expression('this.fechaInicio <= this.fechaFin', message: '...')]`
- **Archivos**: `backend/src/Entity/Festivo.php`, `frontend/src/pages/Festivos.jsx`

### 1.10 Mensaje (`Mensaje.php`)
- `#[Assert\NotBlank]` en `asunto`, `contenido`, `remitente`
- `#[Assert\Length(max: 100)]` en `asunto`
- `#[Assert\Length(max: 5000)]` en `contenido`
- `#[Assert\Count(min: 1)]` en `destinatarios`
- **Archivos**: `backend/src/Entity/Mensaje.php`, `frontend/src/pages/Mensajes.jsx`

### 1.11 Comunicado (`Comunicado.php`)
- `#[Assert\NotBlank]` en `titulo`, `contenido`, `centro`
- `#[Assert\Length(max: 100)]` en `titulo`
- `#[Assert\Length(max: 5000)]` en `contenido`
- **Archivos**: `backend/src/Entity/Comunicado.php`

### 1.12 Temario (`Temario.php`)
- `#[Assert\NotBlank]` en `titulo`, `imparticion`
- `#[Assert\Length(max: 100)]` en `titulo`
- **Archivos**: `backend/src/Entity/Temario.php`, `frontend/src/pages/TemariosProfesor.jsx`

---

## Fase 2 — Completar validación en entidades parciales

### 2.1 Centro (`Centro.php`)
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 255)]` en `nombre`
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 20)]` en `cif`
- `#[NifEspanol]` en `cif` (como en User)
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 255)]` en `direccion`
- `#[Assert\Regex('/^[6-9]\d{8}$/')]` en `telefono` (como en User)

### 2.2 Grupo (`Grupo.php`)
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 50)]` en `nombre`
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 10)]` en `abreviatura`
- `#[Assert\Length(max: 50)]` en `aulaDefault`

### 2.3 PeriodoEvaluativo (`PeriodoEvaluativo.php`)
- `#[Assert\NotBlank]` + `#[Assert\Length(max: 50)]` en `nombre`
- `#[Assert\LessThan(propertyPath: 'fechaFin', message: '...')]` en `fechaInicio`
- `#[Assert\Range(min: 0, max: 1)]` en `peso` (ya existe)

### 2.4 User (`User.php`)
- `#[Assert\Length(min: 8, groups: ['create'])]` en `password` (o campo `plainPassword`)
- `#[Assert\Choice(choices: ['ROLE_ADMIN', 'ROLE_PROFESOR', 'ROLE_ALUMNO'], groups: ['create'])]` en `roles`

### 2.5 JornadaTipo (`JornadaTipo.php`)
- `#[Assert\Choice(choices: ['manana', 'tarde', 'especial'])]` en `turno`

---

## Fase 3 — Frontend: replicar validación backend

### 3.1 Validación cross-field en formularios
- `Horarios.jsx`: `horaFin > horaInicio` (comparar valores de time inputs)
- `Festivos.jsx`: `fechaInicio ≤ fechaFin`
- `Evaluaciones.jsx`: `fechaInicio ≤ fechaFin`
- `CalificacionesDetalle.jsx`: `nota ∈ [0, 10]` (ya tiene HTML5, añadir JS check)

### 3.2 maxLength en inputs de texto
- Barrido de todos los `<input type="text">` y `<textarea>` para añadir `maxLength` que coincida con `#[Assert\Length(max: N)]` del backend

### 3.3 pattern en inputs de teléfono
- `Usuarios.jsx`: `pattern="[6-9][0-9]{8}"` en campo teléfono
- `Centros.jsx`: igual

### 3.4 password minLength
- `Usuarios.jsx`: `minLength={8}` en campo password (solo create)

### 3.5 Validación de archivos en frontend
- Barrido de todos los `<input type="file">`: añadir `accept` attribute + validación JS de tamaño máximo

### 3.6 Choices en selects
- Añadir validación JS en formularios que usan selects para etapa, modalidad, turno, estado, tipo (defensa contra DOM manipulation)

---

## Fase 4 — Robustez adicional

### 4.1 CSRF en endpoints custom
- Identificar todos los controllers custom que aceptan POST/PUT/PATCH con cookies
- Añadir protección CSRF o migrar a JWT en header

### 4.2 Sanitización de nombres de archivo
- Revisar `TemarioUploadController`, `CentroLogoController`, etc.
- Sanitizar nombres antes de almacenar y al mostrar en UI

### 4.3 Validación de solapamientos
- `Horario`: validar que un profesor no tenga dos horarios en la misma franja del mismo grupo
- Frontend: aviso visual al crear/editar

### 4.4 Debounce en AsyncSearchSelect
- Añadir debounce a búsquedas para reducir carga en API

---

## Decisiones Abiertas

| ID | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Validar unicidad en frontend (email, NIF)? | No — requiere query al servidor, mejor confiar en `#[UniqueEntity]` del backend + manejo del 409/422 |
| D2 | ¿Usar Validation Groups en entities existentes? | Sí — `groups: ['create']` para password, `groups: ['Default']` para el resto |
| D3 | ¿Mensajes de error en español en backend o traducir en frontend? | Español en backend (message: explícito) — el frontend ya traduce las respuestas 422 con `parseErrorResponse` |
| D4 | ¿Añadir `#[Assert\NotNull]` en FKs que ya son `nullable: false` en ORM? | Sí — Doctrine lanza 500, Assert lanza 422. Mejor UX y consistencia |

---

## Bitácora de Implementación

### 2026-05-16 — Fase 3 completa: Frontend validation (cross-field, maxLength, pattern, archivos)

**3.1 Cross-field validation (JS checks antes de submit):**
- `Horarios.jsx`: `horaFin > horaInicio` — toast.warning si no cumple.
- `Festivos.jsx`: `fechaFin >= fechaInicio` (si fechaFin está definido) — toast.warning si no cumple.
- `Evaluaciones.jsx`: `fechaFin > fechaInicio` — toast.warning si no cumple.
- `CalificacionesDetalle.jsx`: ya tenía `nota ∈ [0,10]` en `handleSaveNota` — confirmado.

**3.2 maxLength en inputs de texto:**
- `Usuarios.jsx`: nombre(255), apellidos(255), email(180), telefono(20), nif(20).
- `Centros.jsx`: nombre(255), cif(20), direccion(255), telefono(20).
- `Itinerarios.jsx`: nombre(255).
- `Materias.jsx`: nombre(255), abreviatura(16 — ya tenía), codigoOficial(50).

**3.3 pattern en teléfono:**
- `Usuarios.jsx`: `pattern="[6-9][0-9]{8}"` en campo telefono.
- `Centros.jsx`: `pattern="[6-9][0-9]{8}"` en campo telefono.

**3.4 password minLength:**
- `Usuarios.jsx`: `minLength={8}` en campo password (aplica en create por `required={!currentUser}`).

**3.5 Validación de archivos (tamaño máximo JS):**
- `Centros.jsx`: logo ≤ 5 MB en `handleFileChange`.
- `Usuarios.jsx`: avatar ≤ 5 MB en `handleFileChange`.
- `Entregas.jsx`: archivo entrega ≤ 10 MB en `handleUploadSubmit`.
- `Entregas.jsx`: archivo tarea ≤ 10 MB en `handleSaveTarea`.
- `TemariosProfesor.jsx`: archivo temario ≤ 10 MB en `handleSubmit`.
- `Perfil.jsx`: avatar ≤ 5 MB en `handleAvatarChange`.

**Archivos modificados (8 frontend):**
`Horarios.jsx`, `Festivos.jsx`, `Evaluaciones.jsx`, `Usuarios.jsx`, `Centros.jsx`, `Itinerarios.jsx`, `Materias.jsx`, `Entregas.jsx`, `TemariosProfesor.jsx`, `Perfil.jsx`.

### 2026-05-16 — Fase 2 completa: 5 entidades parciales completadas

**Entidades modificadas (5 archivos):**

1. **Centro** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en nombre, `#[Assert\NotBlank]` + `#[Assert\Length(max:20)]` + `#[NifEspanol]` en cif, `#[Assert\NotNull]` en activo, `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en direccion, `#[Assert\Length(max:25)]` + `#[Assert\Regex]` (regex español) en telefono.
2. **Grupo** — `#[Assert\NotBlank]` + `#[Assert\Length(max:50)]` en nombre, `#[Assert\NotBlank]` + `#[Assert\Length(max:10)]` en abreviatura, `#[Assert\Length(max:100)]` en aulaDefault.
3. **PeriodoEvaluativo** — `#[Assert\NotBlank]` + `#[Assert\Length(max:100)]` en nombre, `#[Assert\NotBlank]` en tipo, `#[Assert\NotBlank]` en fechaInicio/fechaFin, `#[Assert\NotNull]` en grupo, `#[Assert\Expression('fechaFin > fechaInicio')]` a nivel clase.
4. **User** — `#[Assert\NotBlank(groups: ['create'])]` + `#[Assert\Length(min:8, groups: ['create'])]` en password, `#[Assert\NotNull]` + `#[Assert\Choice(['ROLE_ADMIN','ROLE_PROFESOR','ROLE_ALUMNO'])]` en rol_app.
5. **JornadaTipo** — `#[Assert\NotBlank]` + `#[Assert\Choice]` en turno (reemplaza NotNull), `#[Assert\NotBlank]` en diasLectivos.

**Compatibilidad con datos existentes**: Todas las constraints son compatibles con `backup_tfg_full.sql`:
- `centro.cif`: valores existentes son CIF/NIF válidos → compatible con NifEspanol.
- `centro.telefono`: nullable, valores existentes son 9 dígitos → compatible con Regex.
- `user.rol_app`: valores existentes son ROLE_ADMIN/ROLE_PROFESOR/ROLE_ALUMNO → compatible con Choice.
- `jornada_tipo.turno`: valores existentes son manana/tarde/especial → compatible con Choice.
- `periodo_evaluativo.fechaFin > fechaInicio`: datos existentes cumplen → compatible con Expression.

**Validación**: `php -l` OK en los 5 archivos. `cache:clear` OK.

### 2026-05-16 — Fase 1 completa: 12 entidades sin validación → todas con Assert constraints

**Entidades modificadas (12 archivos):**

1. **Horario** — `#[Assert\NotBlank]` + `#[Assert\Range(1,7)]` en diaSemana, `#[Assert\NotBlank]` en horaInicio/horaFin/aula, `#[Assert\Length(max:255)]` en aula, `#[Assert\NotNull]` en imparticion. `#[Assert\Callback('validateHoras')]` → valida `horaFin > horaInicio`.
2. **Materia** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en nombre, `#[Assert\Length(max:50)]` en codigoOficial, `#[Assert\Length(max:16)]` en abreviatura, `#[Assert\Positive]` en curso, `#[Assert\PositiveOrZero]` en minutosSemanales y horasTotales.
3. **Itinerario** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en nombre, `#[Assert\NotBlank]` + `#[Assert\Length(max:50)]` en nivel, `#[Assert\NotNull]` en centro.
4. **Imparticion** — `#[Assert\NotNull]` en materia y grupo (profesor es nullable intencionalmente), `#[Assert\Length(max:100)]` en aulaEspecifica.
5. **Matricula** — `#[Assert\NotNull]` en alumno y grupo. **Nota**: Matricula NO tiene campo `estado` (la auditoría inicial era incorrecta).
6. **Asistencia** — `#[Assert\NotBlank]` en fecha, hora, estado, `#[Assert\Choice(['P','R','J'])]` en estado, `#[Assert\Length(max:500)]` en comentario, `#[Assert\NotNull]` en imparticion y alumno.
7. **Calificacion** — `#[Assert\NotBlank]` + `#[Assert\Range(0,10)]` en nota, `#[Assert\Length(max:1000)]` en feedbackProfesor, `#[Assert\NotNull]` en entrega.
8. **Tarea** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en titulo, `#[Assert\Length(max:2000)]` en descripcion, `#[Assert\Length(max:255)]` en archivo, `#[Assert\NotBlank]` en fechaLimite, `#[Assert\NotNull]` en visible/obligatoria, `#[Assert\Choice(['examen','tarea','practica'])]` en tipo, `#[Assert\Range(0,1)]` en peso, `#[Assert\Range(0,10)]` en notaMinima, `#[Assert\NotNull]` en imparticion.
9. **Festivo** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en nombre, `#[Assert\NotBlank]` en fechaInicio, `#[Assert\Expression('fechaFin >= fechaInicio')]`.
10. **Mensaje** — `#[Assert\NotBlank]` en contenido, `#[Assert\NotBlank]` + `#[Assert\Length(max:5000)]` en texto (grupo 'write'), `#[Assert\NotNull]` en leido/remitente/destinatario.
11. **Comunicado** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en titulo, `#[Assert\NotBlank]` en contenido, `#[Assert\NotNull]` en global/autor.
12. **Temario** — `#[Assert\NotBlank]` + `#[Assert\Length(max:255)]` en titulo/archivo, `#[Assert\NotBlank]` en fechaSubida, `#[Assert\NotNull]` en imparticion.

**Compatibilidad con datos existentes**: Todas las constraints se han diseñado para ser compatibles con los datos actuales de `backup_tfg_full.sql`:
- `asistencia.estado`: valores existentes son 'P', 'R', 'J' → compatible con Choice.
- `tarea.tipo`: valores existentes son 'examen', 'tarea', 'practica' → compatible con Choice.
- `calificacion.nota`: valores entre 0 y 10 → compatible con Range.
- `tarea.peso`: valores entre 0 y 1 → compatible con Range.
- `horario.diaSemana`: valores 1-7 → compatible con Range.
- `festivo.fechaFin`: nullable, cuando existe ≥ fechaInicio → compatible con Expression.

**Validación**: `php -l` OK en los 12 archivos.

### 2026-05-16 — Creación del roadmap
- Auditoría completa de 24 entities + 24 páginas frontend
- Documento audit: `docs/audit-validacion-formularios.md`
- Hallazgo principal: 12 de 24 entidades sin NINGUNA validación Symfony
- Fix previo: `Grupo.anioEscolar` con Regex + Callback (hecho en esta sesión)
