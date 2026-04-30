/**
 * Helpers de formato de etiqueta para Grupo. Regla del proyecto:
 * cuando se lista un grupo en cualquier UI (ThemedSelect, DataTable, chips,
 * sub-headers de listas, etc.), el curso debe aparecer delante.
 *
 *   formatGrupoNombre({curso:1, nombre:'DAW', abreviatura:'DAW1'}) → '1º DAW'
 *   formatGrupoAbrev({curso:1, nombre:'DAW', abreviatura:'DAW1'})  → '1º DAW1'
 *
 * Si el grupo viene sin `curso` (caso edge: legacy, sin LOMLOE), se omite
 * el prefijo limpiamente. Si falta el campo de display (nombre/abreviatura),
 * cae al otro como fallback.
 */
export function formatGrupoNombre(grupo) {
    if (!grupo) return '';
    const display = grupo.nombre || grupo.abreviatura || '';
    return grupo.curso != null ? `${grupo.curso}º ${display}`.trim() : display.trim();
}

export function formatGrupoAbrev(grupo) {
    if (!grupo) return '';
    const display = grupo.abreviatura || grupo.nombre || '';
    return grupo.curso != null ? `${grupo.curso}º ${display}`.trim() : display.trim();
}
