<?php

namespace App\MessageHandler;

use App\Message\PublishMercureUpdate;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

#[AsMessageHandler]
final class PublishMercureUpdateHandler
{
    public function __construct(private readonly HubInterface $hub)
    {
    }

    public function __invoke(PublishMercureUpdate $message): void
    {
        $this->hub->publish(new Update(
            $message->topics,
            $message->payload,
            $message->private,
        ));
    }
}
