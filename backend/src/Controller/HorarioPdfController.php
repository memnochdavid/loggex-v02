<?php

namespace App\Controller;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\JornadaTipo;
use App\Entity\Matricula;
use App\Entity\Modalidad;
use App\Entity\PeriodoLectivo;
use App\Entity\TipoExcepcion;
use App\Entity\TipoTramo;
use App\Entity\User;
use App\Service\PdfBranding;
use App\Service\PdfGenerator;
use App\Service\PeriodoLectivoResolver;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

class HorarioPdfController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PdfGenerator $pdfGenerator,
        private readonly TranslatorInterface $translator,
        private readonly PdfBranding $branding,
        private readonly PeriodoLectivoResolver $plResolver
    ) {
    }

    /**
     * Exporta a PDF el horario del usuario autenticado (alumno o profesor).
     * Reutiliza la misma fuente lógica que /api/my-schedule.
     */
    #[Route('/api/v1/informes/horario/me', name: 'api_horario_pdf_me', methods: ['GET'])]
    public function horarioPersonal(Request $request): Response
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        // Refactor modelo semanal (Fase D 2026-05-06): aceptamos `?fecha`
        // para que el PDF refleje la SEMANA aplicable a esa fecha (cascada
        // SEMANA-cubre-fecha → PLANTILLA via PeriodoLectivoResolver). Default
        // = hoy. Sin esto el PDF mezclaba placements de PLANTILLA + todas
        // las SEMANAs del año.
        $fechaParam = $request->query->get('fecha');
        $fecha = null;
        if ($fechaParam) {
            try { $fecha = new \DateTimeImmutable($fechaParam); }
            catch (\Exception) { $fecha = null; }
        }
        $fecha = $fecha ?? new \DateTimeImmutable();

        $horarios = $this->loadHorariosForUser($user, $fecha);
        if (empty($horarios)) {
            return $this->json(['message' => 'No tienes horarios asignados'], 404);
        }

        $centro = $user->getCentro();
        if (!$centro) {
            return $this->json(['message' => 'Usuario sin centro asignado'], 422);
        }

        $lang = substr($request->query->get('lang', 'es'), 0, 2);
        $jornadaPersonal = null;
        if (!empty($horarios)) {
            $jornadaPersonal = $horarios[0]->getPeriodoLectivo()?->getEffectiveJornadaTipo();
        }
        $context = $this->buildScheduleContext(
            centro: $centro,
            grupo: null,
            usuarioPersonal: $user,
            horarios: $horarios,
            lang: $lang,
            fecha: $fecha,
            jornada: $jornadaPersonal,
        );

        $pdf = $this->pdfGenerator->generateFromTwig('pdf/horario.html.twig', $context, 'A4', 'landscape');
        $filename = sprintf('horario_%s_%s.pdf',
            $this->slugify($user->getApellidos() ?? ''),
            $this->slugify($user->getNombre() ?? '')
        );

        return new Response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $filename),
        ]);
    }

    /**
     * Exporta a PDF el horario completo de un grupo.
     * Acceso: admin/superadmin, profesor que imparta en el grupo, o alumno matriculado.
     */
    #[Route('/api/v1/informes/horario/grupo/{grupoId}', name: 'api_horario_pdf_grupo', methods: ['GET'])]
    public function horarioGrupo(int $grupoId, Request $request): Response
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $grupo = $this->em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        if (!$this->canAccessGrupo($user, $grupo)) {
            throw $this->createAccessDeniedException('No tienes acceso al horario de este grupo.');
        }

        $horarios = $this->loadHorariosForGrupo($grupo);
        $centro = $grupo->getItinerario()?->getCentro();
        if (!$centro) {
            return $this->json(['message' => 'El grupo no tiene centro asociado'], 422);
        }

        $lang = substr($request->query->get('lang', 'es'), 0, 2);

        // Multi-página por PeriodoLectivo: agrupamos los horarios por PL y
        // cargamos también los PLs del grupo SIN horarios (para que el PDF
        // muestre cada rango — aunque vacío — como página independiente).
        $byPl = [];   // plId → ['pl' => ?PL, 'horarios' => Horario[]]
        foreach ($horarios as $h) {
            $pl = $h->getPeriodoLectivo();
            $plId = $pl?->getId() ?? 0;
            if (!isset($byPl[$plId])) {
                $byPl[$plId] = ['pl' => $pl, 'horarios' => []];
            }
            $byPl[$plId]['horarios'][] = $h;
        }
        $allPls = $this->em->getRepository(PeriodoLectivo::class)->findBy(
            ['grupo' => $grupo, 'deleted' => false],
            ['fechaInicio' => 'ASC']
        );
        foreach ($allPls as $pl) {
            if (!isset($byPl[$pl->getId()])) {
                $byPl[$pl->getId()] = ['pl' => $pl, 'horarios' => []];
            }
        }
        // Ordenar entries por fechaInicio del PL (los sin PL al final).
        uasort($byPl, function ($a, $b) {
            $fa = $a['pl']?->getFechaInicio()?->format('Y-m-d') ?? '9999-12-31';
            $fb = $b['pl']?->getFechaInicio()?->format('Y-m-d') ?? '9999-12-31';
            return strcmp($fa, $fb);
        });

        // Construir array `paginas`: una entrada por PL con su parrilla.
        $paginas = [];
        foreach ($byPl as $entry) {
            $pl = $entry['pl'];
            $ctxPl = $this->buildScheduleContext(
                centro: $centro,
                grupo: $grupo,
                usuarioPersonal: null,
                horarios: $entry['horarios'],
                lang: $lang,
                jornada: $pl?->getEffectiveJornadaTipo()
            );
            $paginas[] = [
                'plNombre' => $pl?->getNombre(),
                'plFechaInicio' => $pl?->getFechaInicio()?->format('d/m/Y'),
                'plFechaFin' => $pl?->getFechaFin()?->format('d/m/Y'),
                'slotsManana' => $ctxPl['slotsManana'],
                'slotsTarde' => $ctxPl['slotsTarde'],
                'matriz' => $ctxPl['matriz'],
            ];
        }

        // Context base (header común a todas las páginas).
        $context = $this->buildScheduleContext(
            centro: $centro,
            grupo: $grupo,
            usuarioPersonal: null,
            horarios: [],   // base sin parrilla; las parrillas van por página
            lang: $lang
        );
        $context['paginas'] = $paginas;
        // Quitamos los campos por-página del top-level (ahora viven en paginas[]).
        unset($context['slotsManana'], $context['slotsTarde'], $context['matriz']);

        // Fase 6 modalidad: anexo "Otras horas curriculares" tras las páginas
        // por rango. Recoge imparticiones del grupo cuya modalidad efectiva
        // no es PRESENCIAL (FCT, NO_REGULAR, AUTONOMA) — no van a la grilla
        // pero cuentan al currículo total RD del título.
        $context['otrasHoras'] = $this->loadOtrasHorasCurriculares($grupo);

        $pdf = $this->pdfGenerator->generateFromTwig('pdf/horario.html.twig', $context, 'A4', 'landscape');
        $filename = sprintf('horario_%s_%s.pdf',
            $this->slugify($grupo->getNombre() ?? 'grupo'),
            $this->slugify($grupo->getAnioEscolar() ?? '')
        );

        return new Response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $filename),
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    /** @return Horario[] */
    private function loadHorariosForUser(User $user, ?\DateTimeInterface $fecha = null): array
    {
        $roles = $user->getRoles();
        $userId = $user->getId();
        $horarios = [];

        if (in_array('ROLE_ALUMNO', $roles, true)) {
            $dql = "SELECT h, i, m, g, p
                    FROM App\\Entity\\Horario h
                    JOIN h.imparticion i
                    JOIN i.materia m
                    JOIN i.grupo g
                    JOIN g.matriculas mat
                    LEFT JOIN i.profesor p
                    WHERE mat.alumno = :userId AND h.deleted = false";
            $horarios = array_merge(
                $horarios,
                $this->em->createQuery($dql)->setParameter('userId', $userId)->getResult()
            );
        }

        if (
            in_array('ROLE_PROFESOR', $roles, true)
            || in_array('ROLE_ADMIN', $roles, true)
            || in_array('ROLE_SUPERADMIN', $roles, true)
        ) {
            $dql = "SELECT h, i, m, g, p
                    FROM App\\Entity\\Horario h
                    JOIN h.imparticion i
                    JOIN i.materia m
                    JOIN i.grupo g
                    LEFT JOIN i.profesor p
                    WHERE i.profesor = :userId AND h.deleted = false";
            $extra = $this->em->createQuery($dql)->setParameter('userId', $userId)->getResult();
            $idsExistentes = array_map(fn(Horario $h) => $h->getId(), $horarios);
            foreach ($extra as $rp) {
                if (!in_array($rp->getId(), $idsExistentes, true)) {
                    $horarios[] = $rp;
                }
            }
        }

        // Filtro modelo semanal: por cada grupo distinto, resolver el PL
        // aplicable a la fecha (cascada SEMANA-cubre-fecha → PLANTILLA via
        // PeriodoLectivoResolver) y conservar SOLO los horarios de ese PL.
        // Sin esto, un grupo con PLANTILLA + N SEMANAs metería todos los
        // placements en el PDF y aparecerían duplicados en cada slot.
        if ($fecha !== null) {
            $plAplicablePorGrupo = [];  // grupoId → plId (o null si no hay PL aplicable)
            $horariosFiltrados = [];
            foreach ($horarios as $h) {
                $grupo = $h->getImparticion()?->getGrupo();
                if (!$grupo) { $horariosFiltrados[] = $h; continue; }
                $gId = $grupo->getId();
                if (!array_key_exists($gId, $plAplicablePorGrupo)) {
                    $plAplicable = $this->plResolver->resolveActive($grupo, $fecha);
                    $plAplicablePorGrupo[$gId] = $plAplicable?->getId();
                }
                $plIdAplicable = $plAplicablePorGrupo[$gId];
                $plH = $h->getPeriodoLectivo()?->getId();
                // Si no hay PL aplicable, mostramos los horarios sin filtrar
                // (mejor mostrar de más que vacío). Si sí hay, filtramos.
                if ($plIdAplicable === null) {
                    $horariosFiltrados[] = $h;
                } elseif ($plH === $plIdAplicable) {
                    $horariosFiltrados[] = $h;
                }
                // else: descartado (placement de otro PL del grupo).
            }
            $horarios = $horariosFiltrados;
        }

        return $horarios;
    }

    /**
     * Imparticiones del grupo cuya modalidad efectiva NO es PRESENCIAL.
     * FCT/NO_REGULAR/AUTONOMA cuentan al currículo total LOMLOE pero no
     * van a la rejilla de horario (Fase 3+4 modalidad). El PDF las expone
     * como anexo informativo al final.
     *
     * Ordena por modalidad y luego por nombre de materia para que el bloque
     * agrupe FCT primero, luego NO_REGULAR, luego AUTONOMA.
     *
     * @return list<array{materia: string, modalidad: string, modalidadLabelKey: string, horasTotales: ?int, profesor: ?string}>
     */
    private function loadOtrasHorasCurriculares(Grupo $grupo): array
    {
        /** @var Imparticion[] $impsAll */
        $impsAll = $this->em->createQuery(
            "SELECT i, m, p FROM App\\Entity\\Imparticion i
             JOIN i.materia m
             LEFT JOIN i.profesor p
             WHERE i.grupo = :grupoId AND i.deleted = false AND m.deleted = false"
        )->setParameter('grupoId', $grupo->getId())->getResult();

        $rows = [];
        foreach ($impsAll as $imp) {
            $modalidad = $imp->getEffectiveModalidad();
            if ($modalidad === Modalidad::PRESENCIAL) {
                continue;
            }
            $materia = $imp->getMateria();
            if ($materia === null) {
                continue;
            }
            $profesor = $imp->getProfesor();
            $profesorLabel = $profesor
                ? trim(($profesor->getNombre() ?? '') . ' ' . ($profesor->getApellidos() ?? ''))
                : null;
            $rows[] = [
                'materia' => $materia->getNombre() ?? '',
                'modalidad' => $modalidad->value,
                'modalidadLabelKey' => match ($modalidad) {
                    Modalidad::FCT        => 'modality_fct',
                    Modalidad::NO_REGULAR => 'modality_no_regular',
                    Modalidad::AUTONOMA   => 'modality_autonoma',
                    default               => 'modality_presencial',
                },
                'horasTotales' => $materia->getHorasTotales(),
                'profesor' => $profesorLabel !== '' ? $profesorLabel : null,
            ];
        }

        // Orden: FCT → NO_REGULAR → AUTONOMA, luego alfabético por materia.
        $weight = [Modalidad::FCT->value => 0, Modalidad::NO_REGULAR->value => 1, Modalidad::AUTONOMA->value => 2];
        usort($rows, function ($a, $b) use ($weight) {
            $wa = $weight[$a['modalidad']] ?? 99;
            $wb = $weight[$b['modalidad']] ?? 99;
            if ($wa !== $wb) return $wa <=> $wb;
            return strcmp($a['materia'], $b['materia']);
        });

        return $rows;
    }

    /** @return Horario[] */
    private function loadHorariosForGrupo(Grupo $grupo): array
    {
        $dql = "SELECT h, i, m, g, p
                FROM App\\Entity\\Horario h
                JOIN h.imparticion i
                JOIN i.materia m
                JOIN i.grupo g
                LEFT JOIN i.profesor p
                WHERE g.id = :grupoId AND h.deleted = false";
        return $this->em->createQuery($dql)->setParameter('grupoId', $grupo->getId())->getResult();
    }

    private function canAccessGrupo(User $user, Grupo $grupo): bool
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }
        $centroGrupo = $grupo->getItinerario()?->getCentro();
        $mismoCentro = $centroGrupo && $user->getCentro()
            && $centroGrupo->getId() === $user->getCentro()->getId();

        if ($this->isGranted('ROLE_ADMIN') && $mismoCentro) {
            return true;
        }

        // Profesor que imparta en el grupo
        if ($this->isGranted('ROLE_PROFESOR')) {
            $count = (int) $this->em->createQuery(
                "SELECT COUNT(i.id) FROM App\\Entity\\Imparticion i
                 WHERE i.grupo = :g AND i.profesor = :u AND i.deleted = false"
            )->setParameter('g', $grupo)->setParameter('u', $user)->getSingleScalarResult();
            if ($count > 0) {
                return true;
            }
        }

        // Alumno matriculado
        if ($this->isGranted('ROLE_ALUMNO')) {
            $matricula = $this->em->getRepository(Matricula::class)->findOneBy([
                'grupo' => $grupo,
                'alumno' => $user,
            ]);
            if ($matricula) {
                return true;
            }
        }

        return false;
    }

    /**
     * Construye el contexto Twig: cabecera + matriz semanal de eventos.
     *
     * @param Horario[] $horarios
     */
    private function buildScheduleContext(
        $centro,
        ?Grupo $grupo,
        ?User $usuarioPersonal,
        array $horarios,
        string $lang,
        ?JornadaTipo $jornada = null,
        ?\DateTimeInterface $fecha = null
    ): array {
        // Overlay de excepciones APROBADAS para la fecha concreta del PDF
        // (Fase B intercambio-imparticiones, 2026-05-07). Solo aplica al PDF
        // personal — el PDF de grupo multi-página no tiene fecha específica.
        $excepcionesByHorarioId = [];
        if ($fecha !== null && !empty($horarios)) {
            $horarioIds = array_filter(array_map(fn(Horario $h) => $h->getId(), $horarios));
            if (!empty($horarioIds)) {
                $dql = "SELECT eh, ie, iem, iep, po
                        FROM App\\Entity\\ExcepcionHorario eh
                        LEFT JOIN eh.imparticionEfectiva ie
                        LEFT JOIN ie.materia iem
                        LEFT JOIN ie.profesor iep
                        LEFT JOIN eh.profeOverride po
                        WHERE eh.horarioBase IN (:ids)
                          AND eh.fechaConcreta = :fecha
                          AND eh.estado = :estado
                          AND eh.deleted = false";
                $rows = $this->em->createQuery($dql)
                    ->setParameter('ids', $horarioIds)
                    ->setParameter('fecha', $fecha->format('Y-m-d'))
                    ->setParameter('estado', EstadoExcepcion::APROBADA)
                    ->getResult();
                foreach ($rows as $eh) {
                    /** @var ExcepcionHorario $eh */
                    $hbId = $eh->getHorarioBase()?->getId();
                    if ($hbId !== null) {
                        $excepcionesByHorarioId[$hbId] = $eh;
                    }
                }
            }
        }

        // Slots base: si tenemos jornada explícita (caso PL), usar sus tramos
        // SLOT (sin recreos). Si no, derivar del propio set de horarios reales
        // (modo legacy). La jornada da granularidad fija (30min) y permite
        // que los bloques 60-120min se rendericen con rowspan correctamente
        // aunque distintos días tengan bloques desalineados.
        $slots = [];
        if ($jornada !== null) {
            $tramos = $jornada->getTramos()->toArray();
            usort($tramos, fn ($a, $b) => $a->getHoraInicio() <=> $b->getHoraInicio());
            foreach ($tramos as $t) {
                if ($t->getTipo() !== TipoTramo::SLOT) continue;
                $hi = $t->getHoraInicio()?->format('H:i');
                $hf = $t->getHoraFin()?->format('H:i');
                if (!$hi || !$hf) continue;
                $slots[] = ['key' => $hi . '-' . $hf, 'horaInicio' => $hi, 'horaFin' => $hf];
            }
        } else {
            $slotsMap = [];
            foreach ($horarios as $h) {
                $hi = $h->getHoraInicio()?->format('H:i');
                $hf = $h->getHoraFin()?->format('H:i');
                if (!$hi || !$hf) continue;
                $key = $hi . '-' . $hf;
                if (!isset($slotsMap[$key])) {
                    $slotsMap[$key] = ['key' => $key, 'horaInicio' => $hi, 'horaFin' => $hf];
                }
            }
            uasort($slotsMap, fn($a, $b) => strcmp($a['horaInicio'], $b['horaInicio']));
            $slots = array_values($slotsMap);
        }

        // Tramos contiguos (Fase B fix 2026-05-12): agrupar slots cuyos
        // horaFin === slot.horaInicio del siguiente. Réplica del modelo
        // del web (TimeTable.jsx): la columna "Hora" muestra el rango del
        // tramo entero (p.ej. "08:30-10:30") con rowspan = N sub-slots,
        // en lugar de N filas separadas con su sub-rango (08:30-09:00,
        // 09:00-09:30, …). Sin agrupar, el PDF salía con 11 filas donde
        // el web tiene 5 — visual completamente distinto.
        $n = count($slots);
        $i = 0;
        while ($i < $n) {
            $tramoStartIdx = $i;
            $tramoStart = $slots[$i]['horaInicio'];
            $j = $i;
            while ($j + 1 < $n && $slots[$j]['horaFin'] === $slots[$j + 1]['horaInicio']) {
                $j++;
            }
            $tramoEnd = $slots[$j]['horaFin'];
            $span = $j - $i + 1;
            for ($k = $i; $k <= $j; $k++) {
                $slots[$k]['tramoStart'] = $tramoStart;
                $slots[$k]['tramoEnd'] = $tramoEnd;
                $slots[$k]['tramoSpan'] = $k === $tramoStartIdx ? $span : 0;
                $slots[$k]['isTramoStart'] = $k === $tramoStartIdx;
            }
            $i = $j + 1;
        }

        // Construir lista de TRAMOS: un row por tramo contiguo (Fase B fix
        // 2026-05-12). Réplica simplificada del modelo del web: cada tramo
        // = una fila del PDF; los placements del tramo se renderizan
        // apilados en la celda del día. Sin rowspan en celdas, solo
        // anidación visual. Esto elimina los bugs de Dompdf con filas
        // vacías cubiertas por rowspans (Cellmap.php "Undefined array key").
        $tramos = [];
        $i = 0;
        $n = count($slots);
        $hmToMin = function (string $hm): int {
            [$h, $m] = explode(':', $hm);
            return ((int) $h) * 60 + (int) $m;
        };
        while ($i < $n) {
            $tramoStart = $slots[$i]['horaInicio'];
            $j = $i;
            while ($j + 1 < $n && $slots[$j]['horaFin'] === $slots[$j + 1]['horaInicio']) {
                $j++;
            }
            $tramoEnd = $slots[$j]['horaFin'];
            $tramos[] = [
                'key' => $tramoStart . '-' . $tramoEnd,
                'horaInicio' => $tramoStart,
                'horaFin' => $tramoEnd,
                // Duración total del tramo en minutos (para el cálculo
                // proporcional de min-height en el PDF — si una celda tiene
                // UN solo placement, se expande a esta duración para no
                // dejar hueco; si tiene varios, cada uno se reparte).
                'durMin' => $hmToMin($tramoEnd) - $hmToMin($tramoStart),
            ];
            $i = $j + 1;
        }

        // Particionado mañana/tarde: corte en 14:30 (sobre tramos)
        $tramosManana = [];
        $tramosTarde = [];
        foreach ($tramos as $tr) {
            if (strcmp($tr['horaInicio'], '14:30') < 0) {
                $tramosManana[] = $tr;
            } else {
                $tramosTarde[] = $tr;
            }
        }

        // Matriz [tramoKey][diaSemana] => [evento1, evento2, ...]
        // Cada placement se asigna al tramo que lo CONTIENE temporalmente.
        // Si un tramo del día tiene varios placements (caso típico: Vie
        // 08:30-10:30 con BD 08:30-09:30 + LM 09:30-10:30), se apilan en
        // la celda en orden cronológico.
        $matriz = [];
        foreach ($horarios as $h) {
            $hi = $h->getHoraInicio()?->format('H:i');
            $hf = $h->getHoraFin()?->format('H:i');
            $dia = $h->getDiaSemana();
            if (!$hi || !$hf || !$dia) continue;
            $imp = $h->getImparticion();
            $materia = $imp?->getMateria();
            $profesor = $imp?->getProfesor();
            $grupoEv = $imp?->getGrupo();

            // Overlay excepción aprobada para la fecha del PDF.
            $excepcion = $excepcionesByHorarioId[$h->getId()] ?? null;
            $excepcionTipo = null;
            $excepcionMotivo = null;
            if ($excepcion !== null) {
                $excepcionTipo = $excepcion->getTipo()?->value;
                $excepcionMotivo = $excepcion->getMotivo();
                if ($excepcion->getTipo() === TipoExcepcion::CANCELADO) {
                    continue;
                }
                if ($excepcion->getTipo() === TipoExcepcion::INTERCAMBIO && $excepcion->getImparticionEfectiva() !== null) {
                    $imp = $excepcion->getImparticionEfectiva();
                    $materia = $imp->getMateria();
                    $profesor = $imp->getProfesor();
                    $grupoEv = $imp->getGrupo();
                } elseif ($excepcion->getTipo() === TipoExcepcion::SUSTITUCION && $excepcion->getProfeOverride() !== null) {
                    $profesor = $excepcion->getProfeOverride();
                } elseif ($excepcion->getTipo() === TipoExcepcion::EVENTO_ESPECIAL) {
                    $materia = null;
                    if ($excepcion->getProfeOverride() !== null) {
                        $profesor = $excepcion->getProfeOverride();
                    }
                }
            }

            $profNombre = $profesor
                ? trim(($profesor->getNombre() ?? '') . ' ' . ($profesor->getApellidos() ?? ''))
                : null;
            $materiaLabel = $materia?->getNombre() ?? '—';
            if ($excepcionTipo === 'evento_especial') {
                $materiaLabel = $excepcionMotivo ?: 'Evento especial';
            }

            // Encontrar el tramo que contiene este placement (horaInicio
            // dentro del rango [tramoStart, tramoEnd]).
            $tramoKey = null;
            foreach ($tramos as $tr) {
                if ($tr['horaInicio'] <= $hi && $tr['horaFin'] >= $hf) {
                    $tramoKey = $tr['key'];
                    break;
                }
            }
            if ($tramoKey === null) continue;  // placement fuera de tramos (raro)

            if (!isset($matriz[$tramoKey])) {
                $matriz[$tramoKey] = [];
            }
            if (!isset($matriz[$tramoKey][$dia])) {
                $matriz[$tramoKey][$dia] = [];
            }
            $matriz[$tramoKey][$dia][] = [
                'materia' => $materiaLabel,
                'moduloId' => $materia?->getId() ?? 0,
                'profesor' => $profNombre,
                'aula' => $h->getAula(),
                'grupoNombre' => $grupoEv?->getNombre(),
                'grupoAbreviatura' => $grupoEv?->getAbreviatura(),
                'grupoCurso' => $grupoEv?->getCurso(),
                'color' => $this->colorForModule($materia?->getId() ?? 0),
                'horaInicio' => $hi,
                'horaFin' => $hf,
                'excepcionTipo' => $excepcionTipo,
                'excepcionMotivo' => $excepcionMotivo,
            ];
        }
        // Ordenar eventos dentro de cada celda por horaInicio y MERGEAR
        // consecutivos de la misma imparticion (Fase B fix 2026-05-12).
        // Caso típico: Vie 10:50-12:50 con 4 placements de Programación de
        // 30min cada uno → se muestran como UN solo bloque continuo de
        // 10:50-12:50 en lugar de 4 cards repetidas con el mismo nombre.
        foreach ($matriz as &$rowDias) {
            foreach ($rowDias as &$evs) {
                usort($evs, fn($a, $b) => strcmp($a['horaInicio'], $b['horaInicio']));
                // Merge: si dos eventos consecutivos tienen el mismo
                // moduloId + profesor + aula, fusionar en uno solo
                // extendiendo el horaFin del anterior. Comparamos por la
                // tripleta para tolerar imparticiones distintas con la
                // misma materia (raro pero posible).
                $merged = [];
                foreach ($evs as $ev) {
                    $last = $merged ? $merged[count($merged) - 1] : null;
                    if ($last !== null
                        && $last['moduloId'] === $ev['moduloId']
                        && $last['profesor'] === $ev['profesor']
                        && $last['aula'] === $ev['aula']
                        && $last['horaFin'] === $ev['horaInicio']
                    ) {
                        $merged[count($merged) - 1]['horaFin'] = $ev['horaFin'];
                    } else {
                        $merged[] = $ev;
                    }
                }
                $evs = $merged;
            }
            unset($evs);
        }
        unset($rowDias);

        // Alias compatibles con el resto del código y los callers (el PDF
        // de grupo multi-página accede `slotsManana`/`slotsTarde`).
        $slotsManana = $tramosManana;
        $slotsTarde = $tramosTarde;

        $diasSemana = [1, 2, 3, 4, 5];

        // Subtítulo: "Mi horario" o "Grupo X · Ciclo Y"
        $isPersonal = $usuarioPersonal !== null;
        $subjectLine = null;
        $contextLine = null;
        if ($isPersonal) {
            $subjectLine = trim(($usuarioPersonal->getNombre() ?? '') . ' ' . ($usuarioPersonal->getApellidos() ?? ''));
            $contextLine = null;
        } elseif ($grupo) {
            $subjectLine = $grupo->getNombre();
            $contextLine = $grupo->getItinerario()?->getNombre();
        }

        $t = fn(string $key) => $this->translator->trans($key, [], 'horario', $lang);

        return [
            'centro' => [
                'nombre' => $centro->getNombre(),
            ],
            'logoUrl' => $this->branding->getLogoTmpPath($centro, 'horario_logo'),
            'nameTitleConfig' => $this->branding->getNameTitleConfig($centro),
            'isPersonal' => $isPersonal,
            'subjectLine' => $subjectLine,
            'contextLine' => $contextLine,
            'anioEscolar' => $grupo?->getAnioEscolar(),
            'fechaEmision' => (new \DateTime())->format('d/m/Y'),
            'diasSemana' => $diasSemana,
            'diasLabels' => [
                1 => $t('horario.day_1'),
                2 => $t('horario.day_2'),
                3 => $t('horario.day_3'),
                4 => $t('horario.day_4'),
                5 => $t('horario.day_5'),
            ],
            'slotsManana' => $slotsManana,
            'slotsTarde' => $slotsTarde,
            'matriz' => $matriz,
            'i18n' => [
                'title' => $t('horario.title'),
                'titlePersonal' => $t('horario.title_personal'),
                'titleGroup' => $t('horario.title_group'),
                'morning' => $t('horario.morning'),
                'afternoon' => $t('horario.afternoon'),
                'classroom' => $t('horario.classroom'),
                'teacher' => $t('horario.teacher'),
                'group' => $t('horario.group'),
                'date' => $t('horario.date'),
                'time' => $t('horario.time'),
                'noClasses' => $t('horario.no_classes'),
                'otherHoursTitle' => $t('horario.other_hours_title'),
                'otherHoursSubtitle' => $t('horario.other_hours_subtitle'),
                'otherHoursSubject' => $t('horario.other_hours_subject'),
                'otherHoursModality' => $t('horario.other_hours_modality'),
                'otherHoursHours' => $t('horario.other_hours_hours'),
                'otherHoursTeacher' => $t('horario.other_hours_teacher'),
                'modalityFct' => $t('horario.modality_fct'),
                'modalityNoRegular' => $t('horario.modality_no_regular'),
                'modalityAutonoma' => $t('horario.modality_autonoma'),
                'noHoursSet' => $t('horario.no_hours_set'),
            ],
        ];
    }

    /**
     * Color determinístico por moduloId, en formato hex (paridad con TimeTable.jsx).
     *
     * Se calcula primero en HSL (hue = moduloId * 47 mod 360, s=55%, l=48%) y se
     * convierte a RGB hex porque Dompdf no procesa `hsl()` de forma fiable.
     */
    private function colorForModule(int $moduloId): string
    {
        $h = (($moduloId * 47) % 360) / 360.0;
        $s = 0.55;
        $l = 0.48;

        if ($s === 0.0) {
            $r = $g = $b = $l;
        } else {
            $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
            $p = 2 * $l - $q;
            $r = $this->hueToRgb($p, $q, $h + 1 / 3);
            $g = $this->hueToRgb($p, $q, $h);
            $b = $this->hueToRgb($p, $q, $h - 1 / 3);
        }

        return sprintf('#%02x%02x%02x',
            (int) round($r * 255),
            (int) round($g * 255),
            (int) round($b * 255)
        );
    }

    private function hueToRgb(float $p, float $q, float $t): float
    {
        if ($t < 0) $t += 1;
        if ($t > 1) $t -= 1;
        if ($t < 1 / 6) return $p + ($q - $p) * 6 * $t;
        if ($t < 1 / 2) return $q;
        if ($t < 2 / 3) return $p + ($q - $p) * (2 / 3 - $t) * 6;
        return $p;
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        $text = strtr($text, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'ñ' => 'n', 'ü' => 'u', 'à' => 'a', 'è' => 'e', 'ò' => 'o',
            'ç' => 'c', 'ä' => 'a', 'ö' => 'o',
        ]);
        $text = preg_replace('/[^a-z0-9]+/', '_', $text);
        return trim($text, '_') ?: 'horario';
    }
}
