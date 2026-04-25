/**
 * Modelo Entidad-Relación de Loggex.
 *
 * Datos de las 20 entidades Doctrine del backend, con sus campos, tipos,
 * traits compartidos (timestamps + soft delete) y relaciones. Se usa para
 * pintar el diagrama ER interactivo en /about/er.
 *
 * Las posiciones (x,y) están a mano para una distribución legible en 5 columnas
 * por dominio. Anchura fija 320px; altura se calcula dinámicamente desde los
 * campos visibles (con/sin auditoría).
 */

export const ER_DOMAINS = {
    centro:        { label: 'Configuración del centro', color: '#a5b4fc' }, // primary
    academic:      { label: 'Estructura académica',     color: '#6ee7b7' }, // emerald
    people:        { label: 'Personas y matrícula',     color: '#c4b5fd' }, // violet
    teaching:      { label: 'Impartición docente',      color: '#fcd34d' }, // amber
    activity:      { label: 'Actividad y evaluación',   color: '#67e8f9' }, // cyan
    results:       { label: 'Resultados',               color: '#f9a8d4' }, // pink
    communication: { label: 'Comunicación',             color: '#fda4af' }, // rose
};

const AUDIT_FIELDS = [
    { name: 'createdAt', type: 'datetime', audit: true },
    { name: 'updatedAt', type: 'datetime', audit: true },
];

const SOFT_DELETE_FIELDS = [
    { name: 'deleted',   type: 'boolean',  audit: true },
    { name: 'deletedAt', type: 'datetime', audit: true },
];

/**
 * Helper para componer los campos finales de una entidad incluyendo
 * los traits TimestampableTrait y SoftDeletableTrait cuando aplique.
 */
const composeFields = (fields, { timestamps = false, softDelete = false } = {}) => [
    ...fields,
    ...(timestamps ? AUDIT_FIELDS : []),
    ...(softDelete ? SOFT_DELETE_FIELDS : []),
];

