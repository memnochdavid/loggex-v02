<?php

namespace App\Controller;

use App\Entity\Horario;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class GetMyScheduleController extends AbstractController
{
    public const CACHE_KEY_PREFIX = 'schedule_';
    private const CACHE_TTL_SECONDS = 300; // 5min

    public function __construct(private readonly CacheInterface $cache)
    {
    }

    #[Route('/api/my-schedule', name: 'api_my_schedule', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $userId = $user->getId();
        $data = $this->cache->get(
            self::CACHE_KEY_PREFIX . $userId,
            function (ItemInterface $item) use ($user, $entityManager): array {
                $item->expiresAfter(self::CACHE_TTL_SECONDS);
                return $this->computeSchedule($user, $entityManager);
            }
        );

        return $this->json($data);
    }

    private function computeSchedule(User $user, EntityManagerInterface $entityManager): array
    {
        $horarios = [];
        $roles = $user->getRoles();
        $userId = $user->getId();

        // 1. Buscar como ALUMNO
        if (in_array('ROLE_ALUMNO', $roles)) {
            $dql = "SELECT h, i, m, g, p
                    FROM App\Entity\Horario h
                    JOIN h.imparticion i
                    JOIN i.materia m
                    JOIN i.grupo g
                    JOIN g.matriculas mat
                    LEFT JOIN i.profesor p
                    WHERE mat.alumno = :userId AND h.deleted = false";

            $query = $entityManager->createQuery($dql)->setParameter('userId', $userId);
            $horarios = array_merge($horarios, $query->getResult());
        }

        // 2. Buscar como PROFESOR/ADMIN
        if (in_array('ROLE_PROFESOR', $roles) || in_array('ROLE_ADMIN', $roles) || in_array('ROLE_SUPERADMIN', $roles)) {
            // Usamos IDENTITY() o comparamos con el ID de la relación para ser explícitos
            $dql = "SELECT h, i, m, g
                    FROM App\Entity\Horario h
                    JOIN h.imparticion i
                    JOIN i.materia m
                    JOIN i.grupo g
                    WHERE i.profesor = :userId AND h.deleted = false";

            $query = $entityManager->createQuery($dql)->setParameter('userId', $userId);
            $resultadosProfesor = $query->getResult();

            // Fusionar
            foreach ($resultadosProfesor as $rp) {
                $existe = false;
                foreach ($horarios as $h) {
                    if ($h->getId() === $rp->getId()) {
                        $existe = true;
                        break;
                    }
                }
                if (!$existe) {
                    $horarios[] = $rp;
                }
            }
        }

        $events = [];
        // Recolectamos también los slots para que el TimeTable los renderice.
        // Tres fuentes (en este orden, dedup por clave "HH:MM-HH:MM"):
        //  1) Jornada efectiva de cada PeriodoLectivo de los horarios (cubre el
        //     caso PL.jornadaTipo override por rango).
        //  2) Jornada efectiva del grupo (cubre Grupo.jornadaTipoOverride o
        //     fallback al itinerario).
        //  3) Slots derivados de los propios horarios (red de seguridad: si la
        //     jornada efectiva no acoge un slot, el evento aún se renderiza).
        // Sin (1) y (3), un profe con clases en grupo cuyo itinerario es de
        // mañana pero override/PL=tarde no veía la rejilla de tarde aunque el
        // PDF sí la mostraba (deriva slots de horarios reales).
        $slotsByKey = [];

        foreach ($horarios as $h) {
            $grupo = $h->getImparticion()->getGrupo();
            $profesorNombre = 'Sin asignar';
            if ($h->getImparticion()->getProfesor()) {
                $profesorNombre = $h->getImparticion()->getProfesor()->getNombre() . ' ' . $h->getImparticion()->getProfesor()->getApellidos();
            }

            $events[] = [
                'id' => $h->getId(),
                'diaSemana' => $h->getDiaSemana(),
                'horaInicio' => $h->getHoraInicio()->format('H:i'),
                'horaFin' => $h->getHoraFin()->format('H:i'),
                'aula' => $h->getAula(),
                'materia' => $h->getImparticion()->getMateria()->getNombre(),
                'moduloAbreviatura' => $h->getImparticion()->getMateria()->getAbreviatura(),
                'moduloId' => $h->getImparticion()->getMateria()->getId(),
                'grupo' => $grupo->getNombre(),
                'grupoAbreviatura' => $grupo->getAbreviatura(),
                'grupoCurso' => $grupo->getCurso(),
                'profesor' => $profesorNombre,
                'imparticionId' => $h->getImparticion()->getId()
            ];

            // (1) Jornada efectiva del PL del horario, si existe.
            $jornadaPl = $h->getPeriodoLectivo()?->getEffectiveJornadaTipo();
            if ($jornadaPl !== null) {
                $this->collectSlots($jornadaPl, $slotsByKey);
            }

            // (2) Jornada efectiva del grupo (override o itinerario).
            $jornadaGrupo = $grupo->getEffectiveJornadaTipo();
            if ($jornadaGrupo !== null) {
                $this->collectSlots($jornadaGrupo, $slotsByKey);
            }

            // (3) DESACTIVADA (2026-05-01): la red de seguridad de derivar
            // slots del propio horario rompe el modelo de bloques 60-120min.
            // Si un horario abarca un bloque (ej. 8:30-10:30), añadir ese
            // rango como "slot" mete una entrada falsa que el frontend
            // confunde con un slot atómico — generaba time labels duplicadas
            // tipo "8:30-9:00" + "8:30-10:30" en la grilla. Ahora los slots
            // SÓLO vienen de la jornada (granularidad fija 30min), y el
            // frontend renderiza los bloques con `gridRow span` proporcional
            // a la duración del horario.
        }

        $slots = array_values($slotsByKey);
        usort($slots, fn ($a, $b) => strcmp($a['horaInicio'], $b['horaInicio']));

        return [
            'events' => $events,
            'slots' => $slots,
        ];
    }

    /**
     * Añade los tramos SLOT de una jornada al mapa de slots, dedup por
     * "HH:MM-HH:MM" para que jornadas distintas con tramos coincidentes no se
     * dupliquen.
     */
    private function collectSlots(\App\Entity\JornadaTipo $jornada, array &$slotsByKey): void
    {
        foreach ($jornada->getTramos() as $t) {
            $tipo = $t->getTipo();
            // Aceptamos SLOT y RECREO. Otros tipos (si los hay) los ignoramos.
            if ($tipo !== \App\Entity\TipoTramo::SLOT && $tipo !== \App\Entity\TipoTramo::RECREO) continue;
            $hi = $t->getHoraInicio()?->format('H:i');
            $hf = $t->getHoraFin()?->format('H:i');
            if ($hi === null || $hf === null) continue;
            $key = "{$hi}-{$hf}";
            if (!isset($slotsByKey[$key])) {
                $slotsByKey[$key] = [
                    'horaInicio' => $hi,
                    'horaFin' => $hf,
                    'duracionMinutos' => $t->getDuracionMinutos(),
                    'tipo' => $tipo === \App\Entity\TipoTramo::RECREO ? 'recreo' : 'slot',
                    'etiqueta' => $t->getEtiqueta(),
                ];
            }
        }
    }
}
