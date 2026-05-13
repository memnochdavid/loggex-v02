<?php

namespace App\Controller;

use App\Entity\Asistencia;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;

class AsistenciaController extends AbstractController
{
    #[Route('/api/v1/asistencia/sheet', name: 'api_asistencia_sheet', methods: ['GET'])]
    public function getSheet(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $imparticionId = $request->query->get('imparticion');
        $fecha = $request->query->get('fecha'); // YYYY-MM-DD
        $hora = $request->query->get('hora'); // HH:MM

        if (!$imparticionId || !$fecha || !$hora) {
            return $this->json(['message' => 'Faltan parámetros'], 400);
        }

        $imparticion = $entityManager->getRepository(Imparticion::class)->find($imparticionId);
        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        // Fase E clases-compartidas (2026-05-13): cuando la imparticion pertenece
        // a un conjunto de hermandad (algún Horario con `gemelo_id` apuntando a
        // otra imparticion gemela, caso típico 1º DAW + 1º DAM LOMLOE), incluir
        // a los alumnos de TODOS los grupos hermanos en una sola hoja. Cada
        // alumno conserva su `imparticionId` natural (la de SU grupo) para que
        // su Asistencia se registre contra ella, manteniendo la integridad del
        // summary del alumno y de las medias por grupo.
        $impsGemelas = $this->findImparticionesGemelas($imparticion, $entityManager);
        $gruposGemelos = [];
        $impIdByGrupoId = [];
        foreach ($impsGemelas as $i) {
            $g = $i->getGrupo();
            if (!$g) continue;
            $gruposGemelos[$g->getId()] = $g;
            $impIdByGrupoId[$g->getId()] = $i->getId();
        }
        if (empty($gruposGemelos)) {
            // Fallback defensivo: imparticion sin grupo (caso edge improbable).
            $gruposGemelos[$imparticion->getGrupo()->getId()] = $imparticion->getGrupo();
            $impIdByGrupoId[$imparticion->getGrupo()->getId()] = $imparticion->getId();
        }

        $matriculas = $entityManager->getRepository(Matricula::class)->findBy([
            'grupo' => array_values($gruposGemelos),
            'deleted' => false,
        ]);

        $alumnosData = [];
        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();
            $grupo = $matricula->getGrupo();
            $impIdAlumno = $impIdByGrupoId[$grupo->getId()] ?? $imparticion->getId();

            // Asistencia existente: SIEMPRE contra la imparticion natural del
            // alumno (la de su grupo). Sin esto, alumnos del grupo gemelo
            // verían registros pegados a la imp del grupo del titular y el
            // summary del alumno (que itera por SUS matriculas → SUS imps) no
            // los encontraría.
            $asistencia = $entityManager->getRepository(Asistencia::class)->findOneBy([
                'imparticion' => $entityManager->getReference(Imparticion::class, $impIdAlumno),
                'alumno' => $alumno,
                'fecha' => new \DateTime($fecha),
                'hora' => new \DateTime($hora) // La hora es importante si hay varias clases el mismo día
            ]);

            $alumnosData[] = [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
                'foto' => $alumno->getFoto(),
                'imparticionId' => $impIdAlumno,
                'grupo' => [
                    'id' => $grupo->getId(),
                    'nombre' => $grupo->getNombre(),
                    'abreviatura' => $grupo->getAbreviatura(),
                    'curso' => $grupo->getCurso(),
                ],
                'asistencia' => $asistencia ? [
                    'id' => $asistencia->getId(),
                    'estado' => $asistencia->getEstado(),
                    'comentario' => $asistencia->getComentario()
                ] : null
            ];
        }

        // Ordenar por apellidos
        usort($alumnosData, function($a, $b) {
            return strcmp($a['apellidos'], $b['apellidos']);
        });

        // Compat: si solo hay 1 grupo (caso mayoritario), devolvemos el array
        // flat de toda la vida. Si hay gemelos, devolvemos objeto con
        // `gruposCompartidos` para que el frontend muestre la columna Grupo.
        if (count($gruposGemelos) <= 1) {
            return $this->json($alumnosData);
        }

        $gruposCompartidos = array_values(array_map(fn ($g) => [
            'id' => $g->getId(),
            'nombre' => $g->getNombre(),
            'abreviatura' => $g->getAbreviatura(),
            'curso' => $g->getCurso(),
        ], $gruposGemelos));

