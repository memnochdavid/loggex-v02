# Auditoría de Validación de Formularios — Loggex v02

> **Fecha**: 2026-05-16
> **Alcance**: Todos los formularios frontend (`frontend/src/pages/`) + validación backend (`backend/src/Entity/`)
> **Método**: Lectura directa de cada entity PHP y cada página React con formularios

---

## Resumen Ejecutivo

| Categoría | Conteo |
|---|---|
| Entidades con **alguna** validación backend (`#[Assert\...]`) | **12 de 24** |
| Entidades con validación **completa** (NotBlank + Length + constraints de negocio) | **3** (User, ExcepcionHorario, PeriodoLectivo) |
| Entidades con **cero** validación backend | **12** |
| Formularios frontend con validación más allá de `required` HTML5 | **~4** (NIF, nota calificación, algunos inline) |

**Hallazgo principal**: La mayoría de entidades del dominio **no tienen ninguna validación Symfony**. Campos como `nombre`, `descripcion`, `tipo`, `estado`, `nota`, `titulo` en entidades como `Itinerario`, `Materia`, `Imparticion`, `Horario`, `Matricula`, `Asistencia`, `Calificacion`, `Tarea`, `Temario`, `Mensaje`, `Comunicado`, `Festivo` se persisten sin filtro a nivel de entidad. La única red de seguridad es el `length` del `#[ORM\Column]` (que produce un error 500 de Doctrine, no un 422 de validación).

---

## Mapa de Entidades: ¿Tienen validación?

| Entidad | Assert constraints | Cobertura real |
|---|---|---|
| **User** | ✅ NotBlank, Email, Length, Regex, NifEspanol | Parcial: falta password min-length, roles Choice |
| **Centro** | ✅ Expression (fechaInicio < fechaFin) | **Mínima**: sin NotBlank en nombre/cif/direccion, sin NifEspanol en cif, sin Length |
| **Grupo** | ✅ Regex (anioEscolar), Callback (anioEscolar), Positive (curso) | Parcial: sin NotBlank/Length en nombre/abreviatura |
| **ExcepcionHorario** | ✅ NotNull, Length, Callback (coherencia tipo) | **Buena**: valida campos clave + coherencia por tipo |
| **PeriodoLectivo** | ✅ NotNull, PositiveOrZero, NotBlank, Expression, Callback | **Buena**: fechaFin > fechaInicio + solapamientos |
| **JornadaTipo** | ✅ NotBlank, Length, NotNull, JornadaCoherente | **Buena**: constraint custom de coherencia de tramos |
| **PeriodoEvaluativo** | Choice (tipo), Range (peso) | **Mínima**: sin NotBlank en nombre, sin LessThan fechas |
| **Entrega** | Callback (dentro de plazo) | **Mínima**: solo valida fecha límite |
| **Notificacion** | Algunas | Parcial |
| **PonderacionImparticion** | Algunas | Parcial |
| **PeriodoLectivoImparticion** | Algunas | Parcial |
| **JornadaTramo** | Algunas | Parcial |
| **Itinerario** | ❌ **NINGUNA** | Sin NotBlank, Length, Choice en etapa |
| **Materia** | ❌ **NINGUNA** | Sin NotBlank en nombre, sin Range en minutos/horas |
| **Imparticion** | ❌ **NINGUNA** | Sin NotBlank en FKs |
| **Horario** | ❌ **NINGUNA** | Sin Range en diaSemana, sin validar horaFin > horaInicio |
| **Matricula** | ❌ **NINGUNA** | Sin NotBlank en FKs, sin Choice en estado |
| **Asistencia** | ❌ **NINGUNA** | Sin Choice en estado (P/R/J) |
| **Calificacion** | ❌ **NINGUNA** | Sin Range(0,10) en nota |
| **Tarea** | ❌ **NINGUNA** | Sin NotBlank en titulo, sin Choice en tipo |
| **Temario** | ❌ **NINGUNA** | Sin NotBlank en titulo |
| **Mensaje** | ❌ **NINGUNA** | Sin NotBlank en asunto/contenido, sin Count en destinatarios |
| **Comunicado** | ❌ **NINGUNA** | Sin NotBlank en titulo/contenido |
| **Festivo** | ❌ **NINGUNA** | Sin NotBlank en nombre, sin validar fechaInicio ≤ fechaFin |
| **Personalizacion** | ❌ **NINGUNA** | Sin validar estructura JSON |

