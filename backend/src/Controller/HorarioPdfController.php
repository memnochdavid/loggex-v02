<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Matricula;
use App\Entity\User;
use App\Service\PdfBranding;
use App\Service\PdfGenerator;
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
        private readonly PdfBranding $branding
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

        $horarios = $this->loadHorariosForUser($user);
        if (empty($horarios)) {
            return $this->json(['message' => 'No tienes horarios asignados'], 404);
        }

        $centro = $user->getCentro();
        if (!$centro) {
            return $this->json(['message' => 'Usuario sin centro asignado'], 422);
        }

        $lang = substr($request->query->get('lang', 'es'), 0, 2);
        $context = $this->buildScheduleContext(
            centro: $centro,
            grupo: null,
            usuarioPersonal: $user,
            horarios: $horarios,
            lang: $lang
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
        $context = $this->buildScheduleContext(
            centro: $centro,
            grupo: $grupo,
            usuarioPersonal: null,
            horarios: $horarios,
            lang: $lang
        );

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
    private function loadHorariosForUser(User $user): array
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

        return $horarios;
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
        string $lang
    ): array {
        // Slots únicos derivados de los horarios reales (orden por hora_inicio)
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

        // Particionado mañana/tarde: corte en 14:30
        $slotsManana = [];
        $slotsTarde = [];
        foreach ($slots as $s) {
            if (strcmp($s['horaInicio'], '14:30') < 0) {
                $slotsManana[] = $s;
            } else {
                $slotsTarde[] = $s;
            }
        }

        // Matriz [slotKey][diaSemana] => evento
        $matriz = [];
        foreach ($horarios as $h) {
            $hi = $h->getHoraInicio()?->format('H:i');
            $hf = $h->getHoraFin()?->format('H:i');
            $dia = $h->getDiaSemana();
            if (!$hi || !$hf || !$dia) continue;
            $key = $hi . '-' . $hf;
            $imp = $h->getImparticion();
            $materia = $imp?->getMateria();
            $profesor = $imp?->getProfesor();
            $grupoEv = $imp?->getGrupo();

            $profNombre = $profesor
                ? trim(($profesor->getNombre() ?? '') . ' ' . ($profesor->getApellidos() ?? ''))
                : null;

            $matriz[$key][$dia] = [
                'materia' => $materia?->getNombre() ?? '—',
                'moduloId' => $materia?->getId() ?? 0,
                'profesor' => $profNombre,
                'aula' => $h->getAula(),
                'grupoNombre' => $grupoEv?->getNombre(),
                'grupoAbreviatura' => $grupoEv?->getAbreviatura(),
                'color' => $this->colorForModule($materia?->getId() ?? 0),
            ];
        }

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
