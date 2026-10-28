<?php

namespace App\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

#[AsCommand(name: 'app:mercure:test', description: 'Publish a test update to the Mercure hub (manual verification).')]
class MercureTestPublishCommand extends Command
{
    public function __construct(private readonly HubInterface $hub)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('topic', InputArgument::OPTIONAL, 'Topic URI', '/test/public');
        $this->addArgument('payload', InputArgument::OPTIONAL, 'JSON payload', '{"hello":"from-cli"}');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $id = $this->hub->publish(new Update($input->getArgument('topic'), $input->getArgument('payload')));
        $output->writeln("Published, id: {$id}");
        return Command::SUCCESS;
    }
}
