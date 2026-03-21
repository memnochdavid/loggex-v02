<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Comunicado;
use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

class ComunicadoProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private Security $security
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Comunicado && $data->getId() === null) {
            // Es un nuevo comunicado
            $user = $this->security->getUser();
            if ($user instanceof User) {
                $data->setAutor($user);

                // Si no es superadmin, forzamos que el centro sea el del usuario
                // Verificamos ambos roles posibles para asegurar compatibilidad
                if (!$this->security->isGranted('ROLE_SUPERADMIN')) {
                    $data->setCentro($user->getCentro());
                    $data->setGlobal(false); // Un admin normal no puede publicar global
                }
            }
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