---

## Gaps Críticos (datos corruptos posibles)

### C1. `Horario.horaFin > horaInicio` — NO validado en ningún lado
- **Entidad**: `Horario.php` — cero Assert constraints
- **Frontend**: dos inputs `type="time"` independientes sin comparación
- **Riesgo**: horarios "09:00–08:00" persistidos sin error

### C2. `Calificacion.nota` en [0, 10] — NO validado en backend
- **Entidad**: `Calificacion.php` — cero Assert constraints
- **Frontend**: `min=0, max=10` HTML5 (bypasseable manipulando DOM)
- **Riesgo**: notas de -5, 15, 999 en BD → medias incorrectas

### C3. `Itinerario.nombre` — sin NotBlank ni Length
- **Entidad**: `Itinerario.php` — cero Assert constraints
- **Frontend**: `required` HTML5, sin maxLength
- **Riesgo**: nombre vacío (vía API directa) o de 10000 chars

### C4. `Materia.nombre` — sin NotBlank ni Length
- **Entidad**: `Materia.php` — cero Assert constraints
- **Frontend**: `required` HTML5, sin maxLength
- **Riesgo**: igual que C3

### C5. `Festivo.fechaInicio ≤ fechaFin` — NO validado en ningún lado
- **Entidad**: `Festivo.php` — cero Assert constraints
- **Frontend**: dos inputs `type="date"` independientes sin comparación
- **Riesgo**: rangos invertidos de festivos

### C6. `Tarea.titulo` — sin NotBlank ni Length
- **Entidad**: `Tarea.php` — cero Assert constraints
- **Frontend**: `required` HTML5, sin maxLength
- **Riesgo**: título vacío o excesivamente largo

### C7. `Horario.diaSemana` en [1, 7] — NO validado en backend
- **Entidad**: `Horario.php` — cero Assert constraints
- **Frontend**: `<select>` con opciones 1-7 (bypasseable)
- **Riesgo**: diaSemana = 0, 8, 99 → rotura del render de rejilla

### C8. `Asistencia.estado` en {P, R, J} — NO validado en ningún lado
- **Entidad**: `Asistencia.php` — cero Assert constraints
- **Frontend**: `<select>` con 3 opciones (bypasseable)
- **Riesgo**: estado = "X", "presente", "ausente" → rotura de summary

### C9. `Matricula.estado` en {activa, baja, pendiente} — NO validado
- **Entidad**: `Matricula.php` — cero Assert constraints
- **Frontend**: `<select>` (bypasseable)
- **Riesgo**: estados arbitrarios

### C10. `Centro.cif` — sin NifEspanol, sin Length
- **Entidad**: `Centro.php` — solo Expression de fechas; nombre/cif/direccion sin NotBlank ni Length
- **Frontend**: `useFormValidation(['nif'])` sí valida NIF
- **Riesgo**: CIF inválido aceptado si se salta el frontend

### C11. `Centro.nombre` — sin NotBlank
- **Entidad**: `Centro.php` — sin Assert en nombre
- **Frontend**: `required` HTML5
- **Riesgo**: centro sin nombre vía API directa

### C12. `Imparticion` FKs — sin NotBlank
- **Entidad**: `Imparticion.php` — cero Assert constraints
- **Frontend**: `required` HTML5 en selects
- **Riesgo**: impartición sin materia, sin profesor o sin grupo

### C13. `Mensaje.asunto/contenido` — sin NotBlank ni Length
- **Entidad**: `Mensaje.php` — cero Assert constraints
- **Frontend**: `required` HTML5, sin maxLength
- **Riesgo**: mensajes vacíos o de 50000 chars

