# Hoja de ruta — Renombrado para neutralidad de etapa educativa

**Estado:** En preparación · creado 2026-04-25
**Objetivo:** Eliminar la nomenclatura específica de FP en entidades, rutas y traducciones para alinearlas con el vocabulario neutro que ya usa el catálogo oficial. **No** se cambia la forma de los datos (campos, validaciones, comportamiento) — eso es la Fase 12 de `catalogo-oficial.md` y queda fuera de este refactor.

---

## 1. Contexto

Tras implementar el catálogo oficial educativo (`docs/catalogo-oficial.md`, §1–17) tenemos una contradicción terminológica en el código:

- El **catálogo** habla de `CatalogoItinerario` y `CatalogoMateria` (vocabulario neutro: vale para FP, ESO, Bachillerato, Universidad).
- Las **entidades del centro** siguen llamándose `CicloFormativo`, `Modulo`, `Material`, `Tema` (vocabulario solo-FP, plus un `Tema` que en realidad es visual y se confunde con el educativo).

Esto no rompe nada hoy, pero:
- Cada vez que un programador lee el código tiene que mantener dos vocabularios.
- Cuando un día llegue un centro no-FP, el código grita "esto es solo para FP" en cada URL/clase/translation key.
- La materialización catálogo→centro (§2.3 del doc) no se aprecia hasta entender que `CatalogoItinerario` y `CicloFormativo` son la misma cosa con dos nombres.

Decisión: **renombrar a vocabulario neutro ahora**, mientras los datos del centro son fixtures desechables (sesión barata). La refactorización de comportamiento (campos opcionales por etapa, validación condicional) queda para más adelante.

## 2. Alcance

### 2.1 Entidades renombradas

| Antes | Después | Razón |
|---|---|---|
| `CicloFormativo` | `Itinerario` | Neutro entre etapas; alinea con `CatalogoItinerario` |
| `Modulo` | `Materia` | Neutro; alinea con `CatalogoMateria` |
| `Material` | `Temario` | El UI ya lo llama "Temario" en español; libera "materia" |
| `Tema` | `TemaVisual` | Es el tema visual del centro (colores, estilos), no contenido educativo. Renombrar evita confusión con la jerarquía Itinerario→Materia→Temario→tema-pedagógico |

### 2.2 Entidades sin cambios

`User`, `Centro`, `Grupo`, `Matricula`, `Imparticion`, `Horario`, `Festivo`, `Personalizacion`, `Asistencia`, `Calificacion`, `Tarea`, `Entrega`, `Mensaje`, `Comunicado`, `CatalogoItinerario`, `CatalogoMateria`, `CatalogoCentro`.

### 2.3 Lo que NO se cambia en este refactor

- Campos de las entidades (siguen con la forma de FP: `familiaProfesional`, `horasSemanales` obligatorio, etc.).
- Reglas de validación.
- Lógica de negocio.
- Permisos y filtros por centro.

Esos cambios pertenecen a la Fase 12 (multi-etapa) del doc del catálogo y se harán cuando aparezca un centro no-FP real.

## 3. Plan en fases

### Fase A — Commit del estado actual (UI catálogo)

Cerrar lo que está hecho hasta ahora antes de tocar nada del rename — el diff del rename no debe mezclarse con el diff de la UI del catálogo.

```bash
git add -A
git commit -m "feat(catalogo): vista admin read-only con DataProvenanceBanner y AcercaPage"
```

### Fase B — Backup y preservación de datos

Las únicas tablas cuyos datos preservamos: `user`, `centro`, `personalizacion`, `comunicado`, `tema` (que pasará a `tema_visual`). El resto es fixtures desechables.

**Estrategia:**
1. Confirmar que `backup_tfg_full.sql` está actualizado: si no, regenerarlo (`scripts/backup_db.sh`).
2. Generar `backup_preserve.sql` filtrando solo las 5 tablas mencionadas. **Importante:** la tabla `tema` se renombra a `tema_visual`, así que el `INSERT INTO tema` debe convertirse a `INSERT INTO tema_visual` en el script de filtrado.
3. Guardar `backup_preserve.sql` en raíz del proyecto (gitignored).

### Fase C — Inventario

Antes de tocar código, listar TODAS las referencias para evitar olvidos.

**Comandos clave** (mantenidos aquí para no repetir descubrimiento):

```bash
# Backend: clases y referencias a CicloFormativo / Modulo / Material / Tema
grep -rn "CicloFormativo\|\\bModulo\\b\|\\bMaterial\\b\|\\bTema\\b" backend/src/ --include="*.php"

# Backend: nombres de propiedad y método
grep -rn "ciclo_formativo\|cicloFormativo\|getCicloFormativo\|setCicloFormativo" backend/src/ --include="*.php"
grep -rn "->modulo\|getModulo\|setModulo" backend/src/ --include="*.php"
grep -rn "->material\|getMaterial\|setMaterial" backend/src/ --include="*.php"

# Frontend: rutas API y componentes
grep -rn "/api/ciclos\|/api/modulos\|/api/materiales\|/api/temas" frontend/src/
grep -rn "/ciclos\|/modulos\|/materiales" frontend/src/   # rutas SPA

# Frontend: imports y nombres de archivo
grep -rn "CicloFormativo\|CiclosFormativos\|Modulos\|Materiales" frontend/src/

# Translations
grep -rn "cycles\|modules\|materials\|cyclesLong" frontend/src/i18n/

# Migrations (las del catálogo no se tocan; las del centro se squashean)
ls backend/migrations/Version*.php
```