        return $this->json([
            'alumnos' => $alumnosData,
            'gruposCompartidos' => $gruposCompartidos,
        ]);
    }

    /**
     * Devuelve las imparticiones del conjunto de hermandad de `$imp` (la
     * propia incluida). Para clases gemelas (1º DAW + 1º DAM LOMLOE),
     * recolecta TODAS las imparticiones cuyo placement pertenece al mismo
     * conjunto de `Horario.gemelo_id` (raíz + copias).
     *
     * @return list<Imparticion>
     */
    private function findImparticionesGemelas(Imparticion $imp, EntityManagerInterface $em): array
    {
        $rootIds = [];
        foreach ($imp->getHorarios() as $h) {
            if ($h->isDeleted()) continue;
            $rootIds[$h->getGemeloRoot()->getId()] = true;
        }
        if (empty($rootIds)) {
            return [$imp];
        }
        $rootIdArr = array_keys($rootIds);
        // Por convención (canonicalización Fase B), `gemelo` apunta SIEMPRE
        // al raíz, no encadena. Así la query "todos los hermanos de X" es
        // `WHERE h.id = X OR h.gemelo = X` para cada raíz. DQL no permite
        // seleccionar `i` directamente desde JOIN sin alias raíz, por lo que
        // usamos `Imparticion` como root y filtramos por su relación inversa
        // a Horario.
        $dql = "SELECT DISTINCT i
                FROM App\\Entity\\Imparticion i
                JOIN i.horarios h
                WHERE (h.id IN (:roots) OR h.gemelo IN (:roots))
                  AND h.deleted = false";
        $rows = $em->createQuery($dql)
            ->setParameter('roots', $rootIdArr)
            ->getResult();
        // Garantizamos que la propia $imp esté presente (en caso edge de que
        // un horario no esté en hermandad pero la query gemela traiga otras).
        $byId = [];
        foreach ($rows as $i) {
            $byId[$i->getId()] = $i;
        }
        if (!isset($byId[$imp->getId()])) {
            $byId[$imp->getId()] = $imp;
        }
        return array_values($byId);
    }

    #[Route('/api/v1/asistencia/batch', name: 'api_asistencia_batch', methods: ['POST'])]
    public function saveBatch(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $imparticionId = $data['imparticion'];
        $fecha = new \DateTime($data['fecha']);
        $hora = new \DateTime($data['hora']);
        $asistencias = $data['asistencias']; // Array de { alumnoId, estado, comentario }

        $imparticion = $entityManager->getRepository(Imparticion::class)->find($imparticionId);
        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        foreach ($asistencias as $item) {
            $alumno = $entityManager->getRepository(User::class)->find($item['alumnoId']);
            if (!$alumno) continue;

            // Fase E clases-compartidas (2026-05-13): si el item trae su propio
            // `imparticionId`, lo usamos en lugar del global (alumno de grupo
            // gemelo → su asistencia se registra contra SU imparticion, no
            // contra la del titular del bloque). El frontend nuevo lo envía
            // siempre que el backend haya marcado la hoja como compartida.
            $impForItem = $imparticion;
            if (!empty($item['imparticionId']) && (int) $item['imparticionId'] !== $imparticion->getId()) {
                $impCandidate = $entityManager->getRepository(Imparticion::class)->find($item['imparticionId']);
                if ($impCandidate) {
                    $impForItem = $impCandidate;
                }
            }

            // Buscar si ya existe para actualizar
            $asistencia = $entityManager->getRepository(Asistencia::class)->findOneBy([
                'imparticion' => $impForItem,
                'alumno' => $alumno,
                'fecha' => $fecha,
                'hora' => $hora
            ]);

            if (!$asistencia) {
                $asistencia = new Asistencia();
                $asistencia->setImparticion($impForItem);
                $asistencia->setAlumno($alumno);
                $asistencia->setFecha($fecha);
                $asistencia->setHora($hora);
            }

            $asistencia->setEstado($item['estado']);
            $asistencia->setComentario($item['comentario'] ?? null);

            $entityManager->persist($asistencia);
        }

        $entityManager->flush();

        return $this->json(['message' => 'Asistencias guardadas correctamente']);
    }

    #[Route('/api/v1/asistencia/alumno/summary', name: 'api_asistencia_alumno_summary', methods: ['GET'])]
    public function getAlumnoSummary(Request $request, #[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        try {
            if (!$user) {
                return $this->json(['message' => 'No autenticado'], 401);
            }

            $targetUser = $user;
            $alumnoId = $request->query->get('alumnoId');

            // Si se solicita ver otro alumno, verificar permisos
            if ($alumnoId) {
                if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
                    throw new AccessDeniedException('No tienes permiso para ver las faltas de otros alumnos.');
                }

                $targetUser = $entityManager->getRepository(User::class)->find($alumnoId);
                if (!$targetUser) {
                    return $this->json(['message' => 'Alumno no encontrado'], 404);
                }
            }

            // 1. Obtener matrículas activas del alumno objetivo. Filtrar deleted
            // explícitamente: si hay una matrícula soft-deleted y otra viva en el
            // mismo grupo (caso real visto en BD), sin este filtro el bucle siguiente
            // procesa el grupo dos veces y duplica las asistencias del summary.
            $matriculas = $entityManager->getRepository(Matricula::class)->findBy([
                'alumno' => $targetUser,
                'deleted' => false,
            ]);

            $summary = [];

            foreach ($matriculas as $matricula) {
                $grupo = $matricula->getGrupo();

                // 2. Obtener imparticiones (asignaturas) del grupo
                $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);

                foreach ($imparticiones as $imparticion) {
                    $key = $imparticion->getId();
                    $materia = $imparticion->getMateria();
                    $moduloNombre = $materia->getNombre();
                    $profesor = $imparticion->getProfesor();
                    $profesorNombre = $profesor ? ($profesor->getNombre() . ' ' . $profesor->getApellidos()) : 'Sin profesor';

                    // 3. Horas totales anuales (denominador del porcentaje).
                    // Fuente de verdad: catálogo oficial BOE / BOJA. Helper
                    // `getObjetivoAnualMinutos()` aplica cascada `horasTotales × 60`
                    // (dato legal LOMLOE) → `minutosSemanales × 36` (fallback).
                    // Si la materia no tiene NINGUNO de los dos, el porcentaje
                    // queda null (no calculable) en lugar de 0% engañoso.
                    $objetivoMinutos = $materia->getObjetivoAnualMinutos();
                    $totalHorasAnuales = (int) round($objetivoMinutos / 60);

                    // Inicializar estructura para esta asignatura
                    if (!isset($summary[$key])) {
                        $summary[$key] = [
                            'id' => $key,
                            'title' => $moduloNombre . ' (' . $profesorNombre . ')',
                            'faltas' => 0,
                            'retrasos' => 0,
                            'justificadas' => 0,
                            'porcentajeFaltas' => $totalHorasAnuales > 0 ? 0 : null,
                            'totalHoras' => $totalHorasAnuales,
                            'detalles' => []
                        ];
                    }

                    // 4. Buscar asistencias del alumno en esta impartición
                    $asistencias = $entityManager->getRepository(Asistencia::class)->findBy([
                        'alumno' => $targetUser,
                        'imparticion' => $imparticion
                    ]);

                    foreach ($asistencias as $asistencia) {
                        if ($asistencia->getEstado() === 'P') continue; // Ignorar presentes

                        if ($asistencia->getEstado() === 'F') $summary[$key]['faltas']++;
                        if ($asistencia->getEstado() === 'R') $summary[$key]['retrasos']++;
                        if ($asistencia->getEstado() === 'J') $summary[$key]['justificadas']++;

                        $summary[$key]['detalles'][] = [
                            'id' => $asistencia->getId(),
                            'fecha' => $asistencia->getFecha()->format('Y-m-d'),
                            'hora' => $asistencia->getHora()->format('H:i'),
                            'estado' => $asistencia->getEstado(),
                            'comentario' => $asistencia->getComentario()
                        ];
                    }

                    // 5. Porcentaje sobre el TOTAL ANUAL legal (umbral pérdida
                    // evaluación continua FP Andalucía: 25-30% según orden
                    // autonómica). F y J cuentan como ausencia para el cálculo.
                    if ($totalHorasAnuales > 0) {
                        $totalAusencias = $summary[$key]['faltas'] + $summary[$key]['justificadas'];
                        $summary[$key]['porcentajeFaltas'] = round(($totalAusencias / $totalHorasAnuales) * 100, 2);
                    }

                    // Ordenar detalles por fecha descendente
                    usort($summary[$key]['detalles'], function($a, $b) {
                        return strcmp($b['fecha'] . $b['hora'], $a['fecha'] . $a['hora']);
                    });
                }
            }

            return $this->json(array_values($summary));
        } catch (\Exception $e) {
            // Loguear el error y devolver 500 con detalles para depuración
            return $this->json(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
        }
    }

}