### C14. `Comunicado.titulo/contenido` — sin NotBlank ni Length
- **Entidad**: `Comunicado.php` — cero Assert constraints
- **Frontend**: `required` HTML5, sin maxLength
- **Riesgo**: comunicados vacíos o excesivamente largos

---

## Gaps Moderados (UX / consistencia)

### M1. `password` sin longitud mínima en frontend
- Backend: sin Assert\Length(min:8) en User (solo ORM\Column)
- Frontend: `required` HTML5, sin minLength
- **Fix**: añadir minLength=8 en frontend + Assert\Length(min:8, groups=['create']) en backend

### M2. `telefono` regex español solo en backend (User)
- Backend: `#[Assert\Regex('/^[6-9]\d{8}$/')]` ✅
- Frontend: `type="tel"` sin pattern — acepta "+34 600 000 000", "600-000-000", etc.
- Centro: sin validación de teléfono en absoluto

### M3. Archivos sin validación frontend (foto, logo, temario, entregas, mensajes)
- Backend: algunos controllers validan MIME/tamaño, pero las entities no siempre tienen `#[Assert\File]`
- Frontend: inputs `type="file"` sin accept ni validación JS de tamaño

### M4. Campos text sin maxLength en frontend (cuando el ORM lo limita)
- `Centro.nombre` (255), `Centro.direccion` (255), `Itinerario.nombre` (255), etc.
- El ORM corta silenciosamente o produce error 500 si se excede

### M5. `PeriodoEvaluativo.fechaInicio < fechaFin` — sin validar
- Backend: sin Assert\LessThan (solo Choice en tipo, Range en peso)
- Frontend: dos inputs date sin comparación
- Centro: sí tiene Expression para fechaInicioCurso < fechaFinCurso, pero PeriodoEvaluativo no

### M6. `Grupo.nombre/abreviatura` — sin NotBlank/Length
- Backend: sin Assert en nombre ni abreviatura (sí tiene Positive en curso, Regex en anioEscolar)
- Frontend: `required` HTML5

### M7. `User.roles` — sin Choice
- Backend: `array $roles` sin Assert\Choice
- Frontend: checkboxes sin validación de roles permitidos

### M8. `Itinerario.etapa` — sin Choice
- Backend: sin Assert\Choice (enum EtapaEducativa existe pero no se valida)
- Frontend: `<select>` con opciones hardcodeadas

### M9. `Materia.modalidad` — sin Choice
- Backend: sin Assert\Choice (enum existe pero no se valida)
- Frontend: `<select>`

### M10. `JornadaTipo.turno` — sin Choice
- Backend: sin Assert\Choice (solo NotBlank en nombre, NotNull en tramos)
- Frontend: `<select>`

### M11. Validación condicional de ExcepcionHorario en frontend
- Backend: Callback valida coherencia tipo→campos ✅
- Frontend: muestra/oculta campos según tipo pero no bloquea submit con datos incompletos

---

## Patrones Positivos Encontrados

| Patrón | Dónde |
|---|---|
| `useFormValidation` hook con NIF | User, Centro |
| `#[NifEspanol]` constraint custom | User |
| `#[JornadaCoherente]` constraint custom | JornadaTipo |
| `#[Assert\Callback]` para validación de negocio | Grupo, ExcepcionHorario, PeriodoLectivo, Entrega |
| `#[Assert\Expression]` para comparación de campos | Centro (fechas), PeriodoLectivo (fechas) |
| Soft delete consistente | Todas las entities con TimestampableTrait |
| `parseErrorResponse` maneja errores 422 | Todos los formularios frontend |
| Confirm modal para acciones destructivas | La mayoría de CRUDs |

---

## Recomendaciones Prioritarias

