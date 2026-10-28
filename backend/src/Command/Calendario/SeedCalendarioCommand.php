<?php

namespace App\Command\Calendario;

use App\Entity\AmbitoFestivo;
use App\Entity\Ccaa;
use App\Entity\Festivo;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Persiste festivos NACIONALES y AUTONÓMICOS desde el JSON curado en MinIO
 * (`catalogo/calendario/curated/festivos.json`).
 *
 *   php bin/console app:calendario:seed              # todos los años del JSON
 *   php bin/console app:calendario:seed --anio=2026  # solo el año indicado
 *   php bin/console app:calendario:seed --dry-run
 *
 * Idempotente: matchea por (ámbito, ccaa, fecha_inicio, nombre). Si el festivo
 * ya existe se actualiza; si no, se crea. NO toca festivos LOCALES (ámbito
 * LOCAL del centro) — esos los gestiona el admin manualmente desde la UI.
 */
#[AsCommand(
    name: 'app:calendario:seed',
    description: 'Persiste festivos nacionales y autonómicos desde MinIO.'
)]
final class SeedCalendarioCommand extends Command
{
    private const CURATED_PATH = 'catalogo/calendario/curated/festivos.json';

    public function __construct(
        private readonly FilesystemOperator $storage,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('anio', null, InputOption::VALUE_REQUIRED, 'Solo persistir este año (ej. 2026). Por defecto: todos los del JSON.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No persiste, solo cuenta lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        if (!$this->storage->fileExists(self::CURATED_PATH)) {
            $io->error(sprintf('No existe %s en MinIO. Ejecuta primero app:calendario:ingest.', self::CURATED_PATH));
            return Command::FAILURE;
        }

        $raw = $this->storage->read(self::CURATED_PATH);
        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['anios'])) {
            $io->error('JSON de festivos malformado: falta la clave `anios`.');
            return Command::FAILURE;
        }

        $anioFiltro = $input->getOption('anio');
        $dryRun = (bool) $input->getOption('dry-run');
        $repo = $this->em->getRepository(Festivo::class);
        $stats = ['nacionales' => ['nuevas' => 0, 'actualizadas' => 0, 'sinCambios' => 0],
                  'autonomicos' => ['nuevas' => 0, 'actualizadas' => 0, 'sinCambios' => 0]];

        foreach ($data['anios'] as $anio => $bloque) {
            if ($anioFiltro && (string) $anio !== (string) $anioFiltro) continue;
            $io->section(sprintf('Año %s', $anio));

            foreach ($bloque['nacionales'] ?? [] as $f) {
                $result = $this->upsertFestivo($repo, AmbitoFestivo::NACIONAL, null, $f, $dryRun);
                $stats['nacionales'][$result]++;
            }

            foreach ($bloque['autonomicos'] ?? [] as $ccaaCode => $festivos) {
                $ccaa = Ccaa::tryFrom($ccaaCode);
                if (!$ccaa) {
                    $io->warning(sprintf('  Código CCAA inválido en JSON: %s', $ccaaCode));
                    continue;
                }
                foreach ($festivos as $f) {
                    $result = $this->upsertFestivo($repo, AmbitoFestivo::AUTONOMICO, $ccaa, $f, $dryRun);
                    $stats['autonomicos'][$result]++;
                }
            }
        }

        if (!$dryRun) {
            $this->em->flush();
        }

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido'],
            ['Nacionales nuevos'         => $stats['nacionales']['nuevas']],
            ['Nacionales actualizados'   => $stats['nacionales']['actualizadas']],
            ['Nacionales sin cambios'    => $stats['nacionales']['sinCambios']],
            ['Autonómicos nuevos'        => $stats['autonomicos']['nuevas']],
            ['Autonómicos actualizados'  => $stats['autonomicos']['actualizadas']],
            ['Autonómicos sin cambios'   => $stats['autonomicos']['sinCambios']],
        );
        $io->success('Seed completado.');
        return Command::SUCCESS;
    }

    private function upsertFestivo($repo, AmbitoFestivo $ambito, ?Ccaa $ccaa, array $f, bool $dryRun): string
    {
        $fecha = new \DateTime($f['fecha']);
        $nombre = $f['nombre'];

        $criteria = ['ambito' => $ambito->value, 'fechaInicio' => $fecha, 'nombre' => $nombre];
        if ($ccaa) {
            $criteria['ccaa'] = $ccaa->value;
        }

        $existente = $repo->findOneBy($criteria);
        if ($existente) {
            return 'sinCambios';
        }

        if ($dryRun) {
            return 'nuevas';
        }

        $festivo = new Festivo();
        $festivo->setNombre($nombre);
        $festivo->setFechaInicio($fecha);
        $festivo->setAmbito($ambito);
        if ($ccaa) {
            $festivo->setCcaa($ccaa);
        }
        $this->em->persist($festivo);
        return 'nuevas';
    }
}
