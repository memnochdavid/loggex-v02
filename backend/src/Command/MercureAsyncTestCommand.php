<?php

namespace App\Command;

use App\Message\PublishMercureUpdate;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsCommand(name: 'app:mercure:test-async', description: 'Dispatch a PublishMercureUpdate job (worker will publish).')]
class MercureAsyncTestCommand extends Command
{
    public function __construct(private readonly MessageBusInterface $bus)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('topic', InputArgument::OPTIONAL, 'Topic URI', '/test/async');
        $this->addArgument('payload', InputArgument::OPTIONAL, 'JSON payload', '{"hello":"async"}');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->bus->dispatch(new PublishMercureUpdate(
            [$input->getArgument('topic')],
            $input->getArgument('payload'),
            false,
        ));
        $output->writeln('Dispatched. Worker will publish shortly.');
        return Command::SUCCESS;
    }
}