### Fase 1 — Gaps críticos (impedir datos corruptos)
1. **Añadir `#[Assert\...]` a las 12 entidades sin ninguna validación** (Itinerario, Materia, Imparticion, Horario, Matricula, Asistencia, Calificacion, Tarea, Temario, Mensaje, Comunicado, Festivo)
2. **Validación cross-field en frontend**: `horaFin > horaInicio`, `fechaInicio ≤ fechaFin`, `nota ∈ [0,10]`
3. **Completar validación en entidades parciales**: Centro (NotBlank en nombre/cif, NifEspanol en cif, Length), PeriodoEvaluativo (NotBlank, LessThan fechas), Grupo (NotBlank/Length en nombre/abreviatura)

### Fase 2 — Consistencia frontend↔backend
4. `password` minLength=8 en frontend + Assert\Length(min:8) en backend
5. Choices validados en frontend (etapa, modalidad, turno, estado, tipo)
6. maxLength en inputs frontend que lo tienen en ORM
7. Validación de archivos en frontend (tamaño + tipo)

### Fase 3 — Robustez adicional
8. CSRF en endpoints custom con cookies
9. Validación de solapamientos de horarios
10. Sanitización de nombres de archivo subidos
11. Debounce en búsquedas de AsyncSearchSelect

---

## Detalle por Entidad

### User (`User.php`) — Parcial
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| email | NotBlank, Email, Length(180) | required, type="email" | ✅ |
| nombre | NotBlank, Length(255) | required | ⚠️ sin maxLength |
| apellidos | NotBlank, Length(255) | required | ⚠️ sin maxLength |
| password | **NINGUNO** (solo ORM\Column) | required | 🔴 sin min-length |
| telefono | Length(20), Regex español | type="tel" | ⚠️ sin pattern |
| nif | Length(20), NifEspanol | useFormValidation | ✅ |
| roles | **NINGUNO** | checkboxes | ⚠️ sin Choice |
| foto | **NINGUNO** en entity | sin validación | ⚠️ sin tamaño/tipo |

### Centro (`Centro.php`) — Mínimo
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| cif | **NINGUNO** | useFormValidation(['nif']) | 🔴 sin NifEspanol en BE |
| direccion | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| telefono | **NINGUNO** | type="tel" | 🔴 sin regex |
| logo | **NINGUNO** en entity | sin validación | ⚠️ sin tamaño/tipo |
| fechaInicio/FinCurso | Expression (inicio < fin) | dos date inputs | ✅ |

### Grupo (`Grupo.php`) — Parcial
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| abreviatura | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| curso | Positive | required | ⚠️ sin Positive en FE |
| anioEscolar | Regex, Callback (año+1) | select de años | ✅ (recién fixeado) |
| aulaDefault | **NINGUNO** | sin validación | ⚠️ sin Length |

### Itinerario (`Itinerario.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 |
| abreviatura | **NINGUNO** | sin required | 🔴 |
| descripcion | **NINGUNO** | sin validación | 🔴 |
| etapa | **NINGUNO** | select | 🔴 sin Choice |
| jornadaTipo | **NINGUNO** | select | ⚠️ |
| anioInicio | **NINGUNO** | sin validación | ⚠️ |

### Materia (`Materia.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 |
| abreviatura | **NINGUNO** | sin required | 🔴 |
| minutosSemanales | **NINGUNO** | sin validación | 🔴 sin PositiveOrZero |
| horasTotales | **NINGUNO** | sin validación | 🔴 sin PositiveOrZero |
| modalidad | **NINGUNO** | select | 🔴 sin Choice |

### Horario (`Horario.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| diaSemana | **NINGUNO** | select 1-7 | 🔴 sin Range(1,7) |
| horaInicio | **NINGUNO** | required, type="time" | 🔴 |
| horaFin | **NINGUNO** | required, type="time" | 🔴 sin > horaInicio |
| aula | **NINGUNO** | required | 🔴 sin Length |

### Imparticion (`Imparticion.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| materia | **NINGUNO** | required | 🔴 sin NotBlank |
| profesor | **NINGUNO** | required | 🔴 sin NotBlank |
| grupo | **NINGUNO** | required | 🔴 sin NotBlank |
| aulaEspecifica | **NINGUNO** | sin validación | ⚠️ sin Length |
| modalidad | **NINGUNO** | select | 🔴 sin Choice |

