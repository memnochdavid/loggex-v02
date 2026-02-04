<?php

namespace App\Controller;

use App\Entity\Asistencia;
use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class AsistenciaController extends AbstractController
{
    #[Route('/api/asistencia/sheet', name: 'api_asistencia_sheet', methods: ['GET'])]
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

        // Obtener alumnos del grupo
        $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['grupo' => $imparticion->getGrupo()]);

        $alumnosData = [];
        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();

            // Buscar asistencia existente
            $asistencia = $entityManager->getRepository(Asistencia::class)->findOneBy([
                'imparticion' => $imparticion,
                'alumno' => $alumno,
                'fecha' => new \DateTime($fecha),
                'hora' => new \DateTime($hora) // La hora es importante si hay varias clases el mismo día
            ]);

            $alumnosData[] = [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
                'foto' => $alumno->getFoto(),
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

        return $this->json($alumnosData);
    }

    #[Route('/api/asistencia/batch', name: 'api_asistencia_batch', methods: ['POST'])]
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

            // Buscar si ya existe para actualizar
            $asistencia = $entityManager->getRepository(Asistencia::class)->findOneBy([
                'imparticion' => $imparticion,
                'alumno' => $alumno,
                'fecha' => $fecha,
                'hora' => $hora
            ]);

            if (!$asistencia) {
                $asistencia = new Asistencia();
                $asistencia->setImparticion($imparticion);
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

    #[Route('/api/asistencia/alumno/summary', name: 'api_asistencia_alumno_summary', methods: ['GET'])]
    public function getAlumnoSummary(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        // 1. Obtener matrículas del alumno
        $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['alumno' => $user]);

        $summary = [];

        foreach ($matriculas as $matricula) {
            $grupo = $matricula->getGrupo();

            // 2. Obtener imparticiones (asignaturas) del grupo
            $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);

            foreach ($imparticiones as $imparticion) {
                $key = $imparticion->getId();
                $moduloNombre = $imparticion->getModulo()->getNombre();
                $profesorNombre = $imparticion->getProfesor()->getNombre() . ' ' . $imparticion->getProfesor()->getApellidos();

                // Inicializar estructura para esta asignatura
                if (!isset($summary[$key])) {
                    $summary[$key] = [
                        'id' => $key,
                        'title' => $moduloNombre . ' (' . $profesorNombre . ')',
                        'faltas' => 0,
                        'retrasos' => 0,
                        'justificadas' => 0,
                        'detalles' => []
                    ];
                }

                // 3. Buscar asistencias del alumno en esta impartición
                $asistencias = $entityManager->getRepository(Asistencia::class)->findBy([
                    'alumno' => $user,
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

                // Ordenar detalles por fecha descendente
                usort($summary[$key]['detalles'], function($a, $b) {
                    return strcmp($b['fecha'] . $b['hora'], $a['fecha'] . $a['hora']);
                });
            }
        }

        return $this->json(array_values($summary));
    }
}
