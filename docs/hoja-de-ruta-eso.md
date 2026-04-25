# Hoja de ruta — Soporte de Educación Secundaria Obligatoria (ESO)

**Estado:** En implementación · creado 2026-04-25
**Objetivo:** Que un centro de ESO pueda usar Loggex con catálogo oficial nacional cargado, formularios que respeten la forma de datos ESO (no FP) y terminología adecuada.

Esta hoja arranca tras el cierre de Fase 1 del catálogo (FP) y el rename a vocabulario neutro de §18 — prerequisitos sin los cuales este trabajo sería el doble.

---

## 1. Alcance del MVP-ESO

### 1.1 Dentro
- Catálogo nacional ESO (RD 217/2022 LOMLOE) cargado vía adapter `BoeEsoAdapter`.
- Validaciones condicionales por etapa: `familia` y `horasTotales` opcionales; `horasSemanales` obligatorio en ESO.
- UX y traducciones contextuales: el formulario "Nuevo Itinerario" muestra/oculta campos según etapa; el sidebar y títulos se adaptan.
- Vista admin del catálogo (§17 de `catalogo-oficial.md`) ya incluye `EtapaEducativa::ESO` en el filtro — basta con que el adapter ingeste registros con esa etapa.

### 1.2 Fuera (queda para iteraciones posteriores)
- **Variantes por CCAA** (Andalucía 102/2023, Madrid 65/2022, etc.). El RD nacional fija enseñanzas mínimas pero la distribución horaria por curso la decide cada autonomía. Sin esto, las h/sem son "estándar" del RD, no oficiales por región.
- **Evaluación competencial LOMLOE**: ESO introduce evaluación por competencias (saber decir / saber hacer / saber ser) y boletines trimestrales por asignaturas. Si un centro ESO real lo necesita, es otro proyecto.
- **Boletines y horarios específicos de ESO**: las pantallas existentes asumen estructura FP. Funcionarán con datos ESO pero con etiquetas adaptadas, no con flujos pedagógicos diferenciados.
- **Bachillerato y otras etapas**: aplica el mismo patrón, se hará si hace falta.

## 2. Plan en fases

| Fase | Esfuerzo aprox. | Entregable |
|---|---|---|
| **A — Investigación BOE** | 0.5 día | Inspección manual del RD 217/2022, identificación de estructura XML (similar a §51 del catálogo FP), definición de selectores |
| **B — Adapter y parser** | 2-3 días | `BoeEsoAdapter`, `EsoCurriculumParser`, integración con `CatalogoIngestService` |
| **C — Refresh y verificación** | 0.5 día | `app:catalogo:refresh boe_eso` carga 30-40 materias por curso; verificación SQL de cobertura |
| **D — Campos opcionales por etapa** | 1-2 días | `Itinerario.familia` nullable según etapa; `Materia.horasTotales` opcional; validaciones condicionales |
| **E — UX adaptativa** | 2-3 días | Formulario "Nuevo Itinerario" oculta campos no aplicables; helper `useTerminologia` o equivalente para textos contextuales |
| **F — i18n y refresco final** | 1 día | Traducciones de claves nuevas en 5 locales; verificación end-to-end con un centro de ESO de prueba |

**Total estimado**: 7-10 días de trabajo.

## 3. Estado / progreso

- [x] Fase A — Investigación BOE RD 217/2022 *(Anexo IV es tabla limpia con 3 secciones marcadas por `<em>`; nombres con `*` final = optativas)*
- [x] Fase B — `BoeEsoAdapter` + parser implementados *(28 materias extraídas, smoke test pasa, lint OK; auto-registrado vía `_instanceof`)*
- [x] Fase C — Refresh ejecutado *(1 itinerario "Educación Secundaria Obligatoria" persistido con sus 28 materias)*
- [x] Fase D — Campos opcionales: `Materia.horasSemanales` ahora nullable + nuevo campo `Materia.tipo` (enum). Materialización catalogo→centro propaga `tipo`. **Pendiente migration**: ejecutar `make:migration` + `migrate` para aplicar el ALTER. Pasada de limpieza de residuos del rename anterior en Materias.jsx, Grupos.jsx, Itinerarios.jsx (formData.ciclo → formData.itinerario, /api/ciclo_formativos → /api/itinerarios, etc.).
- [x] Fase E — Formularios y terminología adaptativos *(AsyncSearchSelect de "Nuevo Itinerario" abierto a todas las etapas; `mapNivel` materialización soporta Primaria/ESO/Bach; form Materias añade select `tipo` y acepta `horasSemanales` vacío. Bug fix crítico: `TipoMateria::MODULO = 'modulo'` (el sed del rename §18 lo había roto). Migration `Version20260425210000` para corregir datos existentes.)*
- [ ] Fase F — i18n + verificación end-to-end

## 4. Riesgos conocidos

- **Estructura del RD 217/2022 puede no parecerse a la de los RDs de FP.** ESO es enseñanzas mínimas, no un título profesional; la organización del XML es probablemente por bloques curriculares y competencias, no por anexos/módulos. Se descubre en Fase A.
- **No hay "código oficial" estable para asignaturas de ESO** como sí lo hay para módulos FP (5021, 0483, etc.). Habrá que sintetizar uno (`ESO-LCL-1` para Lengua Castellana 1º ESO) o usar el código que el RD asigne.
- **Distribución horaria nacional vs CCAA**: el RD da "horas mínimas totales por etapa" o "rangos". Los datos h/sem por curso son normalmente CCAA, no nacionales. Habrá que asumir un valor estándar y dejar claro que es indicativo.
- **El menú "Nuevo Itinerario"** del frontend hoy filtra por `EtapaEducativa::FP_*` en el AsyncSearchSelect. Habrá que generalizar para que muestre todas las etapas activas según la oferta del centro.

## 5. Apéndice: comandos útiles

```bash
# Fetch del RD 217/2022 para inspección manual
curl -A "Loggex-Catalogo/1.0" "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2022-4975" -o /tmp/boe-rd217-2022.xml

# Ejecutar refresh ESO (cuando el adapter esté listo)
sudo docker compose exec backend php bin/console app:catalogo:refresh boe_eso --dry-run
sudo docker compose exec backend php bin/console app:catalogo:refresh boe_eso
```
