<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Entity\TipoPeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Composición PLANTILLA + SEMANA en el modelo semanal.
 *
 * Punto único de consulta para el render de horarios y PLIs en una fecha
 * concreta. Cuando la SEMANA correspondiente tiene Horarios o PLIs
 * propios, esos overridean los de la PLANTILLA. En caso default, todo
 * delega en la PLANTILLA.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 */
class HorarioRenderService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PeriodoLectivoResolver $plResolver,
    ) {
    }

    /**
     * Horarios efectivos del grupo en la fecha dada.
     *
     * - Si existe SEMANA con Horarios propios → se devuelven los de la SEMANA.
     * - Si la SEMANA no tiene Horarios → se devuelven los de la PLANTILLA.
     * - Si no hay PLANTILLA → array vacío.
     *
     * @return Horario[]
     */
    public function getHorariosFor(Grupo $grupo, \DateTimeInterface $fecha): array
    {
        $semana = $this->getSemanaActiva($grupo, $fecha);

        if ($semana !== null) {
            $semanaHorarios = $this->fetchHorariosByPl($semana);
            if (count($semanaHorarios) > 0) {
                return $semanaHorarios;
            }
        }

        $plantilla = $this->plResolver->getPlantilla($grupo);
        if ($plantilla === null) {
            return [];
        }
        return $this->fetchHorariosByPl($plantilla);
    }

    /**
     * PLI efectiva para `(grupo, fecha, imparticion)` con cascada
     * SEMANA → PLANTILLA → null.
     *
     * El llamador puede usar `pli?->getEffectiveMinutosSemanales()` para el
     * último fallback a `Materia.minutosSemanales`.
     */
    public function resolvePliFor(Grupo $grupo, \DateTimeInterface $fecha, Imparticion $imparticion): ?PeriodoLectivoImparticion
    {
        $semana = $this->getSemanaActiva($grupo, $fecha);

        if ($semana !== null) {
            $pliSemana = $this->fetchPliByPlAndImparticion($semana, $imparticion);
            if ($pliSemana !== null) {
                return $pliSemana;
            }
        }

        $plantilla = $this->plResolver->getPlantilla($grupo);
        if ($plantilla === null) {
            return null;
        }
        return $this->fetchPliByPlAndImparticion($plantilla, $imparticion);
    }

    /**
     * SEMANA viva cuyo rango contiene la fecha, o NULL si la fecha cae
     * en la "zona default" (sin override).
     */
    private function getSemanaActiva(Grupo $grupo, \DateTimeInterface $fecha): ?PeriodoLectivo
    {
        return $this->em->getRepository(PeriodoLectivo::class)
            ->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoSemana')
            ->andWhere(':fecha BETWEEN pl.fechaInicio AND pl.fechaFin')
            ->setParameter('grupo', $grupo)
            ->setParameter('tipoSemana', TipoPeriodoLectivo::SEMANA->value)
            ->setParameter('fecha', $fecha->format('Y-m-d'))
            ->orderBy('pl.fechaInicio', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return Horario[] */
    private function fetchHorariosByPl(PeriodoLectivo $pl): array
    {
        return $this->em->getRepository(Horario::class)
            ->createQueryBuilder('h')
            ->andWhere('h.periodoLectivo = :pl')
            ->andWhere('h.deleted = false')
            ->setParameter('pl', $pl)
            ->orderBy('h.diaSemana', 'ASC')
            ->addOrderBy('h.horaInicio', 'ASC')
            ->getQuery()
            ->getResult();
    }

    private function fetchPliByPlAndImparticion(PeriodoLectivo $pl, Imparticion $imparticion): ?PeriodoLectivoImparticion
    {
        return $this->em->getRepository(PeriodoLectivoImparticion::class)
            ->createQueryBuilder('pli')
            ->andWhere('pli.periodoLectivo = :pl')
            ->andWhere('pli.imparticion = :imp')
            ->andWhere('pli.deleted = false')
            ->setParameter('pl', $pl)
            ->setParameter('imp', $imparticion)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
