<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

class UserController extends AbstractController
{
    #[Route('/api/user/update', name: 'api_user_update', methods: ['POST'])]
    public function update(
        Request $request,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $entityManager,
        SerializerInterface $serializer
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        try {
            // Obtener datos del formulario (multipart/form-data)
            $nombre = $request->request->get('nombre');
            $avatarFile = $request->files->get('avatar');

            if ($nombre) {
                $user->setNombre($nombre);
            }

            if ($avatarFile) {
                $destination = $this->getParameter('kernel.project_dir') . '/public/uploads/avatar';

                // Crear directorio si no existe
                if (!file_exists($destination)) {
                    // Intentar crear con permisos amplios
                    if (!@mkdir($destination, 0777, true) && !is_dir($destination)) {
                        // Si falla, probablemente es porque el volumen montado ./backend:/var/www/html:z
                        // hace que los permisos sean del usuario del host (david), y www-data no puede escribir.
                        // Como fallback, intentaremos escribir en /tmp y moverlo, o simplemente fallar con un mensaje claro.
                        throw new \RuntimeException(sprintf('No se pudo crear el directorio "%s". Verifique permisos.', $destination));
                    }
                }

                // Verificar si es escribible
                if (!is_writable($destination)) {
                     throw new \RuntimeException(sprintf('El directorio "%s" no tiene permisos de escritura.', $destination));
                }

                $originalFilename = pathinfo($avatarFile->getClientOriginalName(), PATHINFO_FILENAME);
                $safeFilename = preg_replace('/[^a-zA-Z0-9]/', '_', $originalFilename);
                $newFilename = $safeFilename.'-'.uniqid().'.'.$avatarFile->guessExtension();

                $avatarFile->move(
                    $destination,
                    $newFilename
                );

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
            return $this->json(['message' => 'Error interno: ' . $e->getMessage()], 500);
        }
    }
}
