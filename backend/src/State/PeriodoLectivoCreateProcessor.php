<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Entity\TipoPeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Tras crear un `PeriodoLectivo` (POST), genera automáticamente un
 * `PeriodoLectivoImparticion` por cada `Imparticion` viva del grupo, con
 * `minutosSemanales = NULL` (= hereda `Materia.minutosSemanales`).
 *
 * Sin esto, un PL recién creado estaría vacío y el editor no tendría
 * imparticiones que mostrar. La Fase 3b añadirá UI para que el admin
 * desactive imparticiones por rango (caso típico: una materia anual no
 * activa en el rango FCT) o ajuste sus minutos.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 3a)
 */
class PeriodoLectivoCreateProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $persistProcessor,
        private EntityManagerInterface $em,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $isNew = !($data instanceof PeriodoLectivo) || $data->getId() === null;

        // Heurística post-refactor semanal (2026-05-06): si el cliente no
        // especifica `tipo`, inferimos desde los campos del payload.
        //   - sin fechaInicio → PLANTILLA (caso default).
        //   - con fechaInicio → SEMANA (caso override puntual).
        // El resto de coherencia (plantillaBase, semanaNumero) la valida
        // `PeriodoLectivo::validarCoherenciaTipo` antes del persist.
        if ($isNew && $data instanceof PeriodoLectivo && $data->getTipo() === null) {
            $data->setTipo(
                $data->getFechaInicio() === null
                    ? TipoPeriodoLectivo::PLANTILLA
                    : TipoPeriodoLectivo::SEMANA
            );
        }

        // Higiene jornadaTipo: la PLANTILLA NO debe tener jornadaTipo propia.
        // El default del grupo es `Grupo.jornadaTipoOverride`; la PLANTILLA
        // hereda esa cadena (PL.jornadaTipo > Grupo.override > Itinerario).
        // Si el cliente la asigna explícitamente, el dropdown del editor
        // muestra la jornada del grupo (override) pero la rejilla la del PL,
        // produciendo inconsistencia visible (bug detectado 2026-05-06 sesión
        // 4 con grupo 3 1º DAM EAG: dropdown FP Tardes / rejilla 8:30-14:30).
        // Forzamos NULL para que el override del grupo sea siempre la fuente.
        if ($isNew && $data instanceof PeriodoLectivo && $data->isPlantilla()) {
            $data->setJornadaTipo(null);
        }

        // Persistir primero (decora el persistProcessor por defecto).
        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        // Auto-crear PLIs solo para PLANTILLAs (las cuotas default del grupo).
        // Las SEMANAs lazy on-demand: el admin solo crea PLIs en una SEMANA
        // cuando quiere overridear la cuota de una imparticion para esa
        // semana concreta. Si una SEMANA no tiene PLI(imparticion), el
        // `HorarioRenderService` cae a la PLI de la PLANTILLA.
        if ($isNew
            && $result instanceof PeriodoLectivo
            && $result->getGrupo() !== null
            && $result->isPlantilla()
        ) {
            $grupoId = $result->getGrupo()->getId();
            $imps = $this->em->getRepository(Imparticion::class)
                ->createQueryBuilder('i')
                ->andWhere('i.grupo = :g')
                ->andWhere('i.deleted = false')
                ->setParameter('g', $grupoId)
                ->getQuery()
                ->getResult();

            foreach ($imps as $imp) {
                $pli = new PeriodoLectivoImparticion();
                $pli->setPeriodoLectivo($result);
                $pli->setImparticion($imp);
                // minutosSemanales queda NULL → hereda Materia.minutosSemanales.
                $this->em->persist($pli);
            }
            $this->em->flush();
        }

        return $result;
    }
}
