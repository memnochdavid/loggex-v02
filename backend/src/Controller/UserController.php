<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\FileUploadService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class UserController extends AbstractController
{
    #[Route('/api/user/update', name: 'api_user_update', methods: ['POST'])]
    public function update(
        Request $request,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $entityManager,
        FileUploadService $fileUpload
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        try {
            $nombre = $request->request->get('nombre');
            $telefono = $request->request->get('telefono');
            $nif = $request->request->get('nif');
            $avatarFile = $request->files->get('avatar');

            if ($nombre) {
                $user->setNombre($nombre);
            }

            if ($telefono !== null) {
                $user->setTelefono($telefono);
            }

            if ($nif !== null) {
                $user->setNif($nif);
            }

            if ($avatarFile) {
                $newFilename = $fileUpload->uploadToLocal($avatarFile, 'avatar');
                $user->setFoto('/uploads/avatar/' . $newFilename);
            }

            $entityManager->persist($user);
            $entityManager->flush();

            return $this->json([
                'message' => 'Perfil actualizado correctamente',
                'user' => [
                    'id' => $user->getId(),
                    'email' => $user->getEmail(),
                    'nombre' => $user->getNombre(),
                    'apellidos' => $user->getApellidos(),
                    'roles' => $user->getRoles(),
                    'foto' => $user->getFoto(),
                ]
            ]);
        } catch (\Exception $e) {
            return $this->json(['message' => 'Error interno del servidor'], 500);
        }
    }
}
