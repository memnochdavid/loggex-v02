<?php

namespace App\Service;

use App\Entity\JornadaTipo;
use App\Entity\JornadaTramo;
use App\Entity\TipoTramo;

/**
 * Valida la coherencia interna de los tramos de una `JornadaTipo`.
 *
 * Reglas:
 *  - Al menos un tramo de tipo SLOT (una jornada sin slots no tiene sentido).
 *  - Cada tramo: horaFin > horaInicio.
 *  - Tramos no se solapan entre sí.
 *  - Cobertura contigua: el horaInicio de cada tramo > 0 debe coincidir con
 *    el horaFin del anterior (no hay huecos sin declarar — si hay un hueco
 *    intencionado, se modela como un tramo RECREO).
 *  - Los `orden` deben ser únicos y consecutivos (0..N-1) cuando se ordenan
 *    por horaInicio ASC.
 *
 * Uso típico:
 *   $errors = $validator->validate($jornada);
 *   if ($errors !== []) { devolver 422 con la lista }
 */
class JornadaTramoValidator
{
    /**
     * @return string[] lista de mensajes de error; vacío si todo OK.
     */
    public function validate(JornadaTipo $jornada): array
    {
        $errors = [];
        $tramos = $jornada->getTramos()->toArray();

        if (count($tramos) === 0) {
            return ['La jornada no tiene tramos.'];
        }

        // 1. Cada tramo individual debe tener horaFin > horaInicio.
        foreach ($tramos as $i => $tramo) {
            $ini = $tramo->getHoraInicio();
            $fin = $tramo->getHoraFin();
            if ($ini === null || $fin === null) {
                $errors[] = sprintf('Tramo #%d: horaInicio y horaFin son obligatorias.', $i);
                continue;
            }
            if ($fin <= $ini) {
                $errors[] = sprintf(
                    'Tramo #%d (%s-%s): horaFin debe ser posterior a horaInicio.',
                    $i,
                    $ini->format('H:i'),
                    $fin->format('H:i'),
                );
            }
        }
        if ($errors !== []) {
            // Si hay tramos malformados, no tiene sentido seguir validando solapes.
            return $errors;
        }

        // 2. Ordenar por horaInicio ASC para validar solapes y cobertura.
        usort($tramos, fn (JornadaTramo $a, JornadaTramo $b): int => $a->getHoraInicio() <=> $b->getHoraInicio(),
        );

        // 3. Solapes y huecos.
        for ($i = 1; $i < count($tramos); $i++) {
            $prev = $tramos[$i - 1];
            $curr = $tramos[$i];

            if ($curr->getHoraInicio() < $prev->getHoraFin()) {
                $errors[] = sprintf(
                    'Tramos %s-%s y %s-%s se solapan.',
                    $prev->getHoraInicio()->format('H:i'),
                    $prev->getHoraFin()->format('H:i'),
                    $curr->getHoraInicio()->format('H:i'),
                    $curr->getHoraFin()->format('H:i'),
                );
            } elseif ($curr->getHoraInicio() > $prev->getHoraFin()) {
                $errors[] = sprintf(
                    'Hueco no declarado entre %s y %s. Si es un descanso intencionado, modélalo como tramo RECREO.',
                    $prev->getHoraFin()->format('H:i'),
                    $curr->getHoraInicio()->format('H:i'),
                );
            }
        }

        // 4. Al menos un SLOT.
        $haySlot = false;
        foreach ($tramos as $tramo) {
            if ($tramo->getTipo() === TipoTramo::SLOT) {
                $haySlot = true;
                break;
            }
        }
        if (!$haySlot) {
            $errors[] = 'La jornada no contiene ningún tramo de tipo SLOT (todos son recreos).';
        }

        // 5. orden únicos. Tras ordenar por hora, también deben ir 0..N-1 si hay
        //    coherencia con la edición — pero permitimos huecos en `orden` siempre
        //    que sean únicos (el normalizador del CRUD reorden los valores al guardar).
        $ordenes = array_map(fn (JornadaTramo $t): int => $t->getOrden(), $tramos);
        if (count(array_unique($ordenes)) !== count($ordenes)) {
            $errors[] = 'Hay tramos con el mismo valor de `orden`. Cada tramo debe tener un orden único.';
        }

        return $errors;
    }
}
