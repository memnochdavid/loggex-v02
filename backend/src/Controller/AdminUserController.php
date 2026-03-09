<?php

namespace App\Controller;

use App\Entity\Centro;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_ADMIN')]
class AdminUserController extends AbstractController
{
    #[Route('/api/admin/user/create', name: 'api_admin_user_create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        FilesystemOperator $storage
    ): JsonResponse {
        $user = new User();
        return $this->handleForm($user, $request, $entityManager, $passwordHasher, $storage);
    }

    #[Route('/api/admin/user/{id}/update', name: 'api_admin_user_update', methods: ['POST'])]
    public function update(
        User $user,
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        FilesystemOperator $storage
    ): JsonResponse {
        return $this->handleForm($user, $request, $entityManager, $passwordHasher, $storage);
    }

    private function handleForm(
        User $user,
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        FilesystemOperator $storage
    ): JsonResponse {
        // Obtener datos (multipart/form-data)
        $nombre = $request->request->get('nombre');
        $apellidos = $request->request->get('apellidos');
        $email = $request->request->get('email');
        $telefono = $request->request->get('telefono');
        $nif = $request->request->get('nif');
        $password = $request->request->get('password');
        $rolesJson = $request->request->get('roles'); // Esperamos un JSON string con los roles
        $centroId = $request->request->get('centro');
        $avatarFile = $request->files->get('avatar');

        // Validaciones básicas para crear
        if (!$user->getId() && (!$email || !$password || !$nombre || !$apellidos)) {
            return $this->json(['message' => 'Faltan campos obligatorios'], 400);
        }

        if ($nombre) $user->setNombre($nombre);
        if ($apellidos) $user->setApellidos($apellidos);
        if ($email) $user->setEmail($email);
        if ($telefono !== null) $user->setTelefono($telefono);
        if ($nif !== null) $user->setNif($nif);

        if ($password) {
            $hashedPassword = $passwordHasher->hashPassword($user, $password);
            $user->setPassword($hashedPassword);
        }

        if ($rolesJson) {
            $roles = json_decode($rolesJson, true);
            if (is_array($roles)) {
                $user->setRoles($roles);

                // Determinar rol_app principal para compatibilidad
                if (in_array('ROLE_ALUMNO', $roles)) {
                    $user->setRolApp('alumno');
                } elseif (in_array('ROLE_ADMIN', $roles)) {
                    $user->setRolApp('admin');
                } elseif (in_array('ROLE_PROFESOR', $roles)) {
                    $user->setRolApp('profesor');
                } elseif (in_array('ROLE_SUPERADMIN', $roles)) {
                    $user->setRolApp('superadmin');
                }
            }
        }

        // Gestión de Centro
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            if ($centroId) {
                $centro = $entityManager->getRepository(Centro::class)->find($centroId);
                if ($centro) {
                    $user->setCentro($centro);
                }
            } elseif ($request->request->has('centro') && empty($centroId)) {
                if (!in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                     // Si no es superadmin, debe tener centro.
                } else {
                    $user->setCentro(null);
                }
            }
        } else {
            // Si es Admin, asignar su propio centro
            $currentUser = $this->getUser();
            if ($currentUser instanceof User && $currentUser->getCentro()) {
                $user->setCentro($currentUser->getCentro());
            }
        }

        // Avatar
        if ($avatarFile) {
            $originalFilename = pathinfo($avatarFile->getClientOriginalName(), PATHINFO_FILENAME);
            $safeFilename = preg_replace('/[^a-zA-Z0-9]/', '_', $originalFilename);
            $newFilename = $safeFilename.'-'.uniqid().'.'.$avatarFile->guessExtension();

            try {
                // Subir a MinIO usando Flysystem
                $stream = fopen($avatarFile->getRealPath(), 'r+');
                $storage->writeStream('avatar/' . $newFilename, $stream);
                fclose($stream);

                // Borrar avatar antiguo si existe
                if ($user->getFoto()) {
                    $oldPath = str_replace('/uploads/', '', $user->getFoto());
                    if ($storage->has($oldPath)) {
                        $storage->delete($oldPath);
                    }
                }

                $user->setFoto('/uploads/avatar/' . $newFilename);
            } catch (\Exception $e) {
                return $this->json(['message' => 'Error al subir avatar: ' . $e->getMessage()], 500);
            }
        }

        $entityManager->persist($user);
        $entityManager->flush();

        return $this->json([
            'message' => 'Usuario guardado correctamente',
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
                'nombre' => $user->getNombre(),
                'roles' => $user->getRoles(),
            ]
        ]);
    }
}
