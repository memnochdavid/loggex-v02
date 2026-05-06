/**
 * Helpers para el modelo semanal de PeriodoLectivo (refactor 2026-05-06).
 *
 * Modelo: cada grupo tiene 1 PL `tipo='plantilla'` (sin fechas, default del
 * curso) + 0..N PL `tipo='semana'` (con fechas, override puntual de una
 * semana concreta — intercambio profe, sustitución, semana cultural, etc.).
 *
 * El editor `/admin/horarios` y otras vistas componen plantilla + semana
 * al renderizar. Estos helpers centralizan la lógica para no duplicarla.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md.
 */

/**
 * Identifica si un PL es la plantilla del grupo. Acepta tanto el string
 * que llega del API ('plantilla') como el caso legacy con tipo undefined
 * (que tratamos como SEMANA legacy si tiene fechas, plantilla si no).
 */
export const isPlantilla = (pl) => {
    if (!pl) return false;
    if (pl.tipo) return pl.tipo === 'plantilla';
    // Legacy fallback: PL sin tipo y sin fechas → tratamos como plantilla.
    return !pl.fechaInicio && !pl.fechaFin;
};

export const isSemana = (pl) => {
    if (!pl) return false;
    if (pl.tipo) return pl.tipo === 'semana';
    return !!(pl.fechaInicio && pl.fechaFin);
};

/**
 * Duración del PL en semanas, redondeada con 1 decimal.
 *
 * - Para PLANTILLA: devuelve `fallbackSemanas` (típicamente las semanas
 *   lectivas del centro vía `semanasLectivasByCentro[centroId]` o 36 LOMLOE).
 * - Para SEMANA: `(fechaFin - fechaInicio + 1) / 7`. Como una SEMANA
 *   suele cubrir 7 días, devuelve ~1.0.
 * - Si las fechas faltan en una SEMANA (no debería), devuelve 0.
 */
export const getSemanasOfPl = (pl, fallbackSemanas = 36) => {
    if (!pl) return 0;
    if (isPlantilla(pl)) return fallbackSemanas;
    if (!pl.fechaInicio || !pl.fechaFin) return 0;
    const ini = new Date(String(pl.fechaInicio).slice(0, 10));
    const fin = new Date(String(pl.fechaFin).slice(0, 10));
    const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
    return days / 7;
};

/**
 * Ordena PLs para presentación en UI: la PLANTILLA siempre primero,
 * luego SEMANAs por fechaInicio asc.
 */
export const sortPlsForUi = (pls) => {
    return [...(pls || [])].sort((a, b) => {
        const ap = isPlantilla(a) ? 0 : 1;
        const bp = isPlantilla(b) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (isPlantilla(a)) return 0;
        const ai = String(a.fechaInicio || '');
        const bi = String(b.fechaInicio || '');
        return ai.localeCompare(bi);
    });
};

/**
 * El PL "activo" en una fecha dada. Política igual que el resolver backend:
 *   1. La SEMANA cuyo rango contiene la fecha (si la hay).
 *   2. La PLANTILLA del grupo (caso default).
 *   3. null si la lista está vacía o no tiene PLANTILLA.
 */
export const selectActivePl = (pls, fecha = null) => {
    const items = pls || [];
    if (items.length === 0) return null;
    const today = (fecha || new Date()).toISOString().slice(0, 10);

    const semanaActiva = items.find(p =>
        isSemana(p)
        && String(p.fechaInicio).slice(0, 10) <= today
        && String(p.fechaFin).slice(0, 10) >= today
    );
    if (semanaActiva) return semanaActiva;

    return items.find(isPlantilla) || items[0];
};

/**
 * La PLANTILLA del grupo de la lista, o null si no la hay (estado raro:
 * grupo sin plantilla; el backend la auto-crea, pero por defensa).
 */
export const findPlantilla = (pls) => (pls || []).find(isPlantilla) || null;

/**
 * Etiqueta legible para mostrar en el strip de pills.
 *   - Plantilla: nombre del PL ("Plantilla del curso") con un prefijo si
 *     se quiere distinguir.
 *   - Semana: "DD MMM – DD MMM" o el `nombre` si está set.
 */
export const labelForPl = (pl, opts = {}) => {
    if (!pl) return '';
    if (isPlantilla(pl)) {
        return opts.plantillaLabel || pl.nombre || 'Plantilla';
    }
    if (pl.nombre) return pl.nombre;
    if (pl.fechaInicio && pl.fechaFin) {
        const fmt = (iso) => String(iso).slice(0, 10);
        return `${fmt(pl.fechaInicio)} – ${fmt(pl.fechaFin)}`;
    }
    return `Semana #${pl.semanaNumero ?? '?'}`;
};
