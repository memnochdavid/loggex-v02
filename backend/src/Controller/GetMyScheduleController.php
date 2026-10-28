<?php

namespace App\Controller;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
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

        // Set de IDs de horarios cargados "como alumno" (vía matrícula). Usado
        // para preservar los placements no_presenciales en el horario del
        // alumno (caso 2º DAW navegando a 3ª evaluación: VE su FCT/Proyecto)
        // mientras el profe que los imparte NO los ve en su /horarios (su
        // jornada custom 08:30-15:30 descuadraría su rejilla con clases
        // regulares en otros grupos).
        $idsOrigenAlumno = [];

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
            $resAlumno = $query->getResult();
            foreach ($resAlumno as $h) {
                $idsOrigenAlumno[$h->getId()] = true;
            }
            $horarios = array_merge($horarios, $resAlumno);
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
        // Fase E clases-compartidas (2026-05-13): cuando un profe imparte una
        // clase gemela (misma materia, dos grupos hermanos LOMLOE — caso real
        // 1º DAW + 1º DAM EAG), la query lo carga DOS veces (una por imp). En
        // lugar de pintar dos cards solapadas, fusionamos los horarios del
        // mismo conjunto de hermandad (`gemelo_id`) en UN event con array
        // `gruposCompartidos` que el frontend usa para etiquetar "1º DAW + 1º DAM".
        // Indexamos por `rootId` (id del raíz de hermandad — getGemeloRoot).
        // Un alumno solo carga su grupo, así que su array tendrá 1 entrada
        // (sin etiqueta combinada). Un profe que imparte ambos verá UNA card.
        $eventsByRootId = [];
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

        // Refactor Fase B fix 2026-05-12: slots agrupados por PeriodoLectivo
        // para que el frontend pueda pintar SOLO los del PL aplicable a la
        // fecha visible. Sin este agrupamiento, un alumno de FP 2º veía
        // mezclados los slots de "FP Mañanas" (rangos 1ª/2ª eval) con los
        // slots de "FP 3ª evaluación" (rango 3) — filas fantasma en la
        // rejilla y bloque FCT visualmente desproporcionado.
        // Mantenemos `slots` plano (unión) como legacy fallback compatible.
        // El frontend con cascada SEMANA→PLANTILLA elige `slotsByPlId[plId]`.
        $slotsByPlId = [];

        foreach ($horarios as $h) {
            $grupo = $h->getImparticion()->getGrupo();
            $profesorNombre = 'Sin asignar';
            if ($h->getImparticion()->getProfesor()) {
                $profesorNombre = $h->getImparticion()->getProfesor()->getNombre() . ' ' . $h->getImparticion()->getProfesor()->getApellidos();
            }

            // Rango del PeriodoLectivo del horario, para que el frontend pueda
            // filtrar por fecha visualizada. Sin esto, un grupo con 3 PLs
            // cronológicos muestra 3 copias del mismo bloque (mismo día y
            // hora) en widgets/grillas que no controlan el rango.
            $pl = $h->getPeriodoLectivo();
            // Skip placements no_presenciales SOLO si llegan vía rol profe
            // (Fase B fix 2026-05-12). Razón: las prácticas (FCT/Proyecto/HLC)
            // tienen jornada custom (08:30-15:30) que NO encaja con la jornada
            // lectiva regular del profe en sus otros grupos — mezclar ambas
            // descuadra la rejilla. El ALUMNO sí debe verlas (su rango 3 es
            // su semana real de prácticas), y para él no hay conflicto porque
            // solo tiene un grupo activo. El `idsOrigenAlumno` distingue:
            // si el horario lo cargamos por matrícula, es del alumno y se
            // conserva; si solo viene por imparticion.profesor, se filtra.
            if ($pl?->getEtiqueta() === 'no_presenciales'
                && !isset($idsOrigenAlumno[$h->getId()])
            ) {
                continue;
            }
            $plFechaInicio = $pl?->getFechaInicio()?->format('Y-m-d');
            $plFechaFin    = $pl?->getFechaFin()?->format('Y-m-d');
            // Refactor modelo semanal (2026-05-06): exponemos `tipo` para que
            // el frontend haga la cascada SEMANA-cubre-fecha → PLANTILLA sin
            // duplicar (la PLANTILLA tiene fechas NULL → si no exponemos tipo
            // queda como "matchea cualquier fecha" y se mezcla con SEMANAs).
            $plTipo = $pl?->getTipo()?->value;

            // Fase E: clave de agrupación = id del raíz de hermandad. Para
            // horarios sin gemelo, es el id del propio horario (no fusiona con
            // nadie). Para horarios con gemelo, todos los del conjunto comparten
            // el mismo raíz y caen en el mismo bucket.
            $rootId = $h->getGemeloRoot()->getId();
            $grupoCompartido = [
                'id' => $grupo->getId(),
                'nombre' => $grupo->getNombre(),
                'abreviatura' => $grupo->getAbreviatura(),
                'curso' => $grupo->getCurso(),
                'imparticionId' => $h->getImparticion()->getId(),
            ];

            if (isset($eventsByRootId[$rootId])) {
                // Ya hay un event para este conjunto de hermandad: solo añadimos
                // el grupo al array compartido (si no estaba ya). El primer
                // event que entra en el bucket sigue siendo el "principal"
                // (sus campos `grupo`/`imparticionId`/etc. se preservan por
                // compat con clientes viejos; el frontend nuevo lee
                // `gruposCompartidos`).
                $idx =& $eventsByRootId[$rootId];
                $yaPresente = false;
                foreach ($idx['gruposCompartidos'] as $g) {
                    if ($g['id'] === $grupo->getId()) { $yaPresente = true; break; }
                }
                if (!$yaPresente) {
                    $idx['gruposCompartidos'][] = $grupoCompartido;
                }
                // Continuamos al siguiente horario sin pushear event nuevo.
                continue;
            }

            $eventsByRootId[$rootId] = [
                'id' => $h->getId(),
                'rootId' => $rootId,
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
                'grupoId' => $grupo->getId(),  // necesario para agrupar en frontend
                'profesor' => $profesorNombre,
                'imparticionId' => $h->getImparticion()->getId(),
                'periodoLectivoId' => $pl?->getId(),
                'periodoLectivoTipo' => $plTipo,  // 'plantilla' | 'semana' | null
                'periodoLectivoFechaInicio' => $plFechaInicio,
                'periodoLectivoFechaFin' => $plFechaFin,
                // Fase E: array con TODOS los grupos del conjunto de hermandad
                // presentes en este user. Si solo hay 1, el frontend renderiza
                // como antes (etiqueta singular). Si hay >1, etiqueta combinada
                // "1º DAW + 1º DAM" en card y modal de detalle.
                'gruposCompartidos' => [$grupoCompartido],
            ];

            // (1) Jornada efectiva del PL del horario, si existe.
            // Acumula tanto en el conjunto plano (legacy `slots`) como en el
            // agrupado por PL (`slotsByPlId`, Fase B fix 2026-05-12). El
            // frontend usa el agrupado para pintar SOLO los del PL aplicable
            // a la fecha visible, evitando filas fantasma de jornadas de
            // otros rangos.
            $jornadaPl = $h->getPeriodoLectivo()?->getEffectiveJornadaTipo();
            if ($jornadaPl !== null) {
                $this->collectSlots($jornadaPl, $slotsByKey);
                $plId = $h->getPeriodoLectivo()?->getId();
                if ($plId !== null) {
                    if (!isset($slotsByPlId[$plId])) {
                        $slotsByPlId[$plId] = [];
                    }
                    $this->collectSlots($jornadaPl, $slotsByPlId[$plId]);
                }
            }

            // (2) Jornada efectiva del grupo (override o itinerario).
            // Solo va al plano `slots` legacy — el agrupado `slotsByPlId`
            // tiene que reflejar EXACTAMENTE la jornada del PL para que el
            // frontend no mezcle.
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

        // Fase E: materializamos el array de events desde el map por rootId.
        // El orden no importa (el frontend rebina por diaSemana × horaInicio
        // al renderizar la rejilla).
        $events = array_values($eventsByRootId);

        $slots = array_values($slotsByKey);
        usort($slots, fn ($a, $b) => strcmp($a['horaInicio'], $b['horaInicio']));

        // Convertir slotsByPlId al shape de salida: cada PL → array ordenado
        // por horaInicio (consistente con `slots` legacy).
        $slotsByPlIdOut = [];
        foreach ($slotsByPlId as $plId => $kvByKey) {
            $arr = array_values($kvByKey);
            usort($arr, fn ($a, $b) => strcmp($a['horaInicio'], $b['horaInicio']));
            $slotsByPlIdOut[(string) $plId] = $arr;
        }

        // Excepciones APROBADAS aplicables a los horarios del user (Fase B
        // del refactor intercambio-imparticiones, 2026-05-07). El frontend
        // las cruza con la fecha visible para overlay (CANCELADO oculta el
        // placement, SUSTITUCION cambia profe, INTERCAMBIO cambia profe +
        // imparticion, EVENTO_ESPECIAL marca la franja como no curricular).
        $excepciones = $this->loadExcepcionesAplicables($events, $entityManager);

        // Fase B.2 (2026-05-07): eventos sintéticos donde el user es el
        // profe asignado por una excepción aprobada (sustituto, override).
        // Sin esto, Joaquín cubriendo a Alberto no veía nada en SU /horarios.
        // Cada synthetic event lleva `_overrideDate` para que el frontend lo
        // muestre solo en esa fecha exacta, no como recurrente.
        $overrideAssignedEvents = $this->loadOverrideAssignedEvents($user, $entityManager);
        if (!empty($overrideAssignedEvents)) {
            $events = array_merge($events, $overrideAssignedEvents);
        }

        return [
            'events' => $events,
            'slots' => $slots,
            // Fase B fix 2026-05-12: el frontend con cascada SEMANA→PLANTILLA
            // elige `slotsByPlId[plId]` del PL aplicable a la fecha visible
            // para evitar mezcla de jornadas entre rangos lectivos y rango
            // "Tercera evaluación" (FP 2º) con jornada custom.
            'slotsByPlId' => $slotsByPlIdOut,
            'excepciones' => $excepciones,
        ];
    }

    /**
     * Para el user actual, devuelve eventos sintéticos correspondientes a
     * excepciones APROBADAS donde le toca cubrir/sustituir a otro profe en
     * una fecha concreta (futura o de hoy en adelante). El evento usa los
     * datos del horarioBase (día, hora, materia, grupo, aula) y marca
     * `_overrideDate` para que el frontend solo lo pinte en esa fecha.
     *
     * Cubre dos vías:
     *   - profeOverride = user (típico SUSTITUCION).
     *   - imparticionEfectiva.profesor = user (típico INTERCAMBIO).
     *
     * @return list<array<string,mixed>>
     */
    private function loadOverrideAssignedEvents(User $user, EntityManagerInterface $em): array
    {
        $hoy = (new \DateTimeImmutable())->format('Y-m-d');
        // Topic 1 (2026-05-07): incluir también las PENDIENTES_APROBACION
        // donde el user es destinatario, para que pueda rechazarlas desde
        // el modal del placement en /horarios. El frontend distingue por
        // `_overrideEstado` (pendiente vs aprobada): pinta estilo tenue
        // + tag "⏳ Pendiente" en pendientes; estilo normal en aprobadas.
        $dql = "SELECT eh
                FROM App\\Entity\\ExcepcionHorario eh
                JOIN eh.horarioBase hb
                JOIN hb.imparticion bi
                JOIN bi.materia bm
                JOIN bi.grupo bg
                LEFT JOIN eh.imparticionEfectiva ie
                LEFT JOIN ie.materia iem
                LEFT JOIN ie.grupo ieg
                WHERE eh.deleted = false
                  AND eh.estado IN (:estados)
                  AND eh.fechaConcreta >= :hoy
                  AND (eh.profeOverride = :user OR ie.profesor = :user)";

        $rows = $em->createQuery($dql)
            ->setParameter('estados', [
                \App\Entity\EstadoExcepcion::APROBADA,
                \App\Entity\EstadoExcepcion::PENDIENTE_APROBACION,
            ])
            ->setParameter('hoy', $hoy)
            ->setParameter('user', $user)
            ->getResult();

        $out = [];
        foreach ($rows as $eh) {
            /** @var \App\Entity\ExcepcionHorario $eh */
            $hb = $eh->getHorarioBase();
            if (!$hb) continue;

            // Si la excepción tiene imparticionEfectiva (intercambio), el evento
            // sintético usa la materia/grupo/profe de esa imp; si no, los del base.
            $impEf = $eh->getImparticionEfectiva();
            $imp = $impEf ?? $hb->getImparticion();
            if (!$imp) continue;
            $materia = $imp->getMateria();
            $grupo = $imp->getGrupo();
            // Profe del evento sintético: profeOverride si lo hay; si no, el de
            // imparticionEfectiva. Si ninguno, el del base como último recurso
            // (caso edge — no debería ocurrir si la query lo filtra).
            $profeFinal = $eh->getProfeOverride() ?? $imp->getProfesor();

            $profeNombre = 'Sin asignar';
            if ($profeFinal) {
                $profeNombre = trim(($profeFinal->getNombre() ?? '') . ' ' . ($profeFinal->getApellidos() ?? ''));
            }

            // Datos del titular del horario base (profe y materia originales),
            // para que el frontend pueda renderizar "Cubres a X · MAT→COBERT"
            // y desambiguar visualmente el sintético frente a la clase regular.
            $impBase = $hb->getImparticion();
            $titularBase = $impBase?->getProfesor();
            $materiaBase = $impBase?->getMateria();
            $titularBaseNombre = null;
            if ($titularBase) {
                $titularBaseNombre = trim(($titularBase->getNombre() ?? '') . ' ' . ($titularBase->getApellidos() ?? ''));
            }

            $fechaConcretaIso = $eh->getFechaConcreta()?->format('Y-m-d');

            $out[] = [
                // Prefijo `eh-` en el id para distinguir eventos sintéticos del
                // schedule normal y evitar colisiones si por casualidad un
                // horario tiene el mismo id numérico.
                'id' => 'eh-' . $eh->getId(),
                'diaSemana' => $hb->getDiaSemana(),
                'horaInicio' => $hb->getHoraInicio()->format('H:i'),
                'horaFin' => $hb->getHoraFin()->format('H:i'),
                'aula' => $hb->getAula(),
                'materia' => $materia?->getNombre() ?? '—',
                'moduloAbreviatura' => $materia?->getAbreviatura(),
                'moduloId' => $materia?->getId(),
                'grupo' => $grupo?->getNombre(),
                'grupoAbreviatura' => $grupo?->getAbreviatura(),
                'grupoCurso' => $grupo?->getCurso(),
                'grupoId' => $grupo?->getId(),
                'profesor' => $profeNombre,
                'imparticionId' => $imp->getId(),
                'periodoLectivoId' => null,
                'periodoLectivoTipo' => null,
                'periodoLectivoFechaInicio' => null,
                'periodoLectivoFechaFin' => null,
                // Marcadores específicos para el frontend (Fase B.2 + Topic 1).
                '_overrideDate' => $fechaConcretaIso,
                '_overrideAssigned' => true,
                '_overrideTipo' => $eh->getTipo()?->value,
                '_overrideMotivo' => $eh->getMotivo(),
                '_overrideExcepcionId' => $eh->getId(),
                '_overrideEstado' => $eh->getEstado()?->value,  // 'aprobada' | 'pendiente'
                // El frontend usa este flag para mostrar el botón "Rechazar"
                // en el modal del placement. true cuando user es el
                // destinatario semántico (profeOverride o imparticionEfectiva.profesor)
                // y la incidencia sigue pendiente.
                '_overrideCanReject' => $eh->getEstado() === \App\Entity\EstadoExcepcion::PENDIENTE_APROBACION,
                // Datos del titular del bloque base (intercambio/sustitución):
                // permiten al frontend mostrar "Cubres a {titular} · {matBase}→{matEfectiva}"
                // cuando la materia/profe efectiva difieren del base.
                '_overrideTitularNombre' => $titularBaseNombre,
                '_overrideMateriaBase' => $materiaBase?->getNombre(),
                '_overrideMateriaBaseAbrev' => $materiaBase?->getAbreviatura(),
            ];
        }
        return $out;
    }

    /**
     * Devuelve las excepciones APROBADAS cuyas `horarioBase` están en el
     * conjunto `events` del usuario. Forma DTO minimalista para que el
     * frontend pueda aplicar overlay sin más queries.
     *
     * @param array<int, array<string,mixed>> $events
     * @return list<array<string,mixed>>
     */
    private function loadExcepcionesAplicables(array $events, EntityManagerInterface $em): array
    {
        $horarioIds = array_values(array_unique(array_filter(array_map(
            fn (array $ev) => $ev['id'] ?? null,
            $events
        ))));

        if (empty($horarioIds)) {
            return [];
        }

        // Topic 1 (2026-05-07): incluir también las PENDIENTES_APROBACION
        // sobre los horarios del titular. El frontend pinta la casilla
        // regular del titular con marker "pendiente" (cinta de advertencia)
        // para que vea visualmente que tiene una solicitud sobre su clase
        // — independientemente de quién la haya solicitado.
        $dql = "SELECT eh, ie, iem, iep, po, ip
                FROM App\\Entity\\ExcepcionHorario eh
                LEFT JOIN eh.imparticionEfectiva ie
                LEFT JOIN ie.materia iem
                LEFT JOIN ie.profesor iep
                LEFT JOIN eh.profeOverride po
                LEFT JOIN eh.intercambioPareja ip
                WHERE eh.horarioBase IN (:ids)
                  AND eh.estado IN (:estados)
                  AND eh.deleted = false";

        $rows = $em->createQuery($dql)
            ->setParameter('ids', $horarioIds)
            ->setParameter('estados', [
                EstadoExcepcion::APROBADA,
                EstadoExcepcion::PENDIENTE_APROBACION,
            ])
            ->getResult();

        $out = [];
        foreach ($rows as $eh) {
            /** @var ExcepcionHorario $eh */
            $impEf = $eh->getImparticionEfectiva();
            $profeOv = $eh->getProfeOverride();

            $imparticionEfectivaDto = null;
            if ($impEf !== null) {
                $matEf = $impEf->getMateria();
                $proEf = $impEf->getProfesor();
                $imparticionEfectivaDto = [
                    'id'         => $impEf->getId(),
                    'materia'    => $matEf?->getNombre(),
                    'moduloId'   => $matEf?->getId(),
                    'moduloAbrv' => $matEf?->getAbreviatura(),
                    'profesor'   => $proEf
                        ? trim(($proEf->getNombre() ?? '') . ' ' . ($proEf->getApellidos() ?? ''))
                        : null,
                    'profesorId' => $proEf?->getId(),
                ];
            }

            $profeOverrideDto = null;
            if ($profeOv !== null) {
                $profeOverrideDto = [
                    'id'     => $profeOv->getId(),
                    'nombre' => trim(($profeOv->getNombre() ?? '') . ' ' . ($profeOv->getApellidos() ?? '')),
                ];
            }

            $out[] = [
                'id'                  => $eh->getId(),
                'horarioBaseId'       => $eh->getHorarioBase()?->getId(),
                'fechaConcreta'       => $eh->getFechaConcreta()?->format('Y-m-d'),
                'tipo'                => $eh->getTipo()?->value,
                'estado'              => $eh->getEstado()?->value,  // 'aprobada' | 'pendiente'
                'motivo'              => $eh->getMotivo(),
                'observaciones'       => $eh->getObservaciones(),
                'imparticionEfectiva' => $imparticionEfectivaDto,
                'profeOverride'       => $profeOverrideDto,
                'intercambioParejaId' => $eh->getIntercambioPareja()?->getId(),
            ];
        }
        return $out;
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
