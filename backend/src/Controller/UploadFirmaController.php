<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class UploadFirmaController extends AbstractController
{
    /**
     * Sube/actualiza la firma SVG del usuario autenticado.
     * Solo admins (ROLE_ADMIN o ROLE_SUPERADMIN) pueden tener firma.
     *
     * Body JSON: { "svg": "<svg ...>...</svg>" }
     */
    #[Route('/api/user/firma', name: 'api_user_firma_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $em,
        FilesystemOperator $storage
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        if (!in_array('ROLE_ADMIN', $user->getRoles()) && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return $this->json(['message' => 'Solo admins pueden registrar firma'], 403);
        }

        $payload = json_decode($request->getContent(), true) ?? [];
        $pngDataUri = $payload['png'] ?? null;

        if (!is_string($pngDataUri) || !str_starts_with($pngDataUri, 'data:image/png;base64,')) {
            return $this->json(['message' => 'PNG vacío o inválido'], 400);
        }

        $base64 = substr($pngDataUri, strlen('data:image/png;base64,'));
        $binary = base64_decode($base64, true);
        if ($binary === false) {
            return $this->json(['message' => 'PNG mal codificado'], 400);
        }

        // Validación: cabecera PNG (8 bytes mágicos)
        if (strncmp($binary, "\x89PNG\r\n\x1a\n", 8) !== 0) {
            return $this->json(['message' => 'No es un PNG válido'], 400);
        }

        if (strlen($binary) > 2 * 1024 * 1024) {
            return $this->json(['message' => 'La firma excede el tamaño máximo (2MB)'], 400);
        }

        // Borrar firma anterior si existía
        $oldFilename = $user->getFirma();
        if ($oldFilename) {
            try {
                if ($storage->has('firmas/' . $oldFilename)) {
                    $storage->delete('firmas/' . $oldFilename);
                }
            } catch (\Throwable $e) {
                // No crítico; continuamos con la nueva
            }
        }

        $filename = 'firma-' . $user->getId() . '-' . uniqid() . '.png';

        try {
            $storage->write('firmas/' . $filename, $binary);
        } catch (\Throwable $e) {
            return $this->json(['message' => 'Error al guardar la firma: ' . $e->getMessage()], 500);
        }

        $user->setFirma($filename);
        $em->flush();

        return $this->json([
            'message' => 'Firma guardada correctamente',
            'firma' => $filename,
        ]);
    }

    /**
     * Elimina la firma del usuario autenticado.
     */
    #[Route('/api/user/firma', name: 'api_user_firma_delete', methods: ['DELETE'])]
    public function delete(
        #[CurrentUser] ?User $user,
        EntityManagerInterface $em,
        FilesystemOperator $storage
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $filename = $user->getFirma();
        if ($filename) {
            try {
                if ($storage->has('firmas/' . $filename)) {
                    $storage->delete('firmas/' . $filename);
                }
            } catch (\Throwable $e) {
                // no crítico
            }
            $user->setFirma(null);
            $em->flush();
        }

        return $this->json(['message' => 'Firma eliminada']);
    }
}