### Matricula (`Matricula.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| alumno | **NINGUNO** | required | 🔴 sin NotBlank |
| grupo | **NINGUNO** | required | 🔴 sin NotBlank |
| estado | **NINGUNO** | select | 🔴 sin Choice |

### Asistencia (`Asistencia.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| estado | **NINGUNO** | select P/R/J | 🔴 sin Choice |
| fecha | **NINGUNO** | sin validación | 🔴 sin NotBlank |
| comentario | **NINGUNO** | sin validación | ⚠️ sin Length |

### Calificacion (`Calificacion.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nota | **NINGUNO** | min=0, max=10 HTML5 | 🔴 sin Range(0,10) |
| feedbackProfesor | **NINGUNO** | sin validación | ⚠️ sin Length |

### Tarea (`Tarea.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| titulo | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| descripcion | **NINGUNO** | sin validación | ⚠️ sin Length |
| tipo | **NINGUNO** | select | 🔴 sin Choice |
| fechaLimite | **NINGUNO** | sin validación | ⚠️ sin DateTime |
| notaMinima | **NINGUNO** | sin validación | ⚠️ sin Range |

### Festivo (`Festivo.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| fechaInicio | **NINGUNO** | required, type="date" | 🔴 sin ≤ fechaFin |
| fechaFin | **NINGUNO** | required, type="date" | 🔴 |

### Mensaje (`Mensaje.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| asunto | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| contenido | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| destinatarios | **NINGUNO** | JS check | 🔴 sin Count(min:1) |

### Comunicado (`Comunicado.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| titulo | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| contenido | **NINGUNO** | required | 🔴 sin NotBlank/Length |

### Temario (`Temario.php`) — **CERO validación**
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| titulo | **NINGUNO** | required | 🔴 sin NotBlank/Length |

### ExcepcionHorario (`ExcepcionHorario.php`) — Buena ✅
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| tipo | Choice implícito (enum) | required, select | ✅ |
| horarioBase | NotNull | required | ✅ |
| fechaConcreta | NotNull | required, type="date" | ✅ |
| motivo | Length(2000) | required | ⚠️ sin maxLength FE |
| observaciones | Length(2000) | sin required | ✅ |
| profeOverride | NotNull (condicional) | condicional | ⚠️ validación condicional solo BE |
| Callback coherencia | ✅ valida tipo→campos | — | ✅ |

### PeriodoLectivo (`PeriodoLectivo.php`) — Buena ✅
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| grupo | NotNull | required | ✅ |
| nombre | NotBlank | required | ✅ |
| fechaInicio | NotBlank | required | ✅ |
| fechaFin | Expression (fin > inicio) | required | ✅ |
| semanasReferenciaCentro | PositiveOrZero | sin validación | ⚠️ |
| Callback solapamientos | ✅ | — | ✅ |

### JornadaTipo (`JornadaTipo.php`) — Buena ✅
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | NotBlank, Length(100) | required | ⚠️ sin maxLength FE |
| tramos | NotNull | validación JS | ⚠️ coherencia solo BE |
| diasLectivos | NotNull | multi-select | ⚠️ sin Choice FE |
| turno | **NINGUNO** | select | 🔴 sin Choice |
| JornadaCoherente | ✅ constraint custom | — | ✅ |

### PeriodoEvaluativo (`PeriodoEvaluativo.php`) — Mínimo
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| nombre | **NINGUNO** | required | 🔴 sin NotBlank/Length |
| fechaInicio | **NINGUNO** | required, type="date" | 🔴 sin ≤ fechaFin |
| fechaFin | **NINGUNO** | required, type="date" | 🔴 |
| tipo | Choice(['ordinaria','extraordinaria']) | required, select | ✅ |
| peso | Range(0,1) | sin validación | ⚠️ |

### Entrega (`Entrega.php`) — Mínimo
| Campo | Backend | Frontend | Gap |
|---|---|---|---|
| tarea | **NINGUNO** | required | 🔴 sin NotBlank |
| Callback dentroDePlazo | ✅ | — | ✅ |
