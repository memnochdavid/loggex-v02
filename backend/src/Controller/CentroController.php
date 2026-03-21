<?php

namespace App\Controller;

use App\Entity\Centro;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

#[IsGranted('ROLE_ADMIN')]
class CentroController extends AbstractController
{
    #[Route('/api/centro/create', name: 'api_centro_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $centro = new Centro();
        return $this->handleForm($centro, $request, $entityManager);
    }

    #[Route('/api/centro/{id}/update', name: 'api_centro_update', methods: ['POST'])]
    public function update(Centro $centro, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        return $this->handleForm($centro, $request, $entityManager);
    }

    private function handleForm(Centro $centro, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        // Obtener datos del formulario (multipart/form-data)
        $nombre = $request->request->get('nombre');
        $cif = $request->request->get('cif');
        $direccion = $request->request->get('direccion');
        $telefono = $request->request->get('telefono');
        $activo = $request->request->get('activo'); // Viene como string "true"/"false" o "1"/"0"

        $logoFile = $request->files->get('logo');

        // Validaciones básicas
        if (!$centro->getId() && (!$nombre || !$cif || !$direccion)) {
            return $this->json(['message' => 'Faltan campos obligatorios (nombre, cif, direccion)'], 400);
        }

        if ($nombre) $centro->setNombre($nombre);
        if ($cif) $centro->setCif($cif);
        if ($direccion) $centro->setDireccion($direccion);
        if ($telefono !== null) $centro->setTelefono($telefono);

        if ($activo !== null) {
            // Convertir string a boolean
            $isActive = filter_var($activo, FILTER_VALIDATE_BOOLEAN);
            $centro->setActivo($isActive);
        }

        if ($logoFile) {
            $destination = $this->getParameter('kernel.project_dir') . '/public/uploads/logo-centro';

            // Crear directorio si no existe
            if (!file_exists($destination)) {
                if (!@mkdir($destination, 0755, true) && !is_dir($destination)) {
                    return $this->json(['message' => 'Error al crear el directorio de destino'], 500);
                }
            }

            $originalFilename = pathinfo($logoFile->getClientOriginalName(), PATHINFO_FILENAME);
            $safeFilename = preg_replace('/[^a-zA-Z0-9]/', '_', $originalFilename);
            $newFilename = $safeFilename.'-'.uniqid().'.'.$logoFile->guessExtension();

            try {
                $logoFile->move($destination, $newFilename);
                $centro->setLogo($newFilename);
            } catch (\Exception $e) {
                return $this->json(['message' => 'Error al subir el logo'], 500);
            }
        }

        $entityManager->persist($centro);
        $entityManager->flush();

        return $this->json([
            'message' => 'Centro guardado correctamente',
            'centro' => [
                'id' => $centro->getId(),
                'nombre' => $centro->getNombre(),
                'cif' => $centro->getCif(),
                'direccion' => $centro->getDireccion(),
                'telefono' => $centro->getTelefono(),
                'activo' => $centro->isActivo(),
                'logo' => $centro->getLogo(),
            ]
        ]);
    }
}
