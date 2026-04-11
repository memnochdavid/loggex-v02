<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\PeriodoEvaluativo;
use App\Entity\User;
use App\Repository\PonderacionImparticionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
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
     * Soporta ?periodo={id} para filtrar por periodo evaluativo.
     */
    #[Route('/api/v1/imparticion/{imparticionId}/media/{alumnoId}', name: 'api_media_alumno', methods: ['GET'])]
    public function mediaAlumno(int $imparticionId, int $alumnoId, Request $request): JsonResponse
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

        $periodo = $this->resolverPeriodo($request);
        $pesos = $this->ponderacionRepo->getPesosParaImparticion($imparticionId);
        $resultado = $this->calcularMediaAlumno($imparticionId, $alumnoId, $pesos, $periodo);

        $response = [
            'alumno' => [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
            ],
            'pesos' => $pesos,
            ...$resultado,
        ];

        if ($periodo) {
            $response['periodo'] = $this->serializarPeriodo($periodo);
        }

        return $this->json($response);
    }

    /**
     * Medias de todos los alumnos del grupo de una impartición.
     * Soporta ?periodo={id} para filtrar por periodo evaluativo.
     */
    #[Route('/api/v1/imparticion/{imparticionId}/medias', name: 'api_medias_grupo', methods: ['GET'])]
    public function mediasGrupo(int $imparticionId, Request $request): JsonResponse
    {
        $imparticion = $this->em->getRepository(Imparticion::class)->find($imparticionId);
        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        $this->verificarAcceso($imparticion);

        $periodo = $this->resolverPeriodo($request);
        $pesos = $this->ponderacionRepo->getPesosParaImparticion($imparticionId);

        $matriculas = $this->em->getRepository(Matricula::class)->findBy([
            'grupo' => $imparticion->getGrupo()
        ]);

        $resultados = [];
        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();
            $media = $this->calcularMediaAlumno($imparticionId, $alumno->getId(), $pesos, $periodo);
            $resultados[] = [
                'alumno' => [
                    'id' => $alumno->getId(),
                    'nombre' => $alumno->getNombre(),
                    'apellidos' => $alumno->getApellidos(),
                ],
                ...$media,
            ];
        }

        usort($resultados, fn($a, $b) => ($b['notaFinal'] ?? 0) <=> ($a['notaFinal'] ?? 0));

        $response = [
            'imparticion' => [
                'id' => $imparticion->getId(),
                'modulo' => $imparticion->getModulo()->getNombre(),
                'grupo' => $imparticion->getGrupo()->getNombre(),
                'profesor' => $imparticion->getProfesor()->getNombre() . ' ' . $imparticion->getProfesor()->getApellidos(),
            ],
            'pesos' => $pesos,
            'alumnos' => $resultados,
        ];

        if ($periodo) {
            $response['periodo'] = $this->serializarPeriodo($periodo);
        }

        return $this->json($response);
    }

    /**
     * Nota final del curso: media ponderada de todos los periodos ordinarios.
     */
    #[Route('/api/v1/imparticion/{imparticionId}/nota-final/{alumnoId}', name: 'api_nota_final', methods: ['GET'])]
    public function notaFinal(int $imparticionId, int $alumnoId): JsonResponse
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

        // Obtener todos los periodos del grupo
        $periodos = $this->em->getRepository(PeriodoEvaluativo::class)->findBy(
            ['grupo' => $imparticion->getGrupo()],
            ['fechaInicio' => 'ASC']
        );

        if (empty($periodos)) {
            // Sin periodos: calcular media global
            $mediaGlobal = $this->calcularMediaAlumno($imparticionId, $alumnoId, $pesos);
            return $this->json([
                'alumno' => [
                    'id' => $alumno->getId(),
                    'nombre' => $alumno->getNombre(),
                    'apellidos' => $alumno->getApellidos(),
                ],
                'periodos' => [],
                'notaFinal' => $mediaGlobal['notaFinal'],
                'metodo' => 'global',
            ]);
        }

        // Calcular nota por periodo
        $notasPorPeriodo = [];
        $pesoTotalPeriodos = 0;
        $sumaPonderadaPeriodos = 0;

        foreach ($periodos as $periodo) {
            $media = $this->calcularMediaAlumno($imparticionId, $alumnoId, $pesos, $periodo);
            $periodoData = [
                ...$this->serializarPeriodo($periodo),
                ...$media,
            ];
            $notasPorPeriodo[] = $periodoData;

            // Solo los periodos ordinarios (no extraordinaria) entran en la media final
            if ($periodo->getTipo() !== 'EXTRAORDINARIA' && $media['notaFinal'] !== null) {
                $pesoPeriodo = $periodo->getPeso() ?? (1 / count(array_filter(
                    $periodos,
                    fn($p) => $p->getTipo() !== 'EXTRAORDINARIA'
                )));
                $sumaPonderadaPeriodos += $media['notaFinal'] * $pesoPeriodo;
                $pesoTotalPeriodos += $pesoPeriodo;
            }
        }

        $notaFinalCurso = $pesoTotalPeriodos > 0
            ? round($sumaPonderadaPeriodos / $pesoTotalPeriodos, 2)
            : null;

        return $this->json([
            'alumno' => [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
            ],
            'periodos' => $notasPorPeriodo,
            'notaFinal' => $notaFinalCurso,
            'metodo' => 'media_ponderada_periodos',
        ]);
    }

    /**
     * Calcula las medias por tipo y la nota final ponderada de un alumno.
     * Si se indica periodo, solo considera tareas cuya fechaLimite caiga en el rango.
     */
    private function calcularMediaAlumno(
        int $imparticionId,
        int $alumnoId,
        array $pesos,
        ?PeriodoEvaluativo $periodo = null
    ): array {
        $qb = $this->em->createQueryBuilder();
        $qb->select('t.tipo', 'c.nota')
            ->from('App\Entity\Tarea', 't')
            ->leftJoin('App\Entity\Entrega', 'e', 'WITH', 'e.tarea = t AND e.alumno = :alumnoId AND e.deleted = false')
            ->leftJoin('App\Entity\Calificacion', 'c', 'WITH', 'c.entrega = e AND c.deleted = false')
            ->where('t.imparticion = :imparticionId')
            ->andWhere('t.deleted = false')
            ->setParameter('imparticionId', $imparticionId)
            ->setParameter('alumnoId', $alumnoId);

        if ($periodo) {
            $qb->andWhere('t.fechaLimite >= :periodoInicio')
                ->andWhere('t.fechaLimite <= :periodoFin')
                ->setParameter('periodoInicio', $periodo->getFechaInicio())
                ->setParameter('periodoFin', $periodo->getFechaFin());
        }

        $rows = $qb->getQuery()->getResult();

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

        $mediaPorTipo = [];
        foreach ($notasPorTipo as $tipo => $notas) {
            $mediaPorTipo[$tipo] = count($notas) > 0 ? round(array_sum($notas) / count($notas), 2) : null;
        }

        $notaFinal = null;
        $pesoTotal = 0;
        $sumaPonderada = 0;

        foreach ($pesos as $tipo => $peso) {
            if (isset($mediaPorTipo[$tipo]) && $mediaPorTipo[$tipo] !== null) {
                $sumaPonderada += $mediaPorTipo[$tipo] * $peso;
                $pesoTotal += $peso;
            }
        }

        if ($pesoTotal > 0) {
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

    private function resolverPeriodo(Request $request): ?PeriodoEvaluativo
    {
        $periodoId = $request->query->get('periodo');
        if (!$periodoId) {
            return null;
        }

        return $this->em->getRepository(PeriodoEvaluativo::class)->find($periodoId);
    }

    private function serializarPeriodo(PeriodoEvaluativo $periodo): array
    {
        return [
            'id' => $periodo->getId(),
            'nombre' => $periodo->getNombre(),
            'tipo' => $periodo->getTipo(),
            'fechaInicio' => $periodo->getFechaInicio()->format('Y-m-d'),
            'fechaFin' => $periodo->getFechaFin()->format('Y-m-d'),
            'peso' => $periodo->getPeso(),
        ];
    }

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
