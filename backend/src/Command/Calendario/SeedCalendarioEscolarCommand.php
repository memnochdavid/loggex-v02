<?php

namespace App\Command\Calendario;

use App\Entity\AmbitoFestivo;
use App\Entity\CalendarioEscolarCcaa;
use App\Entity\Ccaa;
use App\Entity\EtapaEducativa;
use App\Entity\Festivo;
use App\Entity\Provincia;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Persiste el calendario escolar autonómico desde el JSON curado en MinIO:
 *
 *   catalogo/calendario-escolar/{CCAA}/curated/calendario-escolar.json
 *
 *   php bin/console app:calendario:seed-escolar --ccaa=AN
 *   php bin/console app:calendario:seed-escolar --ccaa=AN --dry-run
 *
 * Persiste:
 *   - `CalendarioEscolarCcaa` por (ccaa, anioAcademico, etapa) — fechas
 *     oficiales del régimen ordinario por etapa.
 *   - `Festivo` ámbito AUTONOMICO con rango (vacaciones de Navidad y Semana
 *     Santa) o fecha única (Día de la Comunidad Educativa).
 *   - `Festivo` ámbito PROVINCIAL con fecha única (días no lectivos
 *     provinciales — un día por cada provincia listada en el JSON).
 *
 * Idempotente: matchea por (ámbito, ccaa/provincia, fecha_inicio, nombre).
 * No toca festivos LOCALES del centro (los gestiona el admin manualmente).
 */
