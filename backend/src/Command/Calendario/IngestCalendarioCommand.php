<?php

namespace App\Command\Calendario;

use League\Flysystem\FilesystemOperator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Sube artefactos de calendario laboral oficial a MinIO en su ruta canónica:
 *
 *   catalogo/calendario/source/    ← PDFs BOE de calendario laboral por año
 *   catalogo/calendario/curated/festivos.json   ← extracto verificado
 *
 *   php bin/console app:calendario:ingest --source-dir=/tmp/boe-calendarios
 *
 * El directorio fuente debe contener:
 *   - PDFs (cualquier *.pdf): se suben a `source/`.
 *   - festivos.json: se sube a `curated/festivos.json`.
 *
 * Idempotente: cada upload sobrescribe.
 */
#[AsCommand(
    name: 'app:calendario:ingest',
    description: 'Sube PDFs BOE y JSON curado de calendarios laborales a MinIO.'
)]
final class IngestCalendarioCommand extends Command
{
    public function __construct(private readonly FilesystemOperator $storage)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('source-dir', null, InputOption::VALUE_REQUIRED, 'Directorio local con los PDFs y festivos.json.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No sube nada, solo lista lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $sourceDir = $input->getOption('source-dir');
        if (!$sourceDir || !is_dir($sourceDir)) {
            $io->error(sprintf('Directorio fuente inválido: %s', $sourceDir));
            return Command::FAILURE;
        }

        $dryRun = (bool) $input->getOption('dry-run');
        $basePath = 'catalogo/calendario';
        $sourcePath = $basePath . '/source';
        $curatedPath = $basePath . '/curated';

        $io->title(sprintf('Ingesta de calendario laboral desde %s', $sourceDir));
        if ($dryRun) {
            $io->warning('Modo dry-run: no se sube nada.');
        }

        $stats = ['pdfs' => 0, 'json' => 0, 'falladas' => 0];

        foreach (glob($sourceDir . '/*.pdf') as $pdf) {
            $name = basename($pdf);
            $dest = $sourcePath . '/' . $name;
            $io->writeln(sprintf(' · PDF %s → %s', $name, $dest));
            if (!$dryRun) {
                try {
                    $this->storage->write($dest, file_get_contents($pdf));
                    $stats['pdfs']++;
                } catch (\Throwable $e) {
                    $io->warning(sprintf('   Falló: %s', $e->getMessage()));
                    $stats['falladas']++;
                }
            } else {
                $stats['pdfs']++;
            }
        }

        $jsonPath = $sourceDir . '/festivos.json';
        if (file_exists($jsonPath)) {
            $dest = $curatedPath . '/festivos.json';
            $contenido = file_get_contents($jsonPath);
            $decoded = json_decode($contenido, true);
            if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                $io->error(sprintf('festivos.json malformado: %s', json_last_error_msg()));
                return Command::FAILURE;
            }
            $anios = array_keys($decoded['anios'] ?? []);
            $io->writeln(sprintf(' · JSON festivos.json → %s (años %s)', $dest, implode(', ', $anios)));
            if (!$dryRun) {
                try {
                    $this->storage->write($dest, $contenido);
                    $stats['json']++;
                } catch (\Throwable $e) {
                    $io->warning(sprintf('   Falló: %s', $e->getMessage()));
                    $stats['falladas']++;
                }
            } else {
                $stats['json']++;
            }
        } else {
            $io->note('No hay festivos.json en el directorio fuente — solo se subirán PDFs.');
        }

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido en MinIO'],
            ['Ruta source' => $sourcePath],
            ['Ruta curated' => $curatedPath],
            ['PDFs subidos' => $stats['pdfs']],
            ['JSONs subidos' => $stats['json']],
            ['Fallidos' => $stats['falladas']],
        );

        if ($stats['falladas'] > 0) {
            $io->warning('Algunos archivos fallaron — revisa los warnings.');
            return Command::FAILURE;
        }
        $io->success('Ingesta completada.');
        return Command::SUCCESS;
    }
}
