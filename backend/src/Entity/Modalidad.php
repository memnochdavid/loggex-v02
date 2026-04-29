<?php

namespace App\Entity;

/**
 * Modalidad de imparticion de una materia: separa placement físico (slot en
 * aula con un profesor) de carga curricular (horas que cuentan al RD del
 * título).
 *
 * Default `PRESENCIAL` para preservar comportamiento histórico (D-B): todas
 * las materias e imparticiones pre-2026-04 se backfilean como presenciales.
 * Solo se reetiqueta lo que demostradamente NO es clase semanal en aula.
 *
 * Se usa como `enumType` en:
 *   - `Materia.modalidad`     (default por catálogo, NOT NULL)
 *   - `Imparticion.modalidad` (override grupo-level opcional, NULL = hereda)
 *
 * Cubre todo FP LOMLOE (Básica/Medio/Superior/Especialización) + ESO/Bach.
 * Universidad (sub-modalidades teoría/lab/autoaprendizaje) queda fuera del
 * alcance Fase 1-6 (D-F).
 *
 * Doc: docs/hoja-de-ruta-modalidad-imparticion.md
 */
enum Modalidad: string
{
    /** Clase regular en aula. Consume slots de jornada lectiva. */
    case PRESENCIAL = 'presencial';

    /** Formación en Centros de Trabajo (dual obligatoria RD 659/2023). En empresa, no consume aula. Cuenta al currículo total. */
    case FCT = 'fct';

    /** Proyecto intermodular, horas de libre configuración, refuerzos sin horario fijo. Tutorización puntual posible pero NO clase semanal recurrente. Cuenta al currículo. */
    case NO_REGULAR = 'no_regular';

    /** Trabajo autónomo del alumno fuera del aula (LOMLOE permite hasta cierto % no presencial). No consume aula. Cuenta al currículo. */
    case AUTONOMA = 'autonoma';

    public function label(): string
    {
        return match ($this) {
            self::PRESENCIAL => 'Presencial',
            self::FCT        => 'FCT (en empresa)',
            self::NO_REGULAR => 'No regular',
            self::AUTONOMA   => 'Autónoma',
        };
    }

    /**
     * ¿Esta modalidad consume slots de la jornada lectiva (placement físico)?
     * Único punto de verdad para que solver, rejilla, CapacityPlanner y PDF
     * decidan si una imparticion debe ir a la grilla o al anexo informativo.
     */
    public function consumeAula(): bool
    {
        return $this === self::PRESENCIAL;
    }
}
