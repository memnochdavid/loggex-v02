<?php

namespace App\Controller;

use App\Entity\Entrega;
use App\Entity\Tarea;
use App\Entity\User;
use App\Service\FileUploadService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Psr\Log\LoggerInterface;

class UploadEntregaController extends AbstractController
{
    #[Route('/api/entregas/upload', name: 'api_entrega_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        #[CurrentUser] ?User $user,
        LoggerInterface $logger,
        FileUploadService $fileUpload
    ): JsonResponse
    {
        try {
            if (!$user) {
                return $this->json(['message' => 'No autenticado'], 401);
            }

            if (!in_array('ROLE_ALUMNO', $user->getRoles()) && !in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                return $this->json(['message' => 'Acceso denegado. Solo alumnos pueden realizar entregas.'], 403);
            }

            $file = $request->files->get('file');
            $comentario = $request->request->get('comentario');
            $enlace = $request->request->get('enlace');
            $tareaId = $request->request->get('tareaId');

            if (!$tareaId) {
                return $this->json(['message' => 'Falta el ID de la tarea'], 400);
            }

            $tareaIdClean = basename($tareaId);
            $tarea = $entityManager->getRepository(Tarea::class)->find($tareaIdClean);

            if (!$tarea) {
                return $this->json(['message' => 'Tarea no encontrada'], 404);
            }

            $entrega = $entityManager->getRepository(Entrega::class)->findOneBy([
                'tarea' => $tarea,
                'alumno' => $user
            ]);

            if (!$entrega) {
                $entrega = new Entrega();
                $entrega->setTarea($tarea);
                $entrega->setAlumno($user);
            }

            $entrega->setFechaEntrega(new \DateTime());
            if ($comentario !== null) $entrega->setComentarioAlumno($comentario);
            if ($enlace !== null) $entrega->setEnlace($enlace);

            if ($file) {
                try {
                    $newFilename = $fileUpload->uploadToStorage($file, 'entregas', $entrega->getArchivo());
                    $entrega->setArchivo($newFilename);
                } catch (\Exception $e) {
                    $logger->error('UploadEntrega: Error al subir archivo', ['error' => $e->getMessage()]);
                    return $this->json(['message' => 'Error al subir el archivo'], 500);
                }
            }

            $entityManager->persist($entrega);
            $entityManager->flush();

            return $this->json([
                'message' => 'Entrega realizada correctamente',
                'id' => $entrega->getId(),
                'archivo' => $entrega->getArchivo(),
                'fecha' => $entrega->getFechaEntrega()->format('c')
            ], 201);

        } catch (\Exception $e) {
            $logger->error('UploadEntrega: Excepción no controlada', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->json(['message' => 'Error interno del servidor'], 500);
        }
    }
}
