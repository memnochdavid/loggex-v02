<?php

namespace App\Command\Catalogo;

use App\Entity\Ccaa;
use League\Flysystem\FilesystemOperator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Sube artefactos de currículo de una CCAA a MinIO en su ruta canónica:
 *
 *   catalogo/ccaa/{CCAA}/source/   ← PDFs originales (BOJA, DOGC, BOCM…) auditables
 *   catalogo/ccaa/{CCAA}/curated/  ← JSON estructurado verificable que lee el provider
 *
 * Uso:
 *   php bin/console app:catalogo:ccaa:ingest --ccaa=AN --source-dir=/tmp/boja-an-fp
 *
 * El directorio fuente debe contener:
 *   - PDFs (cualquier *.pdf): se suben a `source/`.
 *   - horarios.json: se sube a `curated/horarios.json` (el provider lo lee).
 *
 * Idempotente: cada upload sobrescribe; los archivos en MinIO con nombre coincidente
 * se actualizan, los que no estén en source-dir no se borran.
 */
#[AsCommand(
    name: 'app:catalogo:ccaa:ingest',
    description: 'Sube PDFs y JSON curado del currículo de una CCAA a MinIO.'
)]
final class IngestCcaaSourceCommand extends Command
{
    public function __construct(private readonly FilesystemOperator $storage)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('ccaa', null, InputOption::VALUE_REQUIRED, 'Código ISO 3166-2:ES (AN, CT, MD…).')
            ->addOption('source-dir', null, InputOption::VALUE_REQUIRED, 'Directorio local con PDFs y horarios.json.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No sube nada, solo lista lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $ccaaCode = $input->getOption('ccaa');
        $ccaa = $ccaaCode ? Ccaa::tryFrom($ccaaCode) : null;
        if (!$ccaa) {
            $io->error('Especifica --ccaa con un código válido (AN, CT, MD…).');
            return Command::FAILURE;
        }

        $sourceDir = $input->getOption('source-dir');
        if (!$sourceDir || !is_dir($sourceDir)) {
            $io->error(sprintf('Directorio fuente inválido: %s', $sourceDir));
            return Command::FAILURE;
        }

        $dryRun = (bool) $input->getOption('dry-run');
        $basePath = sprintf('catalogo/ccaa/%s', $ccaa->value);
        $sourcePath = $basePath . '/source';
        $curatedPath = $basePath . '/curated';

        $io->title(sprintf('Ingesta CCAA %s desde %s', $ccaa->value, $sourceDir));
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

        $jsonPath = $sourceDir . '/horarios.json';
        if (file_exists($jsonPath)) {
            $dest = $curatedPath . '/horarios.json';
            $contenido = file_get_contents($jsonPath);
            // Validar JSON antes de subir
            $decoded = json_decode($contenido, true);
            if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                $io->error(sprintf('horarios.json malformado: %s', json_last_error_msg()));
                return Command::FAILURE;
            }
            $io->writeln(sprintf(' · JSON horarios.json → %s (%d itinerarios, %d transversales)',
                $dest,
                count($decoded['itinerarios'] ?? []),
                count($decoded['transversalesLomloeGs'] ?? [])
            ));
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
            $io->note('No hay horarios.json en el directorio fuente — solo se subirán PDFs.');
        }

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido en MinIO'],
            ['CCAA' => $ccaa->value . ' — ' . $ccaa->nombre()],
            ['Ruta source'  => $sourcePath],
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
