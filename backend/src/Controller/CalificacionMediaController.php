<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\User;
use App\Repository\PonderacionImparticionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class CalificacionMediaController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PonderacionImparticionRepository $ponderacionRepo
    ) {
    }

    /**
     * Media ponderada de un alumno en una impartición.
     */
    #[Route('/api/v1/imparticion/{imparticionId}/media/{alumnoId}', name: 'api_media_alumno', methods: ['GET'])]
    public function mediaAlumno(int $imparticionId, int $alumnoId): JsonResponse
    {
        $imparticion = $this->em->getRepository(Imparticion::class)->find($imparticionId);
        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        $alumno = $this->em->getRepository(User::class)->find($alumnoId);
        if (!$alumno) {
            return $this->json(['message' => 'Alumno no encontrado'], 404);
        }

        $this->verificarAcceso($imparticion);

        $pesos = $this->ponderacionRepo->getPesosParaImparticion($imparticionId);
        $resultado = $this->calcularMediaAlumno($imparticionId, $alumnoId, $pesos);

        return $this->json([
            'alumno' => [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
            ],
            'pesos' => $pesos,
            ...$resultado,
        ]);
    }

    /**
     * Medias de todos los alumnos del grupo de una impartición.
     */
    #[Route('/api/v1/imparticion/{imparticionId}/medias', name: 'api_medias_grupo', methods: ['GET'])]
    public function mediasGrupo(int $imparticionId): JsonResponse
    {
        $imparticion = $this->em->getRepository(Imparticion::class)->find($imparticionId);
        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        $this->verificarAcceso($imparticion);

        $pesos = $this->ponderacionRepo->getPesosParaImparticion($imparticionId);

        // Obtener alumnos matriculados en el grupo
        $matriculas = $this->em->getRepository(Matricula::class)->findBy([
            'grupo' => $imparticion->getGrupo()
        ]);

        $resultados = [];
        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();
            $media = $this->calcularMediaAlumno($imparticionId, $alumno->getId(), $pesos);
            $resultados[] = [
                'alumno' => [
                    'id' => $alumno->getId(),
                    'nombre' => $alumno->getNombre(),
                    'apellidos' => $alumno->getApellidos(),
                ],
                ...$media,
            ];
        }

        // Ordenar por nota final descendente
        usort($resultados, fn($a, $b) => ($b['notaFinal'] ?? 0) <=> ($a['notaFinal'] ?? 0));

        return $this->json([
            'imparticion' => [
                'id' => $imparticion->getId(),
                'modulo' => $imparticion->getModulo()->getNombre(),
                'grupo' => $imparticion->getGrupo()->getNombre(),
                'profesor' => $imparticion->getProfesor()->getNombre() . ' ' . $imparticion->getProfesor()->getApellidos(),
            ],
            'pesos' => $pesos,
            'alumnos' => $resultados,
        ]);
    }

    /**
     * Calcula las medias por tipo y la nota final ponderada de un alumno.
     *
     * @param array<string, float> $pesos
     * @return array{mediaExamenes: float|null, mediaTareas: float|null, mediaPracticas: float|null, notaFinal: float|null, entregasPendientes: int, totalTareas: int}
     */
    private function calcularMediaAlumno(int $imparticionId, int $alumnoId, array $pesos): array
    {
        // Query: obtener todas las tareas de la impartición con sus entregas y calificaciones del alumno
        $qb = $this->em->createQueryBuilder();
        $qb->select('t.tipo', 'c.nota')
            ->from('App\Entity\Tarea', 't')
            ->leftJoin('App\Entity\Entrega', 'e', 'WITH', 'e.tarea = t AND e.alumno = :alumnoId AND e.deleted = false')
            ->leftJoin('App\Entity\Calificacion', 'c', 'WITH', 'c.entrega = e AND c.deleted = false')
            ->where('t.imparticion = :imparticionId')
            ->andWhere('t.deleted = false')
            ->setParameter('imparticionId', $imparticionId)
            ->setParameter('alumnoId', $alumnoId);

        $rows = $qb->getQuery()->getResult();

        // Agrupar notas por tipo
        $notasPorTipo = ['examen' => [], 'tarea' => [], 'practica' => []];
        $totalTareas = 0;
        $entregasPendientes = 0;

        foreach ($rows as $row) {
            $tipo = $row['tipo'] ?? 'tarea';
            $totalTareas++;

            if ($row['nota'] !== null) {
                $notasPorTipo[$tipo][] = $row['nota'];
            } else {
                $entregasPendientes++;
            }
        }

        // Calcular media por tipo
        $mediaPorTipo = [];
        foreach ($notasPorTipo as $tipo => $notas) {
            $mediaPorTipo[$tipo] = count($notas) > 0 ? round(array_sum($notas) / count($notas), 2) : null;
        }

        // Calcular nota final ponderada (solo con tipos que tienen notas)
        $notaFinal = null;
        $pesoTotal = 0;
        $sumaPonderada = 0;

        foreach ($pesos as $tipo => $peso) {
            if ($mediaPorTipo[$tipo] !== null) {
                $sumaPonderada += $mediaPorTipo[$tipo] * $peso;
                $pesoTotal += $peso;
            }
        }

        if ($pesoTotal > 0) {
            // Normalizar si no todos los tipos tienen notas
            $notaFinal = round($sumaPonderada / $pesoTotal, 2);
        }

        return [
            'mediaExamenes' => $mediaPorTipo['examen'],
            'mediaTareas' => $mediaPorTipo['tarea'],
            'mediaPracticas' => $mediaPorTipo['practica'],
            'notaFinal' => $notaFinal,
            'entregasPendientes' => $entregasPendientes,
            'totalTareas' => $totalTareas,
        ];
    }

    /**
     * Verifica que el usuario actual tiene acceso a la impartición.
     */
    private function verificarAcceso(Imparticion $imparticion): void
    {
        $user = $this->getUser();

        if ($this->isGranted('ROLE_SUPERADMIN') || $this->isGranted('ROLE_SUPER_ADMIN')) {
            return;
        }

        if ($this->isGranted('ROLE_ADMIN')) {
            if ($user instanceof User && $user->getCentro() === $imparticion->getGrupo()->getCentro()) {
                return;
            }
        }

        if ($this->isGranted('ROLE_PROFESOR')) {
            if ($user instanceof User && $imparticion->getProfesor()->getId() === $user->getId()) {
                return;
            }
        }

        throw $this->createAccessDeniedException('No tienes acceso a esta impartición.');
    }
}
