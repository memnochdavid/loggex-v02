<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Temario;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\String\Slugger\SluggerInterface;

class UploadTemarioController extends AbstractController
{
    #[Route('/api/materiales/upload', name: 'api_material_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        SluggerInterface $slugger,
        #[CurrentUser] ?User $user,
        FilesystemOperator $storage
    ): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        // Verificar si es profesor (o admin)
        if (!in_array('ROLE_PROFESOR', $user->getRoles()) && !in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $file = $request->files->get('file');
        $titulo = $request->request->get('titulo');
        $imparticionId = $request->request->get('imparticionId');

        if (!$file || !$titulo || !$imparticionId) {
            return $this->json(['message' => 'Faltan datos requeridos (file, titulo, imparticionId)'], 400);
        }

        // Buscar impartición
        $imparticion = $entityManager->getRepository(Imparticion::class)->find($imparticionId);

        if (!$imparticion) {
            return $this->json(['message' => 'Impartición no encontrada'], 404);
        }

        // Verificar que el profesor imparte esta asignatura (si no es admin)
        if (!in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            if ($imparticion->getProfesor()->getId() !== $user->getId()) {
                return $this->json(['message' => 'No tienes permiso para subir material a esta asignatura'], 403);
            }
        }

        // Procesar archivo
        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $slugger->slug($originalFilename);
        $newFilename = $safeFilename.'-'.uniqid().'.'.$file->guessExtension();

        try {
            // Subir a MinIO usando Flysystem
            $stream = fopen($file->getRealPath(), 'r+');
            $storage->writeStream('materiales/' . $newFilename, $stream);
            fclose($stream);
        } catch (\Exception $e) {
            return $this->json(['message' => 'Error al subir el archivo: ' . $e->getMessage()], 500);
        }

        // Crear entidad Temario
        $temario = new Temario();
        $temario->setTitulo($titulo);
        $temario->setArchivo($newFilename);
        $temario->setFechaSubida(new \DateTime());
        $temario->setImparticion($imparticion);

        $entityManager->persist($temario);
        $entityManager->flush();

        return $this->json([
            'message' => 'Temario subido correctamente',
            'id' => $temario->getId(),
            'archivo' => $newFilename
        ], 201);
    }
}
