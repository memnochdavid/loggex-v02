<?php

namespace App\Controller;

use App\Entity\Grupo;
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
     * Etiqueta del grupo en formato "[curso]º [nombre]". Si `curso` es NULL
     * (caso edge de grupos legacy sin LOMLOE), cae al nombre tal cual. Es la
     * misma regla que aplica el frontend con `formatGrupoNombre`.
     */
    private function formatGrupoLabel(Grupo $grupo): string
    {
        $curso = $grupo->getCurso();
        $nombre = $grupo->getNombre() ?? '';
        return $curso !== null ? sprintf('%dº %s', $curso, $nombre) : $nombre;
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
            'imparticion' => [
                'id' => $imparticion->getId(),
                'materia' => $imparticion->getMateria()->getNombre(),
                'grupo' => $this->formatGrupoLabel($imparticion->getGrupo()),
                'profesor' => $imparticion->getProfesor()->getNombre() . ' ' . $imparticion->getProfesor()->getApellidos(),
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
                'materia' => $imparticion->getMateria()->getNombre(),
                'grupo' => $this->formatGrupoLabel($imparticion->getGrupo()),
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
        // Cargamos TODAS las tareas de la impartición (padres e hijas) con la nota del alumno si existe.
        // El filtro de periodo NO se aplica en la query: lo aplicamos después solo a las padres; las hijas
        // se relacionan a su padre y su fecha puede caer fuera del rango del periodo (es un evento posterior).
        $qb = $this->em->createQueryBuilder();
        $qb->select('t.id AS tareaId', 't.titulo', 't.tipo', 't.peso AS tareaPeso', 't.obligatoria', 't.notaMinima', 't.fechaLimite', 'IDENTITY(t.tareaOriginal) AS tareaOriginalId', 'c.nota')
            ->from('App\Entity\Tarea', 't')
            ->leftJoin('App\Entity\Entrega', 'e', 'WITH', 'e.tarea = t AND e.alumno = :alumnoId AND e.deleted = false')
            ->leftJoin('App\Entity\Calificacion', 'c', 'WITH', 'c.entrega = e AND c.deleted = false')
            ->where('t.imparticion = :imparticionId')
            ->andWhere('t.deleted = false')
            ->setParameter('imparticionId', $imparticionId)
            ->setParameter('alumnoId', $alumnoId);

        $rows = $qb->getQuery()->getResult();

        // Separar padres e hijas. Cada fila: normalizar la nota a float|null y fecha a DateTime|null.
        $padres = [];
        $hijasPorPadre = [];
        foreach ($rows as $row) {
            $row['nota'] = $row['nota'] !== null ? (float) $row['nota'] : null;
            if (!empty($row['tareaOriginalId'])) {
                $padreId = (int) $row['tareaOriginalId'];
                $hijasPorPadre[$padreId][] = $row;
            } else {
                $padres[(int) $row['tareaId']] = $row;
            }
        }

        // Aplicar filtro de periodo SOLO a las padres (las hijas se heredan de su padre).
        if ($periodo) {
            $pIni = $periodo->getFechaInicio();
            $pFin = $periodo->getFechaFin();
            $padres = array_filter($padres, function ($p) use ($pIni, $pFin) {
                if (!$p['fechaLimite'] instanceof \DateTimeInterface) return false;
                return $p['fechaLimite'] >= $pIni && $p['fechaLimite'] <= $pFin;
            });
        }

        $notasPorTipo = ['examen' => [], 'tarea' => [], 'practica' => []];
        $totalTareas = 0;
        $entregasPendientes = 0;
        $motivosNoEvaluable = [];
        $ahora = new \DateTime();

        foreach ($padres as $padre) {
            $tipo = $padre['tipo'] ?? 'tarea';
            $totalTareas++;
            $tareaId = (int) $padre['tareaId'];
            $notaPadre = $padre['nota']; // nullable float

            // Buscar la última hija calificada del alumno para esta padre (por fechaLimite descendente).
            $hijas = $hijasPorPadre[$tareaId] ?? [];
            $ultimaHijaCalificada = null;
            foreach ($hijas as $hija) {
                if ($hija['nota'] === null) continue;
                if ($ultimaHijaCalificada === null
                    || ($hija['fechaLimite'] instanceof \DateTimeInterface
                        && $ultimaHijaCalificada['fechaLimite'] instanceof \DateTimeInterface
                        && $hija['fechaLimite'] > $ultimaHijaCalificada['fechaLimite'])) {
                    $ultimaHijaCalificada = $hija;
                }
            }
            // Regla: prevalece la última. Si hay hija calificada, su nota sustituye a la de la padre.
            $notaEfectiva = $ultimaHijaCalificada !== null ? $ultimaHijaCalificada['nota'] : $notaPadre;

            if ($notaEfectiva !== null) {
                $notasPorTipo[$tipo][] = [
                    'nota' => $notaEfectiva,
                    'peso' => $padre['tareaPeso'] !== null ? (float) $padre['tareaPeso'] : 1.0,
                ];
            } else {
                $entregasPendientes++;
            }

            // No evaluable por "obligatoria no entregada": solo si el alumno no tiene NI nota en padre NI
            // nota en hija, la padre es obligatoria, su plazo venció, y no queda ninguna hija abierta
            // que aún pudiera "salvar" al alumno (plazo de la hija todavía por vencer).
            $padrePlazoVencido = $padre['fechaLimite'] instanceof \DateTimeInterface && $padre['fechaLimite'] < $ahora;
            $aunPuedeEntregarEnHija = false;
            foreach ($hijas as $hija) {
                if ($hija['nota'] === null
                    && $hija['fechaLimite'] instanceof \DateTimeInterface
                    && $hija['fechaLimite'] >= $ahora) {
                    $aunPuedeEntregarEnHija = true;
                    break;
                }
            }
            if ($padre['obligatoria'] && $notaEfectiva === null && $padrePlazoVencido && !$aunPuedeEntregarEnHija) {
                $motivosNoEvaluable[] = [
                    'tareaId' => $tareaId,
                    'titulo' => $padre['titulo'],
                    'tipo' => $tipo,
                    'razon' => 'obligatoria_no_entregada',
                ];
            }

            // Nota mínima (de la padre): aplica sobre la nota efectiva.
            if ($padre['notaMinima'] !== null && $notaEfectiva !== null && $notaEfectiva < (float) $padre['notaMinima']) {
                $motivosNoEvaluable[] = [
                    'tareaId' => $tareaId,
                    'titulo' => $padre['titulo'],
                    'tipo' => $tipo,
                    'razon' => 'nota_minima_no_alcanzada',
                    'nota' => $notaEfectiva,
                    'notaMinima' => (float) $padre['notaMinima'],
                ];
            }
        }

        $mediaPorTipo = [];
        foreach ($notasPorTipo as $tipo => $items) {
            if (count($items) === 0) {
                $mediaPorTipo[$tipo] = null;
                continue;
            }
            $sumaPesos = array_sum(array_column($items, 'peso'));
            if ($sumaPesos <= 0) {
                $mediaPorTipo[$tipo] = round(array_sum(array_column($items, 'nota')) / count($items), 2);
                continue;
            }
            $suma = 0;
            foreach ($items as $it) {
                $suma += $it['nota'] * $it['peso'];
            }
            $mediaPorTipo[$tipo] = round($suma / $sumaPesos, 2);
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

        $evaluable = empty($motivosNoEvaluable);
        if (!$evaluable) {
            $notaFinal = null;
        }

        return [
            'mediaExamenes' => $mediaPorTipo['examen'],
            'mediaTareas' => $mediaPorTipo['tarea'],
            'mediaPracticas' => $mediaPorTipo['practica'],
            'notaFinal' => $notaFinal,
            'entregasPendientes' => $entregasPendientes,
            'totalTareas' => $totalTareas,
            'evaluable' => $evaluable,
            'motivosNoEvaluable' => $motivosNoEvaluable,
        ];
    }

    /**
     * Resumen de calificaciones del centro (para admin).
     * Devuelve estadísticas por ciclo → grupo → módulo.
     */
    #[Route('/api/v1/centro/resumen-calificaciones', name: 'api_resumen_calificaciones', methods: ['GET'])]
    public function resumenCalificaciones(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User || (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN'))) {
            throw $this->createAccessDeniedException();
        }

        $centro = $user->getCentro();

        // SuperAdmin puede seleccionar centro via parámetro
        if ($this->isGranted('ROLE_SUPERADMIN') && $request->query->get('centro')) {
            $centro = $this->em->getRepository(\App\Entity\Centro::class)->find($request->query->get('centro'));
        }

        if (!$centro && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Sin centro asignado'], 400);
        }

        $periodo = $this->resolverPeriodo($request);

        // Obtener grupos del centro, opcionalmente filtrados por año escolar
        $grupoRepo = $this->em->getRepository(\App\Entity\Grupo::class);
        $anioEscolar = $request->query->get('anioEscolar');

        $criteria = [];
        if ($centro) {
            $criteria['centro'] = $centro;
        }
        if ($anioEscolar) {
            $criteria['anioEscolar'] = $anioEscolar;
        }

        $grupos = !empty($criteria)
            ? $grupoRepo->findBy($criteria)
            : $grupoRepo->findAll();

        $resultado = [];
        foreach ($grupos as $grupo) {
            $imparticiones = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);
            $matriculas = $this->em->getRepository(Matricula::class)->findBy(['grupo' => $grupo]);
            $alumnos = array_map(fn($m) => $m->getAlumno(), $matriculas);

            $modulosData = [];
            foreach ($imparticiones as $imp) {
                $pesos = $this->ponderacionRepo->getPesosParaImparticion($imp->getId());
                $notas = [];
                foreach ($alumnos as $alumno) {
                    $media = $this->calcularMediaAlumno($imp->getId(), $alumno->getId(), $pesos, $periodo);
                    if ($media['notaFinal'] !== null) {
                        $notas[] = $media['notaFinal'];
                    }
                }

                $aprobados = count(array_filter($notas, fn($n) => $n >= 5));
                $total = count($notas);

                $modulosData[] = [
                    'materia' => $imp->getMateria()->getNombre(),
                    'profesor' => $imp->getProfesor()->getNombre() . ' ' . $imp->getProfesor()->getApellidos(),
                    'mediaGrupo' => $total > 0 ? round(array_sum($notas) / $total, 2) : null,
                    'aprobados' => $aprobados,
                    'suspensos' => $total - $aprobados,
                    'totalAlumnos' => $total,
                    'tasaAprobados' => $total > 0 ? round(($aprobados / $total) * 100, 1) : null,
                ];
            }

            $itinerario = $grupo->getItinerario();
            $resultado[] = [
                'grupo' => [
                    'id' => $grupo->getId(),
                    'nombre' => $grupo->getNombre(),
                    'curso' => $grupo->getCurso(),
                    'ciclo' => $itinerario->getNombre(),
                    'anioEscolar' => $grupo->getAnioEscolar(),
                ],
                'modulos' => $modulosData,
            ];
        }

        // Obtener todos los años escolares disponibles del centro (para el selector)
        $allGrupos = $centro
            ? $grupoRepo->findBy(['centro' => $centro])
            : $grupoRepo->findAll();
        $aniosDisponibles = array_values(array_unique(
            array_map(fn($g) => $g->getAnioEscolar(), $allGrupos)
        ));
        rsort($aniosDisponibles);

        return $this->json([
            'grupos' => $resultado,
            'aniosDisponibles' => $aniosDisponibles,
        ]);
    }

    /**
     * Calificaciones del alumno autenticado (o de otro alumno si SuperAdmin pasa ?alumnoId).
     */
    #[Route('/api/v1/alumno/mis-calificaciones', name: 'api_mis_calificaciones', methods: ['GET'])]
    public function misCalificaciones(Request $request): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser instanceof User) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        // SuperAdmin puede consultar calificaciones de cualquier alumno
        $alumnoId = $request->query->get('alumnoId');
        if ($alumnoId && ($this->isGranted('ROLE_SUPERADMIN') || $this->isGranted('ROLE_SUPER_ADMIN'))) {
            $alumno = $this->em->getRepository(User::class)->find($alumnoId);
            if (!$alumno) {
                return $this->json(['message' => 'Alumno no encontrado'], 404);
            }
        } else {
            $alumno = $currentUser;
        }

        $periodo = $this->resolverPeriodo($request);

        $matriculas = $this->em->getRepository(Matricula::class)->findBy(['alumno' => $alumno]);

        $materias = [];
        foreach ($matriculas as $matricula) {
            $grupo = $matricula->getGrupo();
            $imparticiones = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);

            foreach ($imparticiones as $imparticion) {
                $pesos = $this->ponderacionRepo->getPesosParaImparticion($imparticion->getId());
                $media = $this->calcularMediaAlumno($imparticion->getId(), $alumno->getId(), $pesos, $periodo);

                $materias[] = [
                    'imparticion' => [
                        'id' => $imparticion->getId(),
                        'materia' => $imparticion->getMateria()->getNombre(),
                        'profesor' => $imparticion->getProfesor()->getNombre() . ' ' . $imparticion->getProfesor()->getApellidos(),
                        'grupo' => $this->formatGrupoLabel($grupo),
                    ],
                    ...$media,
                ];
            }
        }

        return $this->json([
            'alumno' => [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
            ],
            'modulos' => $materias,
        ]);
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
