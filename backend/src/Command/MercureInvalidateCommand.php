<?php

namespace App\Command;

use App\Message\PublishMercureUpdate;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Fallback manual para tras seeds o INSERT/UPDATE SQL directo: dispara una
 * publicación Mercure a topics arbitrarios para que los clientes conectados
 * refresquen sus vistas live.
 *
 * Doctrine no se entera de cambios SQL crudos → el LivePublishSubscriber no
 * se dispara. Este comando es la vía manual para señalizar a los clientes
 * que deben refrescar.
 *
 * Uso típico:
 *   docker compose exec backend php bin/console app:mercure:invalidate \
 *     -t /centros/3/comunicados -t /centros/3/grupos
 *
 * El payload tiene type=invalidate para que el hook frontend distinga este
 * evento (no trae data, sólo señaliza "refetch").
 */
#[AsCommand(
    name: 'app:mercure:invalidate',
    description: 'Publica un update Mercure manual a uno o más topics (fallback tras SQL directo).',
)]
final class MercureInvalidateCommand extends Command
{
    public function __construct(private readonly MessageBusInterface $bus)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption(
                'topic',
                't',
                InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'Topic Mercure (puede repetirse: -t /a -t /b)',
            )
            ->addOption(
                'reason',
                'r',
                InputOption::VALUE_REQUIRED,
                'Texto descriptivo opcional incluido en el payload',
                '',
            )
            ->addOption(
                'public',
                null,
                InputOption::VALUE_NONE,
                'Publicar como update público (sin restricción de JWT). Por defecto es privado.',
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        /** @var string[] $topics */
        $topics = $input->getOption('topic');
        if (!$topics) {
            $io->error('Se requiere al menos un --topic / -t');
            return Command::INVALID;
        }
        $reason = (string) $input->getOption('reason');
        $private = !$input->getOption('public');

        $payload = json_encode([
            'type'   => 'invalidate',
            'reason' => $reason,
        ]);

        $this->bus->dispatch(new PublishMercureUpdate($topics, $payload, $private));

        $io->success(sprintf(
            'Publicado update invalidate a %d topic(s) [%s]',
            count($topics),
            $private ? 'privado' : 'público',
        ));
        foreach ($topics as $t) {
            $io->writeln('  • '.$t);
        }
        return Command::SUCCESS;
    }
}
