<?php

namespace App\Controller;

use App\Entity\Entrega;
use App\Entity\Material;
use App\Entity\Tarea;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class FileProxyController extends AbstractController
{
    #[Route('/uploads/{type}/{filename}', name: 'api_file_proxy', requirements: ['type' => 'avatar|tareas|materiales|entregas|logo-centro'])]
    #[IsGranted('ROLE_USER')] // Mínimo estar autenticado
    public function serveFile(
        string $type,
        string $filename,
        FilesystemOperator $storage,
        RequestStack $requestStack,
        EntityManagerInterface $entityManager
    ): Response {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }

        // --- LÓGICA DE SEGURIDAD POR TIPO ---

        if ($type === 'materiales') {
            $material = $entityManager->getRepository(Material::class)->findOneBy(['archivo' => $filename]);
            if ($material) {
                $imparticion = $material->getImparticion();
                if (!$this->canAccessImparticion($user, $imparticion)) {
                    throw $this->createAccessDeniedException('No tienes permiso para acceder a este material.');
                }
            }
        }

        if ($type === 'tareas') {
            $tarea = $entityManager->getRepository(Tarea::class)->findOneBy(['archivo' => $filename]);
            if ($tarea) {
                $imparticion = $tarea->getImparticion();
                if (!$this->canAccessImparticion($user, $imparticion)) {
                    throw $this->createAccessDeniedException('No tienes permiso para acceder a esta tarea.');
                }
            }
        }

        if ($type === 'entregas') {
            $entrega = $entityManager->getRepository(Entrega::class)->findOneBy(['archivo' => $filename]);
            if ($entrega) {
                // El alumno dueño de la entrega o el profesor de la asignatura
                $isOwner = $entrega->getAlumno()->getId() === $user->getId();
                $isTeacher = $entrega->getTarea()->getImparticion()->getProfesor()->getId() === $user->getId();

                if (!$isOwner && !$isTeacher && !$this->isGranted('ROLE_ADMIN')) {
                    throw $this->createAccessDeniedException('No tienes permiso para ver esta entrega.');
                }
            }
        }

        // (Avatares y logos se permiten a cualquier ROLE_USER por ahora)

        // --- SERVIR EL ARCHIVO (Igual que antes) ---

        $path = $type . '/' . $filename;

        if (!$storage->has($path)) {
            throw $this->createNotFoundException('El archivo no existe.');
        }

        $mimeType = $storage->mimeType($path);
        $lastModified = $storage->lastModified($path);
        $fileSize = $storage->fileSize($path);

        $response = new StreamedResponse();
        $response->setPublic();
        $response->setMaxAge(3600); // 1 hora de caché para archivos protegidos
        $response->setLastModified((new \DateTime())->setTimestamp($lastModified));
        $response->setEtag(md5($path . $fileSize . $lastModified));

        if ($response->isNotModified($requestStack->getCurrentRequest())) {
            return $response;
        }

        $stream = $storage->readStream($path);
        $response->setCallback(function () use ($stream) {
            fpassthru($stream);
            fclose($stream);
        });

        $response->headers->set('Content-Type', $mimeType);
        $response->headers->set('Content-Disposition', 'inline; filename="' . $filename . '"');
        $response->headers->set('Content-Length', $fileSize);

        return $response;
    }

    /**
     * Helper para verificar si un usuario tiene acceso a una impartición (asignatura)
     */
    private function canAccessImparticion(User $user, $imparticion): bool
    {
        if ($this->isGranted('ROLE_ADMIN')) return true;

        // Si es el profesor de la asignatura
        if ($imparticion->getProfesor() && $imparticion->getProfesor()->getId() === $user->getId()) {
            return true;
        }

        // Si es un alumno matriculado en el grupo de la asignatura
        $grupo = $imparticion->getGrupo();
        if ($grupo) {
            foreach ($user->getMatriculas() as $matricula) {
                if ($matricula->getGrupo()->getId() === $grupo->getId()) {
                    return true;
                }
            }
        }

        return false;
    }
}
