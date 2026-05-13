<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\PeriodoEvaluativo;
use App\Entity\User;
use App\Repository\PonderacionImparticionRepository;
use App\Service\PdfBranding;
use App\Service\PdfGenerator;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

class BoletinController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PonderacionImparticionRepository $ponderacionRepo,
        private readonly PdfGenerator $pdfGenerator,
        private readonly TranslatorInterface $translator,
        private readonly FilesystemOperator $storage,
        private readonly PdfBranding $branding
    ) {
    }

    /**
     * Boletín individual: muestra TODOS los periodos del grupo en columnas.
     * El periodoId se usa para identificar el grupo y verificar acceso.
     */
    #[Route('/api/v1/informes/boletin/{alumnoId}/{periodoId}', name: 'api_boletin_individual', methods: ['GET'])]
    public function boletinIndividual(int $alumnoId, int $periodoId, Request $request): Response
    {
        $alumno = $this->em->getRepository(User::class)->find($alumnoId);
        if (!$alumno) {
            return $this->json(['message' => 'Alumno no encontrado'], 404);
        }

        $periodo = $this->em->getRepository(PeriodoEvaluativo::class)->find($periodoId);
        if (!$periodo) {
            return $this->json(['message' => 'Periodo no encontrado'], 404);
        }

        $this->verificarAccesoBoletin($alumno);

        $grupo = $periodo->getGrupo();
        $centro = $grupo->getItinerario()->getCentro();
        // Acumulativo: solo periodos cuya fecha_fin <= fecha_fin del seleccionado
        $periodos = $this->getPeriodosOrdenados($grupo, $periodo->getFechaFin());

        $lang = $request->query->get('lang', 'es');
        $boletinData = $this->generarDatosBoletin($alumno, $grupo, $periodos, $periodo->getFechaFin());
        $context = $this->buildTemplateContext($centro, $grupo, $periodos, [$boletinData], $lang, $periodo);

        $pdf = $this->pdfGenerator->generateFromTwig('pdf/boletin.html.twig', $context);
        $filename = sprintf('boletin_%s_%s.pdf',
            $this->slugify($alumno->getApellidos()),
            $this->slugify($alumno->getNombre())
        );

        return new Response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $filename),
        ]);
    }

    /**
     * Boletines masivos de todos los alumnos de un grupo.
     */
    #[Route('/api/v1/informes/boletines/{grupoId}/{periodoId}', name: 'api_boletines_masivos', methods: ['GET'])]
    public function boletinesMasivos(int $grupoId, int $periodoId, Request $request): Response
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            throw $this->createAccessDeniedException();
        }

        $grupo = $this->em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $periodoSel = $this->em->getRepository(PeriodoEvaluativo::class)->find($periodoId);
        if (!$periodoSel) {
            return $this->json(['message' => 'Periodo no encontrado'], 404);
        }
        $periodos = $this->getPeriodosOrdenados($grupo, $periodoSel->getFechaFin());
        $centro = $grupo->getItinerario()->getCentro();

        $matriculas = $this->em->getRepository(Matricula::class)->findBy(['grupo' => $grupo]);
        $alumnos = array_map(fn($m) => $m->getAlumno(), $matriculas);
        usort($alumnos, fn($a, $b) => strcmp($a->getApellidos(), $b->getApellidos()));

        $formato = $request->query->get('formato', 'pdf-unico');
        $lang = $request->query->get('lang', 'es');

        if ($formato === 'zip') {
            return $this->generarZip($alumnos, $grupo, $periodos, $centro, $lang, $periodoSel);
        }

        // PDF único con todos los boletines
        $boletines = [];
        foreach ($alumnos as $alumno) {
            $boletines[] = $this->generarDatosBoletin($alumno, $grupo, $periodos, $periodoSel->getFechaFin());
        }

        $context = $this->buildTemplateContext($centro, $grupo, $periodos, $boletines, $lang, $periodoSel);
        $pdf = $this->pdfGenerator->generateFromTwig('pdf/boletin.html.twig', $context);

        $filename = sprintf('boletines_%s.pdf', $this->slugify($grupo->getNombre()));

        return new Response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $filename),
        ]);
    }

    private function getPeriodosOrdenados(Grupo $grupo, ?\DateTimeInterface $hasta = null): array
    {
        $periodos = $this->em->getRepository(PeriodoEvaluativo::class)->findBy(
            ['grupo' => $grupo],
            ['fechaInicio' => 'ASC']
        );
        // Extraordinaria al final
        usort($periodos, function ($a, $b) {
            $aExtra = $a->getTipo() === 'EXTRAORDINARIA' ? 1 : 0;
            $bExtra = $b->getTipo() === 'EXTRAORDINARIA' ? 1 : 0;
            if ($aExtra !== $bExtra) return $aExtra - $bExtra;
            return $a->getFechaInicio() <=> $b->getFechaInicio();
        });
        // Acumulativo: si se indica "hasta", solo evaluaciones cuya fecha_fin <= hasta
        if ($hasta !== null) {
            $periodos = array_values(array_filter(
                $periodos,
                fn($p) => $p->getFechaFin() <= $hasta
            ));
        }
        return $periodos;
    }

    private function generarDatosBoletin(User $alumno, Grupo $grupo, array $periodos, ?\DateTimeInterface $hasta = null): array
    {
        $imparticiones = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);

        $materias = [];
        foreach ($imparticiones as $imp) {
            $pesos = $this->ponderacionRepo->getPesosParaImparticion($imp->getId());

            // Nota por cada periodo
            $notasPorPeriodo = [];
            foreach ($periodos as $periodo) {
                $media = $this->calcularMediaAlumno($imp->getId(), $alumno->getId(), $pesos, $periodo);
                $notasPorPeriodo[$periodo->getId()] = $media['notaFinal'];
            }

            // Porcentaje de faltas del alumno en esta impartición (recorte acumulativo si hay fecha tope)
            $faltasPct = $this->calcularPorcentajeFaltas($imp, $alumno, $hasta);

            $materias[] = [
                'materia' => $imp->getMateria()->getNombre(),
                'faltasPct' => $faltasPct,
                'notasPorPeriodo' => $notasPorPeriodo,
            ];
        }

        return [
            'alumno' => [
                'id' => $alumno->getId(),
                'nombre' => $alumno->getNombre(),
                'apellidos' => $alumno->getApellidos(),
                'nif' => $alumno->getNif(),
            ],
            'modulos' => $materias,
        ];
    }
    private function calcularPorcentajeFaltas(Imparticion $imp, User $alumno, ?\DateTimeInterface $hasta = null): ?float
    {
        // Denominador: horas anuales LOMLOE (`materia.horasTotales × 60`, con
        // fallback a `catalogoOrigen.horasTotales × 60` y, último recurso,
        // `minutosSemanales × 36`). Misma fuente que /admin/horarios y /faltas
        // → un único "% de absentismo" coherente en todo el sistema. Si la
        // materia no tiene ninguna referencia legal, devolvemos null.
        $totalHoras = (int) round($imp->getMateria()->getObjetivoAnualMinutos() / 60);
        if ($totalHoras <= 0) {
            return null;
        }

        // Numerador: F + J (no R). Norma Andalucía FP cuenta retrasos como
        // ausencia parcial, pero alineamos con /faltas para que las dos vistas
        // muestren la misma cifra al alumno. Recorte acumulativo por `hasta`.
        $qb = $this->em->createQueryBuilder()
            ->select('COUNT(a.id)')
            ->from('App\Entity\Asistencia', 'a')
            ->where('a.imparticion = :imp')
            ->andWhere('a.alumno = :alumno')
            ->andWhere('a.estado IN (:estados)')
            ->andWhere('a.deleted = false')
            ->setParameter('imp', $imp)
            ->setParameter('alumno', $alumno)
            ->setParameter('estados', ['F', 'J']);
        if ($hasta !== null) {
            $qb->andWhere('a.fecha <= :hasta')->setParameter('hasta', $hasta);
        }
        $faltas = $qb->getQuery()->getSingleScalarResult();

        return round(($faltas / $totalHoras) * 100, 2);
    }

    private function calcularMediaAlumno(int $imparticionId, int $alumnoId, array $pesos, ?PeriodoEvaluativo $periodo = null): array
    {
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
        foreach ($rows as $row) {
            $tipo = $row['tipo'] ?? 'tarea';
            if ($row['nota'] !== null) {
                $notasPorTipo[$tipo][] = $row['nota'];
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

        return ['notaFinal' => $notaFinal];
    }

    private function buildTemplateContext($centro, Grupo $grupo, array $periodos, array $boletines, string $lang = 'es', ?PeriodoEvaluativo $periodoSel = null): array
    {
        // Logo del centro descargado de MinIO a tmp local apto para dompdf
        $logoPath = $this->branding->getLogoTmpPath($centro, 'boletin_logo');

        // Firma del admin/coordinador del centro (no del usuario actual):
        // así el boletín aparece firmado tanto si lo descarga un admin, un profesor o el propio alumno.
        // Se elige el primer admin del centro que tenga firma registrada.
        $firmaSvg = null;
        $firmante = null;
        $coordinador = null;
        if ($centro) {
            $userRepo = $this->em->getRepository(User::class);
            $candidatos = $userRepo->createQueryBuilder('u')
                ->andWhere('u.centro = :centro')
                ->andWhere('u.firma IS NOT NULL')
                ->andWhere('u.deleted = false')
                ->andWhere('u.roles LIKE :roleAdmin')
                ->setParameter('centro', $centro)
                ->setParameter('roleAdmin', '%ROLE_ADMIN%')
                ->orderBy('u.id', 'ASC')
                ->getQuery()
                ->getResult();
            $coordinador = $candidatos[0] ?? null;
        }

        if ($coordinador instanceof User && $coordinador->getFirma()) {
            $minioFirma = 'firmas/' . $coordinador->getFirma();
            try {
                if ($this->storage->has($minioFirma)) {
                    $binary = $this->storage->read($minioFirma);
                    // PNG → data URI base64 (Dompdf renderiza PNG data URIs nativamente y fiable)
                    $firmaSvg = 'data:image/png;base64,' . base64_encode($binary);
                }
            } catch (\Throwable $e) {
                // sin firma si falla
            }
            $firmante = trim($coordinador->getNombre() . ' ' . $coordinador->getApellidos());
        }

        // Configuración del título del centro (palabras coloreadas)
        $nameTitleConfig = $this->branding->getNameTitleConfig($centro);

        // Datos de periodos para la plantilla
        $periodosData = [];
        foreach ($periodos as $p) {
            $periodosData[] = [
                'id' => $p->getId(),
                'nombre' => $this->abreviarPeriodo($p, $lang),
            ];
        }

        // Traducciones para la plantilla
        $t = fn(string $key) => $this->translator->trans($key, [], 'boletin', $lang);

        return [
            'centro' => [
                'nombre' => $centro->getNombre(),
                'direccion' => $centro->getDireccion(),
                'telefono' => $centro->getTelefono(),
                'cif' => $centro->getCif(),
            ],
            'grupo' => [
                'nombre' => $grupo->getNombre(),
                'curso' => $grupo->getCurso(),
                'anioEscolar' => $grupo->getAnioEscolar(),
                'fechaInicio' => $grupo->getFechaInicio() ? $grupo->getFechaInicio()->format('d/m/Y') : '',
                'fechaFin' => $grupo->getFechaFin() ? $grupo->getFechaFin()->format('d/m/Y') : '',
            ],
            'ciclo' => [
                'nombre' => $grupo->getItinerario()->getNombre(),
            ],
            'periodos' => $periodosData,
            'logoUrl' => $logoPath,
            'firmaSvg' => $firmaSvg,
            'firmante' => $firmante,
            'nameTitleConfig' => $nameTitleConfig,
            'boletines' => $boletines,
            'fechaEmision' => (new \DateTime())->format('d/m/Y'),
            'evaluacionNombre' => $periodoSel ? $periodoSel->getNombre() : null,
            'evaluacionFecha' => $periodoSel ? $periodoSel->getFechaFin()->format('d/m/Y') : null,
            'i18n' => [
                'title' => $t('boletin.title'),
                'student' => $t('boletin.student'),
                'course' => $t('boletin.course'),
                'shift' => $t('boletin.shift'),
                'subject' => $t('boletin.subject'),
                'absences' => $t('boletin.absences'),
                'date' => $t('boletin.date'),
                'observations' => $t('boletin.observations'),
                'obs_text' => $t('boletin.obs_text'),
                'np' => $t('boletin.np'),
                'na' => $t('boletin.na'),
                'ne' => $t('boletin.ne'),
                'coordinator' => $t('boletin.coordinator'),
            ],
        ];
    }

    private function abreviarPeriodo(PeriodoEvaluativo $p, string $lang = 'es'): string
    {
        $t = fn(string $key) => $this->translator->trans($key, [], 'boletin', $lang);
        return match ($p->getTipo()) {
            'PRIMERA' => $t('boletin.trimester_1'),
            'SEGUNDA' => $t('boletin.trimester_2'),
            'TERCERA' => $t('boletin.trimester_3'),
            'ORDINARIA_FINAL' => $t('boletin.ordinary'),
            'EXTRAORDINARIA' => $t('boletin.extraordinary'),
            default => $p->getNombre(),
        };
    }

    private function generarZip(array $alumnos, Grupo $grupo, array $periodos, $centro, string $lang = 'es', ?PeriodoEvaluativo $periodoSel = null): StreamedResponse
    {
        return new StreamedResponse(function () use ($alumnos, $grupo, $periodos, $centro, $lang, $periodoSel) {
            $zipPath = tempnam(sys_get_temp_dir(), 'boletines_') . '.zip';
            $zip = new \ZipArchive();
            $zip->open($zipPath, \ZipArchive::CREATE);

            foreach ($alumnos as $alumno) {
                $boletinData = $this->generarDatosBoletin($alumno, $grupo, $periodos, $periodoSel ? $periodoSel->getFechaFin() : null);
                $ctx = $this->buildTemplateContext($centro, $grupo, $periodos, [$boletinData], $lang, $periodoSel);
                $pdf = $this->pdfGenerator->generateFromTwig('pdf/boletin.html.twig', $ctx);

                $filename = sprintf('boletin_%s_%s.pdf',
                    $this->slugify($alumno->getApellidos()),
                    $this->slugify($alumno->getNombre())
                );
                $zip->addFromString($filename, $pdf);
            }

            $zip->close();
            readfile($zipPath);
            unlink($zipPath);
        }, 200, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => sprintf('attachment; filename="boletines_%s.zip"',
                $this->slugify($grupo->getNombre())
            ),
        ]);
    }

    private function verificarAccesoBoletin(User $alumno): void
    {
        $user = $this->getUser();
        if ($this->isGranted('ROLE_SUPERADMIN') || $this->isGranted('ROLE_SUPER_ADMIN')) return;
        if ($this->isGranted('ROLE_ADMIN')) return;
        if ($user instanceof User && $user->getId() === $alumno->getId()) return;
        throw $this->createAccessDeniedException('No tienes acceso a este boletín.');
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
        return trim($text, '_');
    }
}
