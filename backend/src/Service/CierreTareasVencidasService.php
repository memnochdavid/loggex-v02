<?php

namespace App\Service;

use App\Entity\Calificacion;
use App\Entity\Entrega;
use App\Entity\Imparticion;
use App\Entity\Tarea;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Cierra tareas con plazo vencido sin entrega creando una Entrega sintética
 * (`comentarioAlumno = '(no entregado)'`, archivo/enlace nulls) y una
 * Calificacion automática con `nota=0`.
 *
 * El servicio NO toca el modelo: replica exactamente lo que haría el profesor
 * a mano (entrega + calificación 0). El frontend lo dispara desde un botón en
 * `/calificaciones` (botón manual). Pensado para reusarse desde un cron / Symfony
 * Scheduler en una sesión futura sin cambios.
 *
 * Es **idempotente**: si ya existe entrega para (alumno, tarea), no la duplica;
 * si la entrega existe sin calificación, tampoco la "completa" automáticamente
 * (la lógica solo crea calificación cuando crea la entrega sintética; las
 * entregas reales sin calificar son responsabilidad del profe).
 */
final class CierreTareasVencidasService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array{tareasProcesadas:int, tareasOmitidas:int, alumnosCerrados:int, dryRun:bool}
     */
    public function procesar(?Imparticion $imparticion = null, bool $dryRun = false): array
    {
        $ahora = new \DateTime();

        $qb = $this->em->createQueryBuilder()
            ->select('t')
            ->from(Tarea::class, 't')
            ->where('t.deleted = false')
            ->andWhere('t.fechaLimite < :ahora')
            ->setParameter('ahora', $ahora);
        if ($imparticion !== null) {
            $qb->andWhere('t.imparticion = :imp')->setParameter('imp', $imparticion);
        }
        /** @var Tarea[] $tareas */
        $tareas = $qb->getQuery()->getResult();

        $tareasProcesadas = 0;
        $tareasOmitidas = 0;
        $alumnosCerrados = 0;

        foreach ($tareas as $tarea) {
            $imp = $tarea->getImparticion();
            $grupo = $imp?->getGrupo();
            if (!$grupo) {
                $tareasOmitidas++;
                continue;
            }
            $alumnos = $this->alumnosDelGrupo($grupo->getId());
            if (count($alumnos) === 0) {
                $tareasOmitidas++;
                continue;
            }
            $alumnosConEntrega = $this->alumnosConEntrega($tarea->getId());
            $tareasProcesadas++;
            foreach ($alumnos as $alumno) {
                if (in_array($alumno->getId(), $alumnosConEntrega, true)) {
                    continue;
                }
                $alumnosCerrados++;
                if ($dryRun) {
                    continue;
                }
                $entrega = (new Entrega())
                    ->setTarea($tarea)
                    ->setAlumno($alumno)
                    ->setFechaEntrega($ahora)
                    ->setEnlace(null)
                    ->setArchivo(null)
                    ->setComentarioAlumno('(no entregado)');
                $this->em->persist($entrega);

                $calif = (new Calificacion())
                    ->setEntrega($entrega)
                    ->setNota(0.0)
                    ->setFeedbackProfesor('Cierre automático: tarea no entregada en plazo.');
                $this->em->persist($calif);
            }
        }

        if (!$dryRun && $alumnosCerrados > 0) {
            $this->em->flush();
        }

        return [
            'tareasProcesadas' => $tareasProcesadas,
            'tareasOmitidas' => $tareasOmitidas,
            'alumnosCerrados' => $alumnosCerrados,
            'dryRun' => $dryRun,
        ];
    }

    /** @return User[] */
    private function alumnosDelGrupo(int $grupoId): array
    {
        $rows = $this->em->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->join('App\Entity\Matricula', 'm', 'WITH', 'm.alumno = u')
            ->where('m.grupo = :gid')
            ->andWhere('m.deleted = false')
            ->andWhere('u.deleted = false')
            ->setParameter('gid', $grupoId)
            ->getQuery()
            ->getResult();
        // Dedup por id (un alumno podría tener >1 matrícula histórica al mismo grupo).
        $byId = [];
        foreach ($rows as $u) {
            $byId[$u->getId()] = $u;
        }
        return array_values($byId);
    }

    /** @return int[] ids de alumno con entrega no borrada para la tarea */
    private function alumnosConEntrega(int $tareaId): array
    {
        $rows = $this->em->createQueryBuilder()
            ->select('IDENTITY(e.alumno) AS aid')
            ->from(Entrega::class, 'e')
            ->where('e.tarea = :tid')
            ->andWhere('e.deleted = false')
            ->setParameter('tid', $tareaId)
            ->getQuery()
            ->getArrayResult();
        return array_map(static fn ($r) => (int) $r['aid'], $rows);
    }
}
