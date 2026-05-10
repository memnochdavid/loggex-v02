<?php

namespace App\Controller;

use App\Entity\Catalogo\CatalogoCentro;
use App\Entity\Ccaa;
use App\Entity\Centro;
use App\Entity\EtapaEducativa;
use App\Entity\Provincia;
use App\Service\CalendarioLectivoService;
use App\Service\CentroFestivoSyncService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

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

        // CCAA: string vacío → null. Valor → enum.
        if ($request->request->has('ccaa')) {
            $ccaaCode = $request->request->get('ccaa');
            $centro->setCcaa($ccaaCode ? Ccaa::tryFrom($ccaaCode) : null);
        }

        // Provincia: código INE (string) → entidad. Vacío → null.
        if ($request->request->has('provincia')) {
            $provCode = $request->request->get('provincia');
            $provincia = $provCode
                ? $entityManager->getRepository(Provincia::class)->find($provCode)
                : null;
            $centro->setProvincia($provincia);
        }

        // Trazabilidad al catálogo oficial. Solo en alta (no se permite cambiar
        // el origen de un centro existente — daría falso positivo de "lo
        // creé desde catálogo" cuando en realidad fue manual).
        if (!$centro->getId() && $request->request->has('catalogoOrigenId')) {
            $catId = $request->request->get('catalogoOrigenId');
            if ($catId) {
                $cat = $entityManager->getRepository(CatalogoCentro::class)->find((int) $catId);
                if ($cat) {
                    $centro->setCatalogoOrigen($cat);
                }
            }
        }

        // Fechas del curso académico (override del calendario CCAA). Vacío → null.
        if ($request->request->has('fechaInicioCurso')) {
            $v = $request->request->get('fechaInicioCurso');
            $centro->setFechaInicioCurso($v ? new \DateTime($v) : null);
        }
        if ($request->request->has('fechaFinCurso')) {
            $v = $request->request->get('fechaFinCurso');
            $centro->setFechaFinCurso($v ? new \DateTime($v) : null);
        }

        if ($logoFile) {
            $destination = $this->getParameter('kernel.project_dir') . '/public/uploads/logo-centro';

            // Crear directorio si no existe
            if (!file_exists($destination)) {
                if (!@mkdir($destination, 0777, true) && !is_dir($destination)) {
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
                return $this->json(['message' => 'Error al subir el logo: ' . $e->getMessage()], 500);
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
                'ccaa' => $centro->getCcaa()?->value,
                'provincia' => $centro->getProvincia()?->getCodigo(),
                'fechaInicioCurso' => $centro->getFechaInicioCurso()?->format('Y-m-d'),
                'fechaFinCurso' => $centro->getFechaFinCurso()?->format('Y-m-d'),
                'catalogoOrigen' => $centro->getCatalogoOrigen()?->getId(),
            ]
        ]);
    }

    /**
     * Devuelve semanas y días lectivos REALES del centro descontando festivos
     * aplicables. Cascada: override query > Centro.fechaInicio/FinCurso >
     * CalendarioEscolarCcaa(centro.ccaa, anio, etapa) > fallback.
     *
     *   GET /api/v1/centros/{id}/semanas-lectivas
     *     ?etapa=fp                (opcional, default fp)
     *     &anio=2025-2026          (opcional, default curso actual)
     *     &fechaInicio=YYYY-MM-DD  (opcional, override de la ventana)
     *     &fechaFin=YYYY-MM-DD     (opcional)
     */
    /**
     * Sincroniza los festivos aplicables al centro a partir de los JSONs
     * curados en MinIO (BOE laboral + Resolución BOJA escolar autonómica).
     * Idempotente — corre tantas veces como haga falta sin duplicar filas.
     *
     *   POST /api/v1/centros/{id}/sync-festivos
     */
    #[Route('/api/v1/centros/{id}/sync-festivos', name: 'api_centro_sync_festivos', methods: ['POST'])]
    public function syncFestivos(Centro $centro, CentroFestivoSyncService $service): JsonResponse
    {
        $stats = $service->sync($centro);
        return $this->json($stats);
    }

    #[Route('/api/v1/centros/{id}/semanas-lectivas', name: 'api_centro_semanas_lectivas', methods: ['GET'])]
    public function semanasLectivas(Centro $centro, Request $request, CalendarioLectivoService $service): JsonResponse
    {
        $etapaCode = $request->query->get('etapa', 'fp');
        $etapa = EtapaEducativa::tryFrom(strtolower((string) $etapaCode));
        $anio = $request->query->get('anio');
        $finiQ = $request->query->get('fechaInicio');
        $ffinQ = $request->query->get('fechaFin');

        $r = $service->semanasLectivas(
            $centro,
            $etapa,
            $finiQ ? new \DateTime($finiQ) : null,
            $ffinQ ? new \DateTime($ffinQ) : null,
            $anio,
        );

        return $this->json([
            'semanas' => $r['semanas'],
            'diasLectivos' => $r['diasLectivos'],
            'fechaInicio' => $r['fechaInicio']?->format('Y-m-d'),
            'fechaFin' => $r['fechaFin']?->format('Y-m-d'),
            'origen' => $r['origen'],
        ]);
    }
}
