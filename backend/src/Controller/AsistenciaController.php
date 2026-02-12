<?php

namespace App\Controller;

use App\Entity\Asistencia;
use App\Entity\Festivo;
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

    #[Route('/api/v1/asistencia/alumno/summary', name: 'api_asistencia_alumno_summary', methods: ['GET'])]
    public function getAlumnoSummary(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        try {
            if (!$user) {
                return $this->json(['message' => 'No autenticado'], 401);
            }

            // 1. Obtener matrículas del alumno
            $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['alumno' => $user]);

            // Optimización: Cargar festivos una sola vez
            $festivos = $entityManager->getRepository(Festivo::class)->findAll();

            $summary = [];

            foreach ($matriculas as $matricula) {
                $grupo = $matricula->getGrupo();
                $fechaInicio = $grupo->getFechaInicio();
                $fechaFin = $grupo->getFechaFin();

                // 2. Obtener imparticiones (asignaturas) del grupo
                $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);

                foreach ($imparticiones as $imparticion) {
                    $key = $imparticion->getId();
                    $moduloNombre = $imparticion->getModulo()->getNombre();
                    $profesor = $imparticion->getProfesor();
                    $profesorNombre = $profesor ? ($profesor->getNombre() . ' ' . $profesor->getApellidos()) : 'Sin profesor';

                    // Inicializar estructura para esta asignatura
                    if (!isset($summary[$key])) {
                        $summary[$key] = [
                            'id' => $key,
                            'title' => $moduloNombre . ' (' . $profesorNombre . ')',
                            'faltas' => 0,
                            'retrasos' => 0,
                            'justificadas' => 0,
                            'porcentajeFaltas' => 0,
                            'totalHoras' => 0,
                            'detalles' => []
                        ];
                    }

                    // 3. Calcular total de horas lectivas si hay fechas definidas
                    if ($fechaInicio && $fechaFin) {
                        $totalHoras = $this->calcularHorasLectivas($imparticion, $fechaInicio, $fechaFin, $festivos);
                        $summary[$key]['totalHoras'] = $totalHoras;
                    }

                    // 4. Buscar asistencias del alumno en esta impartición
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

                    // Calcular porcentaje
                    if ($summary[$key]['totalHoras'] > 0) {
                        // Consideramos F y J como faltas para el porcentaje
                        $totalAusencias = $summary[$key]['faltas'] + $summary[$key]['justificadas'];
                        $summary[$key]['porcentajeFaltas'] = round(($totalAusencias / $summary[$key]['totalHoras']) * 100, 2);
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

    /**
     * @param Imparticion $imparticion
     * @param \DateTimeInterface $inicio
     * @param \DateTimeInterface $fin
     * @param Festivo[] $festivos
     * @return int
     */
    private function calcularHorasLectivas(Imparticion $imparticion, \DateTimeInterface $inicio, \DateTimeInterface $fin, array $festivos): int
    {
        $totalHoras = 0;
        $horarios = $imparticion->getHorarios(); // Colección de Horario

        // Mapear días de la semana a horas de clase: 1 (Lunes) => total_horas
        $horariosPorDia = [];
        foreach ($horarios as $h) {
            $dia = $h->getDiaSemana();
            if (!isset($horariosPorDia[$dia])) {
                $horariosPorDia[$dia] = 0;
            }

            $hInicio = $h->getHoraInicio();
            $hFin = $h->getHoraFin();

            if ($hInicio && $hFin) {
                $diff = $hFin->diff($hInicio);
                $horas = $diff->h + ($diff->i / 60);
                $horariosPorDia[$dia] += $horas;
            }
        }

        // Pre-procesar festivos a formato 'Y-m-d' para comparaciones rápidas
        $diasFestivos = [];
        foreach ($festivos as $f) {
            $fInicio = $f->getFechaInicio();
            if (!$fInicio) continue;

            $fFin = $f->getFechaFin() ?? $fInicio;

            // Iterar rango de festivo y guardar cada día
            $fCurrent = clone $fInicio;
            $fCurrent->setTime(0,0,0);
            $fEnd = clone $fFin;
            $fEnd->setTime(0,0,0);

            // Protección contra bucles infinitos en festivos (max 30 días por festivo)
            $festivoCount = 0;
            while ($fCurrent <= $fEnd && $festivoCount < 30) {
                $diasFestivos[$fCurrent->format('Y-m-d')] = true;
                $fCurrent->modify('+1 day');
                $festivoCount++;
            }
        }

        // Iterar día a día
        $current = clone $inicio;
        $current->setTime(0, 0, 0);

        $hoy = new \DateTime();
        $hoy->setTime(0, 0, 0);

        $finClone = clone $fin;
        $finClone->setTime(0, 0, 0);

        // El límite es la fecha de fin de curso o hoy, lo que ocurra antes
        $limite = ($finClone < $hoy) ? $finClone : $hoy;

        // Protección contra bucles infinitos o rangos muy grandes (ej: 2 años)
        $maxDays = 730;
        $count = 0;

        while ($current <= $limite && $count < $maxDays) {
            $count++;
            $currentStr = $current->format('Y-m-d');

            // 1. Verificar si es festivo (búsqueda O(1))
            if (!isset($diasFestivos[$currentStr])) {
                // 2. Verificar si hay clase ese día de la semana (1=Lunes, 7=Domingo)
                $diaSemana = (int)$current->format('N');

                if (isset($horariosPorDia[$diaSemana])) {
                    $totalHoras += $horariosPorDia[$diaSemana];
                }
            }

            $current->modify('+1 day');
        }

        return (int)round($totalHoras);
    }
}
