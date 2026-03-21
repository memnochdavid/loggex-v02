<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Material;
use App\Entity\User;
use App\Service\FileUploadService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class UploadMaterialController extends AbstractController
{
    #[Route('/api/materiales/upload', name: 'api_material_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        #[CurrentUser] ?User $user,
        FileUploadService $fileUpload
    ): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        if (!in_array('ROLE_PROFESOR', $user->getRoles()) && !in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $file = $request->files->get('file');
        $titulo = $request->request->get('titulo');
        $imparticionId = $request->request->get('imparticionId');

        if (!$file || !$titulo || !$imparticionId) {
            return $this->json(['message' => 'Faltan datos requeridos (file, titulo, imparticionId)'], 400);
        }

        $imparticion = $entityManager->getRepository(Imparticion::class)->find($imparticionId);

        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        if (!in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            if ($imparticion->getProfesor()->getId() !== $user->getId()) {
                return $this->json(['message' => 'No tienes permiso para subir material a esta asignatura'], 403);
            }
        }

        try {
            $newFilename = $fileUpload->uploadToStorage($file, 'materiales');
        } catch (\Exception $e) {
            return $this->json(['message' => 'Error al subir el archivo'], 500);
        }

        $material = new Material();
        $material->setTitulo($titulo);
        $material->setArchivo($newFilename);
        $material->setFechaSubida(new \DateTime());
        $material->setImparticion($imparticion);

        $entityManager->persist($material);
        $entityManager->flush();

        return $this->json([
            'message' => 'Material subido correctamente',
            'id' => $material->getId(),
            'archivo' => $newFilename
        ], 201);
    }
}
