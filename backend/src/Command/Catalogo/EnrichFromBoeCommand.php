<?php

namespace App\Command\Catalogo;

use App\Catalogo\BoeRd\BoeRdEnricher;
use App\Entity\Catalogo\CatalogoItinerario;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Enriquece los CatalogoItinerario existentes con datos del BOE: módulos
 * con horas, vigenteDesde, duración total, denominación canónica.
 *
 * Uso:
 *   php bin/console app:catalogo:enrich-boe                   # todos pendientes
 *   php bin/console app:catalogo:enrich-boe --dry-run         # cuenta sin tocar BD
 *   php bin/console app:catalogo:enrich-boe --codigo=des-aplicaciones-web  # solo uno
 *   php bin/console app:catalogo:enrich-boe --limit=5         # solo los 5 primeros pendientes
 *   php bin/console app:catalogo:enrich-boe --force           # también los que ya tienen módulos
 */
#[AsCommand(
    name: 'app:catalogo:enrich-boe',
    description: 'Enriquece los itinerarios del catálogo con datos del BOE (módulos, horas, etc.).'
)]
final class EnrichFromBoeCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly BoeRdEnricher $enricher,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No persiste cambios; solo cuenta.')
            ->addOption('codigo', null, InputOption::VALUE_REQUIRED, 'Procesar solo el itinerario con ese codigo_oficial.')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Limitar el número de itinerarios procesados.', null)
            ->addOption('force', null, InputOption::VALUE_NONE, 'Procesar también los que ya tienen módulos.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $dryRun = (bool) $input->getOption('dry-run');
        $codigo = $input->getOption('codigo');
        $limit = $input->getOption('limit');
        $force = (bool) $input->getOption('force');

        if ($dryRun) {
            $io->warning('Modo dry-run: no se persistirá nada en la base de datos.');
        }
        $this->enricher->setDryRun($dryRun);

        $itinerarios = $this->loadItinerarios($codigo, $force, $limit !== null ? (int) $limit : null);
        if (empty($itinerarios)) {
            $io->warning('No hay itinerarios pendientes de enriquecer (o ninguno coincide con los filtros).');
            return Command::SUCCESS;
        }

        $io->section(sprintf('Procesando %d itinerarios', count($itinerarios)));

        $progress = $io->createProgressBar(count($itinerarios));
        $progress->start();
        foreach ($itinerarios as $it) {
            $this->enricher->enrich([$it]);
            $progress->advance();
        }
        $progress->finish();
        $io->newLine(2);

        $this->enricher->flush();

        $summary = $this->enricher->summary();
        $io->definitionList(
            ['Modo' => $summary['dryRun'] ? 'DRY-RUN' : 'Persistido'],
            ['Procesados'   => $summary['itinerariosProcesados']],
            ['Enriquecidos' => $summary['itinerariosEnriquecidos']],
            ['Sin cambios'  => $summary['itinerariosSinCambios']],
            ['Fallidos'     => $summary['itinerariosFallidos']],
            ['Módulos creados' => $summary['modulosCreados']],
        );

        return $summary['itinerariosFallidos'] > 0 && $summary['itinerariosEnriquecidos'] === 0
            ? Command::FAILURE
            : Command::SUCCESS;
    }

    /**
     * @return list<CatalogoItinerario>
     */
    private function loadItinerarios(?string $codigo, bool $force, ?int $limit): array
    {
        $qb = $this->em->createQueryBuilder()
            ->select('i')
            ->from(CatalogoItinerario::class, 'i')
            ->where('i.fuenteIngesta = :fuente')
            ->andWhere('i.boletinUrl IS NOT NULL')
            ->setParameter('fuente', 'todofp_http');

        if ($codigo !== null) {
            $qb->andWhere('i.codigoOficial = :cod')->setParameter('cod', $codigo);
        }

        if (!$force) {
            // Por defecto, solo los que aún no tienen módulos extraídos.
            $qb->andWhere('SIZE(i.materias) = 0');
        }

        if ($limit !== null) {
            $qb->setMaxResults($limit);
        }

        return $qb->getQuery()->getResult();
    }
}
