/**
 * Devuelve una forma corta del módulo pensada para contextos con poco espacio
 * horizontal (celdas de TimeTable, cabeceras de AccordionView en móvil,
 * chips de módulo, etc.). Cae a `nombre` si no hay `abreviatura`.
 */
export const getModuloShort = (modulo) => {
    if (!modulo) return '';
    return modulo.abreviatura || modulo.nombre || '';
};

/**
 * Nombre completo con abreviatura entre paréntesis si existe.
 * Útil para tooltips o contextos donde sí hay espacio pero queremos
 * visibilidad de ambas formas.
 */
export const getModuloFullLabel = (modulo) => {
    if (!modulo) return '';
    const nombre = modulo.nombre || '';
    return modulo.abreviatura ? `${nombre} (${modulo.abreviatura})` : nombre;
};
