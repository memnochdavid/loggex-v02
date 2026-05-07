<?php

namespace App\Entity;

/**
 * Estado del flujo de aprobación de una `ExcepcionHorario`.
 *
 * - `PENDIENTE_APROBACION`: creada por un profe, esperando que el admin del
 *   centro la apruebe o rechace. Estado por defecto cuando el solicitante
 *   tiene rol PROFESOR puro.
 * - `APROBADA`: aprobada por el admin (o creada directamente por admin sin
 *   pasar por cola). Estado en el que la excepción APLICA en el render
 *   (composición sobre el Horario base).
 * - `RECHAZADA`: el admin la rechazó con `respuestaAdmin`. No se aplica al
 *   render. Queda en histórico.
 * - `CANCELADA`: el solicitante (o un admin) la canceló antes de que se
 *   resolviera (o después de aprobada como reversión). No se aplica.
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md §3 D-C + §4.
 */
enum EstadoExcepcion: string
{
    case PENDIENTE_APROBACION = 'pendiente';
    case APROBADA             = 'aprobada';
    case RECHAZADA            = 'rechazada';
    case CANCELADA            = 'cancelada';

    public function label(): string
    {
        return match ($this) {
            self::PENDIENTE_APROBACION => 'Pendiente de aprobación',
            self::APROBADA             => 'Aprobada',
            self::RECHAZADA            => 'Rechazada',
            self::CANCELADA            => 'Cancelada',
        };
    }

    /**
     * ¿En este estado la excepción aplica al render?
     * Solo APROBADA modifica visualmente los horarios.
     */
    public function aplicaAlRender(): bool
    {
        return $this === self::APROBADA;
    }
}
