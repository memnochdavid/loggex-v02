<?php

namespace App\Command;

use App\Entity\Imparticion;
use App\Service\CierreTareasVencidasService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tareas:cerrar-vencidas',
    description: 'Cierra con un 0 automático las tareas vencidas sin entrega.',
)]
final class CierreTareasVencidasCommand extends Command
{
    public function __construct(
        private readonly CierreTareasVencidasService $service,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('imparticion', null, InputOption::VALUE_REQUIRED, 'ID de imparticion concreta. Si se omite, procesa todas.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No persiste; solo cuenta lo que haría.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $impId = $input->getOption('imparticion');
        $dryRun = (bool) $input->getOption('dry-run');

        $imp = null;
        if ($impId !== null) {
            $imp = $this->em->getRepository(Imparticion::class)->find($impId);
            if (!$imp) {
                $io->error(sprintf('Imparticion %s no encontrada.', $impId));
                return Command::FAILURE;
            }
        }

        $stats = $this->service->procesar($imp, $dryRun);
        $io->success(sprintf(
            '%s — Tareas procesadas: %d (%d omitidas), alumnos cerrados con 0: %d.',
            $dryRun ? '[DRY-RUN]' : 'OK',
            $stats['tareasProcesadas'],
            $stats['tareasOmitidas'],
            $stats['alumnosCerrados'],
        ));
        return Command::SUCCESS;
    }
}
