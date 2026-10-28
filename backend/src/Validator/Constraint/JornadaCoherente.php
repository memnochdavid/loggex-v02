<?php

namespace App\Validator\Constraint;

use Symfony\Component\Validator\Constraint;

/**
 * Constraint a nivel de clase que verifica la coherencia interna de los tramos
 * de una `JornadaTipo` (sin solapes, cobertura contigua, al menos un SLOT, etc.).
 *
 * La lógica vive en `JornadaTramoValidator` (servicio); esta constraint solo
 * delega para integrarse con el flujo estándar de Symfony Validator y que
 * API Platform devuelva 422 con `violations` cuando el POST/PUT trae datos malos.
 */
#[\Attribute(\Attribute::TARGET_CLASS)]
class JornadaCoherente extends Constraint
{
    public string $message = '{{ error }}';

    public function getTargets(): string
    {
        return self::CLASS_CONSTRAINT;
    }
}
