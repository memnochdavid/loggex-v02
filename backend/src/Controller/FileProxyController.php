<?php

namespace App\Controller;

use App\Entity\Entrega;
use App\Entity\Imparticion;
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
    /**
     * Recursos protegidos: la URL incluye el id de la entidad para autorizar de forma exacta.
     * Formato: /uploads/{type}/{id}/{filename}
     */
    #[Route('/uploads/{type}/{id}/{filename}', name: 'api_file_proxy_protected', requirements: ['type' => 'tareas|materiales|entregas|firmas', 'id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    public function serveProtected(
        string $type,
        int $id,
        string $filename,
        FilesystemOperator $storage,
        RequestStack $requestStack,
        EntityManagerInterface $em
    ): Response {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }

        $storedFilename = null;

        if ($type === 'materiales') {
            /** @var Material|null $material */
            $material = $em->getRepository(Material::class)->find($id);
            if (!$material) {
                throw $this->createNotFoundException();
            }
            if (!$this->canAccessImparticion($user, $material->getImparticion())) {
                throw $this->createAccessDeniedException('No tienes permiso para acceder a este material.');
            }
            $storedFilename = $material->getArchivo();
        } elseif ($type === 'tareas') {
            /** @var Tarea|null $tarea */
            $tarea = $em->getRepository(Tarea::class)->find($id);
            if (!$tarea) {
                throw $this->createNotFoundException();
            }
            if (!$this->canAccessImparticion($user, $tarea->getImparticion())) {
                throw $this->createAccessDeniedException('No tienes permiso para acceder a esta tarea.');
            }
            $storedFilename = $tarea->getArchivo();
        } elseif ($type === 'firmas') {
            /** @var User|null $owner */
            $owner = $em->getRepository(User::class)->find($id);
            if (!$owner) {
                throw $this->createNotFoundException();
            }
            // Cualquier usuario autenticado puede ver la firma (aparece incrustada en boletines).
            $storedFilename = $owner->getFirma();
        } elseif ($type === 'entregas') {
            /** @var Entrega|null $entrega */
            $entrega = $em->getRepository(Entrega::class)->find($id);
            if (!$entrega) {
                throw $this->createNotFoundException();
            }
            $isOwner = $entrega->getAlumno()->getId() === $user->getId();
            $isTeacher = $entrega->getTarea()->getImparticion()->getProfesor()->getId() === $user->getId();
            if (!$isOwner && !$isTeacher && !$this->isGranted('ROLE_ADMIN')) {
                throw $this->createAccessDeniedException('No tienes permiso para ver esta entrega.');
            }
            $storedFilename = $entrega->getArchivo();
        }

        // El filename de la URL debe coincidir con el almacenado (defensa frente a manipulación)
        if ($storedFilename === null || $storedFilename !== $filename) {
            throw $this->createNotFoundException('El archivo no existe.');
        }

        return $this->streamFile($type, $filename, $storage, $requestStack);
    }

    /**
     * Recursos semi-públicos (avatares y logos de centro): solo requieren estar autenticado.
     * Formato: /uploads/{type}/{filename}
     */
    #[Route('/uploads/{type}/{filename}', name: 'api_file_proxy_public', requirements: ['type' => 'avatar|logo-centro'])]
    #[IsGranted('ROLE_USER')]
    public function servePublic(
        string $type,
        string $filename,
        FilesystemOperator $storage,
        RequestStack $requestStack
    ): Response {
        return $this->streamFile($type, $filename, $storage, $requestStack);
    }

    private function streamFile(string $type, string $filename, FilesystemOperator $storage, RequestStack $requestStack): Response
    {
        $path = $type . '/' . $filename;

        if (!$storage->has($path)) {
            throw $this->createNotFoundException('El archivo no existe.');
        }

        $mimeType = $storage->mimeType($path);
        $lastModified = $storage->lastModified($path);
        $fileSize = $storage->fileSize($path);

        $response = new StreamedResponse();
        $response->setPublic();
        $response->setMaxAge(3600);
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

    private function canAccessImparticion(User $user, ?Imparticion $imparticion): bool
    {
        if (!$imparticion) return false;
        if ($this->isGranted('ROLE_ADMIN')) return true;

        if ($imparticion->getProfesor() && $imparticion->getProfesor()->getId() === $user->getId()) {
            return true;
        }

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
