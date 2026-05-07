<?php

namespace App\Entity;

/**
 * Tipo de excepción puntual sobre un Horario base.
 *
 * Cada `ExcepcionHorario` lleva exactamente uno de estos valores. Determina
 * cómo se compone la fecha concreta sobre el placement recurrente:
 *
 * - `INTERCAMBIO`: permuta bilateral acordada entre dos profes. La excepción
 *   se referencia con su pareja vía `intercambioPareja` (FK self-ref).
 *   `imparticionEfectiva` = la imparticion del otro profe.
 * - `SUSTITUCION`: un profe cubre la clase de otro (ausencia, enfermedad).
 *   Misma imparticion; `profeOverride` apunta al sustituto.
 * - `CANCELADO`: la clase no se imparte ese día. `imparticionEfectiva` y
 *   `profeOverride` deben ser NULL. Resta de cobertura curricular.
 * - `EVENTO_ESPECIAL`: charla, taller, simulacro, salida. La franja se ocupa
 *   con algo no curricular. `imparticionEfectiva` NULL; `motivo` describe.
 *
 * `SEMANA_ATIPICA` queda diferida a Fase F (D-B 2026-05-07).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md §3 D-B + §4.
 */
enum TipoExcepcion: string
{
    case INTERCAMBIO     = 'intercambio';
    case SUSTITUCION     = 'sustitucion';
    case CANCELADO       = 'cancelado';
    case EVENTO_ESPECIAL = 'evento_especial';

    public function label(): string
    {
        return match ($this) {
            self::INTERCAMBIO     => 'Intercambio entre profesores',
            self::SUSTITUCION     => 'Sustitución por ausencia',
            self::CANCELADO       => 'Clase cancelada',
            self::EVENTO_ESPECIAL => 'Evento especial',
        };
    }

    /**
     * ¿Este tipo de excepción afecta a la cobertura curricular anual?
     * - CANCELADO sí (resta horas).
     * - EVENTO_ESPECIAL sí (no es clase regular).
     * - INTERCAMBIO/SUSTITUCION no (la clase se imparte igual, sólo cambia el profe).
     */
    public function afectaCobertura(): bool
    {
        return match ($this) {
            self::INTERCAMBIO, self::SUSTITUCION => false,
            self::CANCELADO, self::EVENTO_ESPECIAL => true,
        };
    }
}