#[AsCommand(
    name: 'app:calendario:seed-escolar',
    description: 'Persiste calendario escolar autonómico desde MinIO.'
)]
final class SeedCalendarioEscolarCommand extends Command
{
    public function __construct(
        private readonly FilesystemOperator $storage,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('ccaa', null, InputOption::VALUE_REQUIRED, 'Código CCAA (AN, CT, MD, ...).')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No persiste, solo cuenta lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $ccaaCode = strtoupper((string) $input->getOption('ccaa'));
        $ccaa = Ccaa::tryFrom($ccaaCode);
        if (!$ccaa) {
            $io->error(sprintf('Código CCAA inválido: %s', $ccaaCode));
            return Command::FAILURE;
        }

        $path = sprintf('catalogo/calendario-escolar/%s/curated/calendario-escolar.json', $ccaaCode);
        if (!$this->storage->fileExists($path)) {
            $io->error(sprintf('No existe %s en MinIO. Ejecuta primero app:calendario:ingest-escolar --ccaa=%s.', $path, $ccaaCode));
            return Command::FAILURE;
        }

        $raw = $this->storage->read($path);
        $data = json_decode($raw, true);
        if (!is_array($data) || ($data['ccaa'] ?? null) !== $ccaaCode || empty($data['anio_academico'])) {
            $io->error('JSON malformado: faltan claves obligatorias `ccaa`, `anio_academico`.');
            return Command::FAILURE;
        }

        $anioAcademico = (string) $data['anio_academico'];
        $dryRun = (bool) $input->getOption('dry-run');
        $fuenteUrl = $data['fuente']['url'] ?? null;
        $fuenteFecha = isset($data['fuente']['fecha_firma']) ? new \DateTime($data['fuente']['fecha_firma']) : null;

        $io->title(sprintf('Seed calendario escolar %s curso %s', $ccaaCode, $anioAcademico));

        $stats = [
            'etapas' => ['nuevas' => 0, 'actualizadas' => 0, 'sinCambios' => 0],
            'autonomicos' => ['nuevas' => 0, 'sinCambios' => 0],
            'provinciales' => ['nuevas' => 0, 'sinCambios' => 0],
        ];

        // 1. Etapas — CalendarioEscolarCcaa
        $repoCal = $this->em->getRepository(CalendarioEscolarCcaa::class);
        foreach (($data['etapas'] ?? []) as $etapaCode => $info) {
            $etapa = EtapaEducativa::tryFrom(strtolower($etapaCode));
            if (!$etapa) {
                $io->warning(sprintf('  Etapa desconocida: %s', $etapaCode));
                continue;
            }
            $existente = $repoCal->findOneBy([
                'ccaa' => $ccaa,
                'anioAcademico' => $anioAcademico,
                'etapa' => $etapa,
            ]);
            $fechaInicio = new \DateTime($info['fechaInicio']);
            $fechaFin = new \DateTime($info['fechaFin']);
            $diasLect = $info['diasLectivos'] ?? null;
            $horasDoc = $info['horasDocenciaDirecta'] ?? null;
            $coment = $info['comentario'] ?? null;

            if ($existente) {
                $changed = $existente->getFechaInicio()->format('Y-m-d') !== $fechaInicio->format('Y-m-d')
                    || $existente->getFechaFin()->format('Y-m-d') !== $fechaFin->format('Y-m-d')
                    || $existente->getDiasLectivos() !== $diasLect
                    || $existente->getHorasDocencia() !== $horasDoc;
                if ($changed && !$dryRun) {
                    $existente->setFechaInicio($fechaInicio);
                    $existente->setFechaFin($fechaFin);
                    $existente->setDiasLectivos($diasLect);
                    $existente->setHorasDocencia($horasDoc);
                    $existente->setFuenteUrl($fuenteUrl);
                    $existente->setFuenteFecha($fuenteFecha);
                    $existente->setComentario($coment);
                }
                $stats['etapas'][$changed ? 'actualizadas' : 'sinCambios']++;
            } else {
                if (!$dryRun) {
                    $cal = new CalendarioEscolarCcaa();
                    $cal->setCcaa($ccaa);
                    $cal->setAnioAcademico($anioAcademico);
                    $cal->setEtapa($etapa);
                    $cal->setFechaInicio($fechaInicio);
                    $cal->setFechaFin($fechaFin);
                    $cal->setDiasLectivos($diasLect);
                    $cal->setHorasDocencia($horasDoc);
                    $cal->setFuenteUrl($fuenteUrl);
                    $cal->setFuenteFecha($fuenteFecha);
                    $cal->setComentario($coment);
                    $this->em->persist($cal);
                }
                $stats['etapas']['nuevas']++;
            }
        }

        // 2. Vacaciones autonómicas (Festivo con rango)
        $repoFest = $this->em->getRepository(Festivo::class);
        foreach (($data['vacaciones_autonomicas'] ?? []) as $f) {
            $result = $this->upsertFestivo(
                $repoFest,
                AmbitoFestivo::AUTONOMICO,
                $ccaa,
                null,
                $f['nombre'],
                new \DateTime($f['fechaInicio']),
                isset($f['fechaFin']) ? new \DateTime($f['fechaFin']) : null,
                $dryRun
            );
            $stats['autonomicos'][$result]++;
        }

        // 3. Días no lectivos autonómicos (fecha única)
        foreach (($data['dias_no_lectivos_autonomicos'] ?? []) as $f) {
            $result = $this->upsertFestivo(
                $repoFest,
                AmbitoFestivo::AUTONOMICO,
                $ccaa,
                null,
                $f['nombre'],
                new \DateTime($f['fecha']),
                null,
                $dryRun
            );
            $stats['autonomicos'][$result]++;
        }

        // 4. Días no lectivos provinciales
        $repoProv = $this->em->getRepository(Provincia::class);
        foreach (($data['dias_no_lectivos_provinciales'] ?? []) as $provCode => $items) {
            $provincia = $repoProv->findOneBy(['codigo' => $provCode]);
            if (!$provincia) {
                $io->warning(sprintf('  Provincia desconocida: %s — saltando %d entradas', $provCode, count($items)));
                continue;
            }
            foreach ($items as $f) {
                $result = $this->upsertFestivo(
                    $repoFest,
                    AmbitoFestivo::PROVINCIAL,
                    null,
                    $provincia,
                    $f['nombre'],
                    new \DateTime($f['fecha']),
                    isset($f['fechaFin']) ? new \DateTime($f['fechaFin']) : null,
                    $dryRun
                );
                $stats['provinciales'][$result]++;
            }
        }

        if (!$dryRun) {
            $this->em->flush();
        }

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido'],
            ['Etapas nuevas' => $stats['etapas']['nuevas']],
            ['Etapas actualizadas' => $stats['etapas']['actualizadas']],
            ['Etapas sin cambios' => $stats['etapas']['sinCambios']],
            ['Festivos autonómicos nuevos' => $stats['autonomicos']['nuevas']],
            ['Festivos autonómicos sin cambios' => $stats['autonomicos']['sinCambios']],
            ['Festivos provinciales nuevos' => $stats['provinciales']['nuevas']],
            ['Festivos provinciales sin cambios' => $stats['provinciales']['sinCambios']],
        );
        $io->success('Seed completado.');
        return Command::SUCCESS;
    }

    /**
     * @return string 'nuevas' | 'sinCambios'
     */
    private function upsertFestivo(
        $repo,
        AmbitoFestivo $ambito,
        ?Ccaa $ccaa,
        ?Provincia $provincia,
        string $nombre,
        \DateTime $fechaInicio,
        ?\DateTime $fechaFin,
        bool $dryRun
    ): string {
        $criteria = ['ambito' => $ambito->value, 'fechaInicio' => $fechaInicio, 'nombre' => $nombre];
        if ($ccaa) {
            $criteria['ccaa'] = $ccaa->value;
        }
        if ($provincia) {
            $criteria['provincia'] = $provincia;
        }
        $existente = $repo->findOneBy($criteria);
        if ($existente) {
            return 'sinCambios';
        }
        if ($dryRun) {
            return 'nuevas';
        }
        $f = new Festivo();
        $f->setNombre($nombre);
        $f->setFechaInicio($fechaInicio);
        $f->setFechaFin($fechaFin);
        $f->setAmbito($ambito);
        if ($ccaa) {
            $f->setCcaa($ccaa);
        }
        if ($provincia) {
            $f->setProvincia($provincia);
        }
        $this->em->persist($f);
        return 'nuevas';
    }
}