Volcado del inventario a `/tmp/rename-inventory.md` (gitignored) para revisión humana antes de tocar nada.

### Fase D — Renombrado backend

Orden estricto (Doctrine y FK):

1. **Renombrar archivos de entidad**:
   - `src/Entity/CicloFormativo.php` → `Itinerario.php`
   - `src/Entity/Modulo.php` → `Materia.php`
   - `src/Entity/Material.php` → `Temario.php`
   - `src/Entity/Tema.php` → `TemaVisual.php`
2. **Renombrar archivos de repositorio** correspondientes.
3. **Find/replace global en backend/src/**:
   - `CicloFormativo` → `Itinerario` (clase, namespace use)
   - `cicloFormativo` → `itinerario` (variables, propiedades)
   - `Modulo` → `Materia` (¡cuidado con falsos positivos: `module:` en YAML, `<module>` en XML!)
   - `Material` → `Temario`
   - `Tema` (clase) → `TemaVisual` (atención: muchos otros usos de "tema" en strings — usar regex con límite de palabra y checkear caso a caso)
   - `getModulo`, `setModulo`, `->modulo` → versión `Materia`
   - Lo mismo para los demás
4. **Renombrar tablas** vía atributo `#[ORM\Table(name: 'itinerario')]` etc. — Doctrine los deriva, pero ser explícito ayuda.
5. **Squash de migraciones** del centro (las `catalogo_*` son posteriores y se mantienen):
   - Borrar `migrations/Version*.php` excepto las de catálogo (`Version20260425*`).
   - `bin/console make:migration` genera UNA migración con el esquema entero ya con nombres nuevos.
6. **API resource paths**: añadir `uriTemplate` a los `#[ApiResource]` si no es lo que API Platform deriva por defecto:
   - `Itinerario` → `/api/itinerarios` (en vez de `/api/itinerarios` por default — ya OK, pero confirmar)
   - `Materia` → `/api/materias`
   - `Temario` → `/api/temarios`
   - `TemaVisual` → `/api/tema_visuals` ← **mejorar** a `/api/temas_visuales` con `uriTemplate`.
7. **Fixtures**: actualizar nombres de método y referencias.

### Fase E — Renombrado frontend

1. **Renombrar archivos de página**:
   - `pages/CiclosFormativos.jsx` → `Itinerarios.jsx`
   - `pages/Modulos.jsx` → `Materias.jsx`
   - `pages/MaterialesAlumno.jsx` → `TemariosAlumno.jsx`
   - `pages/MaterialesProfesor.jsx` → `TemariosProfesor.jsx`
2. **Rutas en `App.jsx`**: `/ciclos` → `/itinerarios`, `/modulos` → `/materias`, `/apuntes` y `/mis-temarios` mantener (ya tienen nombre semántico OK).
3. **API calls**: `fetch('/api/ciclos…')` → `'/api/itinerarios…'` en todos los pages.
4. **Sidebar.jsx**: items, `data-tour="sidebar-…"`, `routeToAccordionMap`.
5. **Traducciones (5 idiomas)**:
   - `sidebar.cycles` → `sidebar.itinerarios`
   - `sidebar.cyclesLong` → `sidebar.itinerariosLong`
   - `sidebar.modules` → `sidebar.materias`
   - `myMaterials` se queda (la UI ya dice "Mis Temarios", la clave puede mantenerse o renombrarse a `myTemarios` por coherencia — preferiría renombrarla).
6. **Imports**: actualizar todos los `import CiclosFormativos from …` etc.

### Fase F — Reset y reseed

```bash
# 1. Vaciar el esquema y aplicar migraciones nuevas
sudo docker compose exec backend php bin/console doctrine:schema:drop --full-database --force
sudo docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

# 2. Restaurar las 5 tablas preservadas (user, centro, personalizacion, comunicado, tema_visual)
cat backup_preserve.sql | sudo docker compose exec -T database mariadb -u app_user -papp_password app_db

# 3. Refrescar el catálogo oficial (las tablas catalogo_* eran independientes;
#    si NO se han borrado el drop schema, este paso es opcional)
sudo docker compose exec backend php bin/console app:catalogo:refresh
sudo docker compose exec backend php bin/console app:catalogo:enrich-boe

# 4. (opcional) Fixtures de demo para tener itinerarios/materias/grupos de prueba
sudo docker compose exec backend php bin/console doctrine:fixtures:load --append --no-interaction
```

**Atención**: `doctrine:schema:drop --full-database` borra TODAS las tablas, incluidas `catalogo_*`. Tras eso hay que re-ejecutar el catálogo (`refresh` + `enrich-boe`) — no es problema, son ~5 minutos.

### Fase G — Verificación

Lista de comprobación end-to-end:

- [ ] Login con usuario admin existente del backup → sigue funcionando.
- [ ] Sidebar muestra "Itinerarios", "Materias", "Temarios" correctamente en español.
- [ ] `/admin/catalogo/itinerarios` carga 228+ itinerarios.
- [ ] `/admin/catalogo/itinerarios/:id` muestra módulos.
- [ ] CRUD de itinerarios del centro `/itinerarios` (antes `/ciclos`) funciona: crear, editar, borrar.
- [ ] CRUD de materias del centro `/materias` funciona.
- [ ] CRUD de temarios `/mis-temarios` o `/apuntes` funciona.
- [ ] Tema visual del centro sigue aplicándose tras login (la columna `tema` ahora `tema_visual`).
- [ ] Mensajes y comunicados intactos.
- [ ] Tests PHPUnit pasan (si los hay relevantes).

### Fase H — Commit y docs

```bash
git add -A
git commit -m "refactor: rename CicloFormativo→Itinerario, Modulo→Materia, Material→Temario, Tema→TemaVisual"
```

Actualizar:
- `CLAUDE.md`: lista de "Entidades Principales".
- `docs/catalogo-oficial.md`: §13 (snapshot post-refactor) y §2.3 (materialización ahora consistente).
- Esta hoja de ruta: marcar fases como "✅ completada".

## 4. Estado / progreso

Marcar cada checkbox al finalizar la fase. Permite retomar el refactor en sesiones posteriores sin tener que reconstruir el contexto.

- [x] Fase A — Commit catálogo UI actual *(commit `c235887`)*
- [x] Fase B — `backup_preserve.sql` generado y validado *(354 líneas, 5 tablas: centro, comunicado, personalizacion, tema_visual, usuario; FK chequeadas; gitignored)*
- [x] Fase C — Inventario completo en `/tmp/rename-inventory.md` *(11 archivos backend con refs, 4 entidades + 4 repos a renombrar; 4 pages frontend; 5 archivos i18n)*
- [x] Fase D — Backend renombrado *(11 archivos físicos via `git mv`, ~50 archivos modificados por sed `/tmp/rename-backend.sh`, 0 errores `php -l`, 0 referencias residuales a CicloFormativo/Modulo/Material/Tema)*. **Pendiente squash:** las 5 migraciones viejas borradas; falta ejecutar `make:migration` en el container para generar la unificada (se hará en Fase F antes del migrate)
- [x] Fase E — Frontend renombrado *(4 archivos page renombrados con `git mv`; `/tmp/rename-frontend.sh` aplicó imports, rutas SPA, llamadas `/api/*`, `data-tour`, claves i18n en 5 locales; passes posteriores cubrieron `Modulos`/`Modulo` bare en `App.jsx` y `erModel.js`, tour ids, refs `t('sidebar.cycles…')`. JSON locales validados con `node -e JSON.parse`)*
- [ ] Fase F — DB drop + migrate + restore + catálogo refresh ejecutados *(script `scripts/post-rename-reset.sh` listo; pendiente ejecución `sudo bash scripts/post-rename-reset.sh`)*
- [ ] Fase G — Verificación end-to-end manual
- [ ] Fase H — Commit final + docs actualizados

## 5. Riesgos y rollback

**Si algo falla a mitad**:
- Hasta Fase D incluido: `git reset --hard HEAD` deshace todo (no se ha tocado BD).
- En Fase F (drop+restore): si el restore falla, restaurar `backup_tfg_full.sql` completo con `scripts/restore_db.sh`. La BD vuelve al estado pre-refactor pero con esquema VIEJO — habría que revertir también el código (`git reset`).

**Riesgos específicos**:

1. **Falsos positivos en find/replace**: `Modulo` aparece en cosas como Apache `mod_…`, comentarios en YAML, `<modulo>` en XML… Hacer find/replace **palabra-completa** y revisar antes de aplicar.
2. **Nombre de columna FK**: `imparticion.modulo_id` se renombra a `imparticion.materia_id` automáticamente por Doctrine si la propiedad pasa de `$modulo` a `$materia`. Pero si hay queries SQL crudas (`createNativeQuery`, DQL), hay que revisarlas a mano.
3. **Frontend hard-coded paths**: aparte de `fetch()`, puede haber URLs en strings de `Link to=`, `navigate(…)`, `window.location` — el grep de Fase C las captura todas.
4. **Tests rotos**: si el centro tiene tests de integración que crean ciclos, rompen. Actualizarlos con los nuevos nombres.

## 6. Apéndice: comandos útiles

```bash
# Verificar nombres de tablas reales en la BD
sudo docker compose exec database mysql -uapp_user -papp_password app_db -e "SHOW TABLES"

# Verificar foreign keys
sudo docker compose exec database mysql -uapp_user -papp_password app_db -e "
  SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA='app_db' AND REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY TABLE_NAME"

# Lint de PHP tras el refactor
find backend/src -name "*.php" -exec php -l {} \; 2>&1 | grep -v "No syntax errors"

# Build de frontend para detectar imports rotos
sudo docker compose exec frontend npm run build
```
