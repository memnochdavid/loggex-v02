<?php

namespace App\Controller;

use App\Entity\Personalizacion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class PersonalizacionController extends AbstractController
{
    #[Route('/api/configuracion/update', name: 'api_configuracion_update', methods: ['POST'])]
    public function update(
        Request $request,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $entityManager
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $centro = $user->getCentro();
        if (!$centro) {
            return $this->json(['message' => 'El usuario no pertenece a ningún centro'], 400);
        }

        $personalizacion = $centro->getPersonalizacion();
        if (!$personalizacion) {
            $personalizacion = new Personalizacion();
            $personalizacion->setCentro($centro);
        }

        $data = json_decode($request->getContent(), true);

        // General
        if (isset($data['primaryColor'])) $personalizacion->setPrimaryColor($data['primaryColor']);

        // Sidebar
        if (isset($data['sidebarColor'])) $personalizacion->setSidebarColor($data['sidebarColor']);
        if (isset($data['sidebarActiveColor'])) $personalizacion->setSidebarActiveColor($data['sidebarActiveColor']);
        if (isset($data['sidebarActiveTextColor'])) $personalizacion->setSidebarActiveTextColor($data['sidebarActiveTextColor']);
        if (isset($data['sidebarHoverColor'])) $personalizacion->setSidebarHoverColor($data['sidebarHoverColor']);
        if (isset($data['sidebarHoverTextColor'])) $personalizacion->setSidebarHoverTextColor($data['sidebarHoverTextColor']);

        // Textos
        if (isset($data['textMainColor'])) $personalizacion->setTextMainColor($data['textMainColor']);
        if (isset($data['textSecondaryColor'])) $personalizacion->setTextSecondaryColor($data['textSecondaryColor']);

        // Botones
        if (isset($data['buttonPrimaryColor'])) $personalizacion->setButtonPrimaryColor($data['buttonPrimaryColor']);
        if (isset($data['buttonPrimaryTextColor'])) $personalizacion->setButtonPrimaryTextColor($data['buttonPrimaryTextColor']);
        if (isset($data['buttonSecondaryColor'])) $personalizacion->setButtonSecondaryColor($data['buttonSecondaryColor']);
        if (isset($data['buttonSecondaryTextColor'])) $personalizacion->setButtonSecondaryTextColor($data['buttonSecondaryTextColor']);

        // Header/Footer
        if (isset($data['headerFooterColor'])) $personalizacion->setHeaderFooterColor($data['headerFooterColor']);
        if (isset($data['headerFooterTextColor'])) $personalizacion->setHeaderFooterTextColor($data['headerFooterTextColor']);

        $entityManager->persist($personalizacion);
        $entityManager->flush();

        return $this->json([
            'message' => 'Configuración guardada correctamente',
            'personalizacion' => $data // Devolvemos lo que recibimos para actualizar el estado local rápido
        ]);
    }
}
