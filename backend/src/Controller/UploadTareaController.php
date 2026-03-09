<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Tarea;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\String\Slugger\SluggerInterface;
use Psr\Log\LoggerInterface;

class UploadTareaController extends AbstractController
{
    #[Route('/api/tareas/upload', name: 'api_tarea_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        SluggerInterface $slugger,
        #[CurrentUser] ?User $user,
        LoggerInterface $logger,
        FilesystemOperator $storage
    ): JsonResponse
    {
        try {
            if (!$user) {
                return $this->json(['message' => 'No autenticado'], 401);
            }

            // Verificar permisos (Profesor o Admin)
            if (!in_array('ROLE_PROFESOR', $user->getRoles()) && !in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                return $this->json(['message' => 'Acceso denegado'], 403);
            }

            $file = $request->files->get('file');
            $titulo = $request->request->get('titulo');
            $descripcion = $request->request->get('descripcion');
            $fechaLimiteStr = $request->request->get('fechaLimite');
            $tipo = $request->request->get('tipo');
            $visible = $request->request->get('visible') === 'true';
            $imparticionId = $request->request->get('imparticionId');
            $tareaId = $request->request->get('id'); // Si viene ID, es edición

            $logger->info('UploadTarea: Datos recibidos', [
                'titulo' => $titulo,
                'fechaLimite' => $fechaLimiteStr,
                'imparticionId' => $imparticionId,
                'tareaId' => $tareaId,
                'hasFile' => $file ? 'yes' : 'no'
            ]);

            if (!$titulo || !$fechaLimiteStr || !$tipo || !$imparticionId) {
                return $this->json(['message' => 'Faltan datos requeridos'], 400);
            }

            // Buscar impartición
            $imparticionIdClean = basename($imparticionId);
            $imparticion = $entityManager->getRepository(Imparticion::class)->find($imparticionIdClean);

            if (!$imparticion) {
                return $this->json(['message' => 'Impartición no encontrada: ' . $imparticionIdClean], 404);
            }

            // Verificar propiedad de la impartición
            if (!in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                if ($imparticion->getProfesor()->getId() !== $user->getId()) {
                    return $this->json(['message' => 'No tienes permiso para crear tareas en esta asignatura'], 403);
                }
            }

            $tarea = null;
            if ($tareaId) {
                $tarea = $entityManager->getRepository(Tarea::class)->find($tareaId);
                if (!$tarea) {
                    return $this->json(['message' => 'Tarea no encontrada para editar'], 404);
                }
            } else {
                $tarea = new Tarea();
                $tarea->setImparticion($imparticion);
            }

            $tarea->setTitulo($titulo);
            $tarea->setDescripcion($descripcion);
            $tarea->setTipo($tipo);
            $tarea->setVisible($visible);

            try {
                $fechaLimite = new \DateTime($fechaLimiteStr);
                $tarea->setFechaLimite($fechaLimite);
            } catch (\Exception $e) {
                return $this->json(['message' => 'Formato de fecha inválido: ' . $fechaLimiteStr], 400);
            }

            // Procesar archivo si existe
            if ($file) {
                $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                $safeFilename = $slugger->slug($originalFilename);
                $newFilename = $safeFilename.'-'.uniqid().'.'.$file->guessExtension();

                try {
                    // Subir a MinIO usando Flysystem
                    $stream = fopen($file->getRealPath(), 'r+');
                    $storage->writeStream('tareas/' . $newFilename, $stream);
                    fclose($stream);

                    // Borrar archivo antiguo si existe
                    if ($tarea->getArchivo()) {
                        $oldPath = 'tareas/' . $tarea->getArchivo();
                        if ($storage->has($oldPath)) {
                            $storage->delete($oldPath);
                        }
                    }

                    $tarea->setArchivo($newFilename);
                } catch (\Exception $e) {
                    $logger->error('UploadTarea: Error al subir archivo', ['error' => $e->getMessage()]);
                    return $this->json(['message' => 'Error al subir el archivo: ' . $e->getMessage()], 500);
                }
            }

            $entityManager->persist($tarea);
            $entityManager->flush();

            return $this->json([
                'message' => 'Tarea guardada correctamente',
                'id' => $tarea->getId(),
                'archivo' => $tarea->getArchivo()
            ], 201);

        } catch (\Exception $e) {
            $logger->error('UploadTarea: Excepción no controlada', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->json(['message' => 'Error interno del servidor: ' . $e->getMessage()], 500);
        }
    }
}