export const ER_ENTITIES = [
    /* ============ COL 0 — CENTRO ============ */
    {
        id: 'Centro',
        table: 'centro',
        domain: 'centro',
        position: { x: 40, y: 60 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',        type: 'int',          pk: true },
            { name: 'nombre',    type: 'string(255)' },
            { name: 'cif',       type: 'string(20)' },
            { name: 'activo',    type: 'boolean' },
            { name: 'webConfig', type: 'string(255)',  nullable: true },
            { name: 'logo',      type: 'string(255)',  nullable: true },
            { name: 'direccion', type: 'string(255)' },
            { name: 'telefono',  type: 'string(25)',   nullable: true },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Personalizacion',
        table: 'personalizacion',
        domain: 'centro',
        position: { x: 40, y: 540 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',                  type: 'int',         pk: true },
            { name: 'centro_id',           type: 'int',         fk: 'Centro' },
            { name: 'primaryColor',        type: 'string(7)' },
            { name: 'secondaryColor',      type: 'string(7)' },
            { name: 'viewBackgroundColor', type: 'string(7)' },
            { name: 'borderRadius',        type: 'string(20)' },
            { name: 'sidebarColor',        type: 'string(7)' },
            { name: 'animatedBackground',  type: 'string(50)',  nullable: true },
            { name: 'showLottie',          type: 'boolean' },
            { name: 'nameTitleConfig',     type: 'json',        nullable: true },
            { name: '… +85 columnas',      type: 'misc',        meta: true },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'TemaVisual',
        table: 'tema',
        domain: 'centro',
        position: { x: 40, y: 1080 },
        timestamps: true,
        softDelete: false,
        fields: composeFields([
            { name: 'id',            type: 'int',         pk: true },
            { name: 'centro_id',     type: 'int',         fk: 'Centro', nullable: true },
            { name: 'nombre',        type: 'string(255)' },
            { name: 'configuracion', type: 'json' },
            { name: 'esPredefinido', type: 'boolean' },
        ], { timestamps: true }),
    },
    {
        id: 'Festivo',
        table: 'festivo',
        domain: 'centro',
        position: { x: 40, y: 1380 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',           type: 'int',         pk: true },
            { name: 'centro_id',    type: 'int',         fk: 'Centro', nullable: true },
            { name: 'nombre',       type: 'string(255)' },
            { name: 'fechaInicio',  type: 'date' },
            { name: 'fechaFin',     type: 'date',        nullable: true },
        ], { timestamps: true, softDelete: true }),
    },

    /* ============ COL 2 — ACADÉMICA ============ */
    {
        id: 'Itinerario',
        table: 'ciclo_formativo',
        domain: 'academic',
        position: { x: 540, y: 60 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',         type: 'int',         pk: true },
            { name: 'centro_id',  type: 'int',         fk: 'Centro' },
            { name: 'nombre',     type: 'string(255)' },
            { name: 'nivel',      type: 'string(50)' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Materia',
        table: 'modulo',
        domain: 'academic',
        position: { x: 540, y: 420 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',             type: 'int',         pk: true },
            { name: 'ciclo_id',       type: 'int',         fk: 'Itinerario' },
            { name: 'nombre',         type: 'string(255)' },
            { name: 'codigoOficial',  type: 'string(50)',  nullable: true },
            { name: 'abreviatura',    type: 'string(16)',  nullable: true },
            { name: 'curso',          type: 'int' },
            { name: 'horasSemanales', type: 'int' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Grupo',
        table: 'grupo',
        domain: 'academic',
        position: { x: 540, y: 840 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',           type: 'int',         pk: true },
            { name: 'ciclo_id',     type: 'int',         fk: 'Itinerario' },
            { name: 'centro_id',    type: 'int',         fk: 'Centro' },
            { name: 'nombre',       type: 'string(50)' },
            { name: 'abreviatura',  type: 'string(20)',  nullable: true },
            { name: 'curso',        type: 'int' },
            { name: 'anioEscolar',  type: 'string(20)' },
            { name: 'fechaInicio',  type: 'date',        nullable: true },
            { name: 'fechaFin',     type: 'date',        nullable: true },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'PeriodoEvaluativo',
        table: 'periodo_evaluativo',
        domain: 'academic',
        position: { x: 540, y: 1380 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',          type: 'int',         pk: true },
            { name: 'grupo_id',    type: 'int',         fk: 'Grupo' },
            { name: 'nombre',      type: 'string(100)' },
            { name: 'tipo',        type: 'string(30)' },
            { name: 'fechaInicio', type: 'date' },
            { name: 'fechaFin',    type: 'date' },
            { name: 'peso',        type: 'float',       nullable: true },
        ], { timestamps: true, softDelete: true }),
    },

    /* ============ COL 3 — PERSONAS / IMPARTICIÓN ============ */
    {
        id: 'User',
        table: 'usuario',
        domain: 'people',
        position: { x: 1040, y: 60 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',         type: 'int',         pk: true },
            { name: 'centro_id',  type: 'int',         fk: 'Centro', nullable: true },
            { name: 'email',      type: 'string(180)', unique: true },
            { name: 'password',   type: 'string' },
            { name: 'roles',      type: 'json' },
            { name: 'rol_app',    type: 'string(20)' },
            { name: 'nombre',     type: 'string(255)' },
            { name: 'apellidos',  type: 'string(255)' },
            { name: 'telefono',   type: 'string(20)',  nullable: true },
            { name: 'nif',        type: 'string(20)',  nullable: true },
            { name: 'foto',       type: 'string(255)', nullable: true },
            { name: 'firma',      type: 'string(255)', nullable: true },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Matricula',
        table: 'matricula',
        domain: 'people',
        position: { x: 1040, y: 700 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',        type: 'int', pk: true },
            { name: 'alumno_id', type: 'int', fk: 'User' },
            { name: 'grupo_id',  type: 'int', fk: 'Grupo' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Imparticion',
        table: 'imparticion',
        domain: 'teaching',
        position: { x: 1040, y: 980 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',           type: 'int', pk: true },
            { name: 'profesor_id',  type: 'int', fk: 'User' },
            { name: 'materia_id',    type: 'int', fk: 'Materia' },
            { name: 'grupo_id',     type: 'int', fk: 'Grupo' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'PonderacionImparticion',
        table: 'ponderacion_imparticion',
        domain: 'teaching',
        position: { x: 1040, y: 1310 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',             type: 'int',        pk: true },
            { name: 'imparticion_id', type: 'int',        fk: 'Imparticion' },
            { name: 'tipoTarea',      type: 'string(20)' },
            { name: 'peso',           type: 'float' },
        ], { timestamps: true, softDelete: true }),
    },

    /* ============ COL 4 — ACTIVIDAD ============ */
    {
        id: 'Horario',
        table: 'horario',
        domain: 'teaching',
        position: { x: 1540, y: 60 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',             type: 'int',         pk: true },
            { name: 'imparticion_id', type: 'int',         fk: 'Imparticion' },
            { name: 'diaSemana',      type: 'int' },
            { name: 'horaInicio',     type: 'time' },
            { name: 'horaFin',        type: 'time' },
            { name: 'aula',           type: 'string(255)' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Temario',
        table: 'material',
        domain: 'activity',
        position: { x: 1540, y: 460 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',             type: 'int',         pk: true },
            { name: 'imparticion_id', type: 'int',         fk: 'Imparticion' },
            { name: 'titulo',         type: 'string(255)' },
            { name: 'archivo',        type: 'string(255)' },
            { name: 'fechaSubida',    type: 'datetime' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Tarea',
        table: 'tarea',
        domain: 'activity',
        position: { x: 1540, y: 820 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',                 type: 'int',         pk: true },
            { name: 'imparticion_id',     type: 'int',         fk: 'Imparticion' },
            { name: 'tarea_original_id',  type: 'int',         fk: 'Tarea', nullable: true },
            { name: 'titulo',             type: 'string(255)' },
            { name: 'descripcion',        type: 'text',        nullable: true },
            { name: 'archivo',            type: 'string(255)', nullable: true },
            { name: 'fechaInicio',        type: 'datetime',    nullable: true },
            { name: 'fechaLimite',        type: 'datetime' },
            { name: 'tipo',               type: 'string(20)' },
            { name: 'peso',               type: 'float',       nullable: true },
            { name: 'obligatoria',        type: 'boolean' },
            { name: 'notaMinima',         type: 'float',       nullable: true },
            { name: 'visible',            type: 'boolean' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Asistencia',
        table: 'asistencia',
        domain: 'activity',
        position: { x: 1540, y: 1340 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',             type: 'int',         pk: true },
            { name: 'imparticion_id', type: 'int',         fk: 'Imparticion' },
            { name: 'alumno_id',      type: 'int',         fk: 'User' },
            { name: 'fecha',          type: 'date' },
            { name: 'hora',           type: 'time' },
            { name: 'estado',         type: 'string(20)' },
            { name: 'comentario',     type: 'text',        nullable: true },
        ], { timestamps: true, softDelete: true }),
    },

    /* ============ COL 5 — RESULTADOS / COMUNICACIÓN ============ */
    {
        id: 'Mensaje',
        table: 'mensaje',
        domain: 'communication',
        position: { x: 2040, y: 60 },
        timestamps: false,
        softDelete: false,
        fields: composeFields([
            { name: 'id',              type: 'int',      pk: true },
            { name: 'remitente_id',    type: 'int',      fk: 'User' },
            { name: 'destinatario_id', type: 'int',      fk: 'User' },
            { name: 'contenido',       type: 'text' },
            { name: 'texto',           type: 'string',   nullable: true },
            { name: 'fechaEnvio',      type: 'datetime' },
            { name: 'leido',           type: 'boolean' },
        ]),
    },
    {
        id: 'Comunicado',
        table: 'comunicado',
        domain: 'communication',
        position: { x: 2040, y: 440 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',         type: 'int',         pk: true },
            { name: 'autor_id',   type: 'int',         fk: 'User' },
            { name: 'centro_id',  type: 'int',         fk: 'Centro', nullable: true },
            { name: 'titulo',     type: 'string(255)' },
            { name: 'contenido',  type: 'text' },
            { name: 'global',     type: 'boolean' },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Entrega',
        table: 'entrega',
        domain: 'results',
        position: { x: 2040, y: 820 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',                type: 'int',         pk: true },
            { name: 'tarea_id',          type: 'int',         fk: 'Tarea' },
            { name: 'alumno_id',         type: 'int',         fk: 'User' },
            { name: 'fechaEntrega',      type: 'datetime' },
            { name: 'enlace',            type: 'text',        nullable: true },
            { name: 'archivo',           type: 'string(255)', nullable: true },
            { name: 'comentarioAlumno',  type: 'text',        nullable: true },
        ], { timestamps: true, softDelete: true }),
    },
    {
        id: 'Calificacion',
        table: 'calificacion',
        domain: 'results',
        position: { x: 2040, y: 1280 },
        timestamps: true,
        softDelete: true,
        fields: composeFields([
            { name: 'id',                type: 'int',  pk: true },
            { name: 'entrega_id',        type: 'int',  fk: 'Entrega', unique: true },
            { name: 'nota',              type: 'float' },
            { name: 'feedbackProfesor',  type: 'text', nullable: true },
        ], { timestamps: true, softDelete: true }),
    },
];

/**
 * Relaciones entre entidades. `from` es el lado dueño (con FK / inversedBy).
 * Cardinalidad expresada desde el punto de vista de `from` → `to`:
 *   N:1 = muchos `from` por un `to`
 *   1:1 = uno a uno
 * El campo `label` es el nombre PHP de la propiedad (útil para la UI).
 */
export const ER_RELATIONS = [
    // Centro ←
    { from: 'Itinerario',         to: 'Centro',         cardinality: 'N:1', label: 'centro' },
    { from: 'Grupo',                  to: 'Centro',         cardinality: 'N:1', label: 'centro' },
    { from: 'Festivo',                to: 'Centro',         cardinality: 'N:1', label: 'centro', nullable: true },
    { from: 'TemaVisual',                   to: 'Centro',         cardinality: 'N:1', label: 'centro', nullable: true },
    { from: 'User',                   to: 'Centro',         cardinality: 'N:1', label: 'centro', nullable: true },
    { from: 'Comunicado',             to: 'Centro',         cardinality: 'N:1', label: 'centro', nullable: true },
    { from: 'Personalizacion',        to: 'Centro',         cardinality: '1:1', label: 'centro' },

    // Itinerario ←
    { from: 'Materia',                 to: 'Itinerario', cardinality: 'N:1', label: 'itinerario' },
    { from: 'Grupo',                  to: 'Itinerario', cardinality: 'N:1', label: 'itinerario' },

    // Grupo ←
    { from: 'Matricula',              to: 'Grupo',          cardinality: 'N:1', label: 'grupo' },
    { from: 'Imparticion',            to: 'Grupo',          cardinality: 'N:1', label: 'grupo' },
    { from: 'PeriodoEvaluativo',      to: 'Grupo',          cardinality: 'N:1', label: 'grupo' },

    // User ←
    { from: 'Matricula',              to: 'User',           cardinality: 'N:1', label: 'alumno' },
    { from: 'Imparticion',            to: 'User',           cardinality: 'N:1', label: 'profesor' },
    { from: 'Asistencia',             to: 'User',           cardinality: 'N:1', label: 'alumno' },
    { from: 'Entrega',                to: 'User',           cardinality: 'N:1', label: 'alumno' },
    { from: 'Comunicado',             to: 'User',           cardinality: 'N:1', label: 'autor' },
    { from: 'Mensaje',                to: 'User',           cardinality: 'N:1', label: 'remitente' },
    { from: 'Mensaje',                to: 'User',           cardinality: 'N:1', label: 'destinatario' },

    // Materia ←
    { from: 'Imparticion',            to: 'Materia',         cardinality: 'N:1', label: 'materia' },

    // Imparticion ←
    { from: 'Horario',                to: 'Imparticion',    cardinality: 'N:1', label: 'imparticion' },
    { from: 'Temario',               to: 'Imparticion',    cardinality: 'N:1', label: 'imparticion' },
    { from: 'Tarea',                  to: 'Imparticion',    cardinality: 'N:1', label: 'imparticion' },
    { from: 'Asistencia',             to: 'Imparticion',    cardinality: 'N:1', label: 'imparticion' },
    { from: 'PonderacionImparticion', to: 'Imparticion',    cardinality: 'N:1', label: 'imparticion' },

    // Tarea / Entrega
    { from: 'Entrega',                to: 'Tarea',          cardinality: 'N:1', label: 'tarea' },
    { from: 'Calificacion',           to: 'Entrega',        cardinality: '1:1', label: 'entrega' },
    // Auto-referencia: las recuperaciones/subidas de nota son tareas hija que referencian a su original.
    { from: 'Tarea',                  to: 'Tarea',          cardinality: 'N:1', label: 'tarea_original', nullable: true },
];

/**
 * Constantes de layout. Anchura fija de tarjeta para que el cálculo de
 * posiciones sea predecible. La altura se calcula en runtime según los
 * campos visibles (con o sin auditoría).
 */
/**
 * Geometría de columnas y canales (gutters) usada por el router ortogonal
 * de las líneas de relación. Cada columna está separada de la siguiente
 * por un gutter de 160 px → suficiente para alojar varias sub-lanes
 * (canales paralelos) sin solapes.
 */
export const ER_LAYOUT = {
    cardWidth: 340,
    headerHeight: 56,
    fieldHeight: 22,
    footerHeight: 14,
    worldWidth: 2420,
    worldHeight: 1740,

    /* X de la esquina izquierda de cada columna. Debe coincidir con
       las posiciones x de las entidades. */
    columnX: [40, 540, 1040, 1540, 2040],

    /* X del centro de cada gutter (entre col i y col i+1).
       Calculado: cardLeft + cardWidth + gutterWidth/2 = 40+340+80 = 460, etc. */
    gutterCenterX: [460, 960, 1460, 1960],

    /* Anchura del gutter y separación entre sub-lanes dentro de él. */
    gutterWidth: 160,
    laneStep: 11,

    /* Highway horizontal por encima de todas las cajas (las cajas empiezan
       en y=60). highwayTopY es la Y de la lane 0 (la más arriba); lanes
       inferiores van bajando hasta tocar las cajas. */
    highwayTopY: 10,
    highwayLaneStep: 9,
};
