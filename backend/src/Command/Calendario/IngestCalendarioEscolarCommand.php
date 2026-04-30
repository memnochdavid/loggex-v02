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
 * Sube artefactos del calendario escolar autonómico a MinIO:
 *
 *   catalogo/calendario-escolar/{CCAA}/source/   ← PDFs oficiales (BOJA, DOGC, etc.)
 *   catalogo/calendario-escolar/{CCAA}/curated/calendario-escolar.json ← extracto curado
 *
 *   php bin/console app:calendario:ingest-escolar --ccaa=AN --source-dir=/tmp/calendario-escolar-an
 *
 * El directorio fuente debe contener:
 *   - source/*.pdf con los PDFs oficiales
 *   - curated/calendario-escolar.json con el extracto verificado
 *
 * Idempotente: cada upload sobrescribe.
 */
#[AsCommand(
    name: 'app:calendario:ingest-escolar',
    description: 'Sube PDFs oficiales y JSON curado de calendario escolar autonómico a MinIO.'
)]
final class IngestCalendarioEscolarCommand extends Command
{
    public function __construct(private readonly FilesystemOperator $storage)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('ccaa', null, InputOption::VALUE_REQUIRED, 'Código CCAA ISO 3166-2 (AN, CT, MD, ...).')
            ->addOption('source-dir', null, InputOption::VALUE_REQUIRED, 'Directorio local con source/*.pdf y curated/calendario-escolar.json.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No sube nada, solo lista lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $ccaa = strtoupper((string) $input->getOption('ccaa'));
        if (!preg_match('/^[A-Z]{2}$/', $ccaa)) {
            $io->error('Falta --ccaa o no es un código de 2 letras.');
            return Command::FAILURE;
        }

        $sourceDir = $input->getOption('source-dir');
        if (!$sourceDir || !is_dir($sourceDir)) {
            $io->error(sprintf('Directorio fuente inválido: %s', $sourceDir));
            return Command::FAILURE;
        }

        $dryRun = (bool) $input->getOption('dry-run');
        $base = sprintf('catalogo/calendario-escolar/%s', $ccaa);

        $io->title(sprintf('Ingesta calendario escolar %s desde %s', $ccaa, $sourceDir));
        if ($dryRun) {
            $io->warning('Modo dry-run: no se sube nada.');
        }

        $stats = ['pdfs' => 0, 'json' => 0, 'falladas' => 0];

        foreach (glob($sourceDir . '/source/*.pdf') ?: [] as $pdf) {
            $name = basename($pdf);
            $dest = sprintf('%s/source/%s', $base, $name);
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

        $jsonPath = $sourceDir . '/curated/calendario-escolar.json';
        if (!file_exists($jsonPath)) {
            $io->error(sprintf('No existe %s', $jsonPath));
            return Command::FAILURE;
        }

        $contenido = file_get_contents($jsonPath);
        $decoded = json_decode($contenido, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            $io->error(sprintf('calendario-escolar.json malformado: %s', json_last_error_msg()));
            return Command::FAILURE;
        }
        if (($decoded['ccaa'] ?? null) !== $ccaa) {
            $io->error(sprintf('La clave "ccaa" del JSON (%s) no coincide con --ccaa=%s', $decoded['ccaa'] ?? 'null', $ccaa));
            return Command::FAILURE;
        }

        $dest = sprintf('%s/curated/calendario-escolar.json', $base);
        $io->writeln(sprintf(' · JSON → %s (curso %s)', $dest, $decoded['anio_academico'] ?? '?'));
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

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido en MinIO'],
            ['Base' => $base],
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
