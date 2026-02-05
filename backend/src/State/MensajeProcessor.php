<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Mensaje;
use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

class MensajeProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private Security $security
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Mensaje && $data->getId() === null) {
            // Es un nuevo mensaje
            $user = $this->security->getUser();
            if ($user instanceof User) {
                $data->setRemitente($user);
                $data->setFechaEnvio(new \DateTime());
            }
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
