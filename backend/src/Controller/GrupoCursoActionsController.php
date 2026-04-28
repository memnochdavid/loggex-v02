<?php

namespace App\Controller;

use App\Entity\Grupo;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Acciones de "curso" para un grupo: operaciones masivas que afectan a todos
 * los `PeriodoLectivo` (rangos) del grupo y sus `Horario`s/`PLI`s.
 *
 * Estas operaciones existen porque desde la UI el admin puede querer:
 *  - Limpiar un grupo entero (borrar todos sus rangos para empezar de cero).
 *  - Crear un set recomendado de rangos (ver `replace-rangos`, no en este
 *    controller — eso lo orquesta el frontend con los endpoints existentes
 *    de `/api/periodo_lectivos`).
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §6 (Acciones del curso).
 */
class GrupoCursoActionsController extends AbstractController
{
    /**
     * Borra TODOS los `PeriodoLectivo` del grupo. La FK `Horario.periodoLectivo`
     * y `PLI.periodoLectivo` están en CASCADE → al borrar el PL se borran sus
     * horarios y PLIs automáticamente a nivel BD. Hard-delete: el grupo queda
     * sin rangos hasta que el admin cree uno nuevo (la UI bloquea el editor
     * mientras tanto).
     */
    #[Route(
        '/api/v1/grupos/{grupoId}/clear-rangos',
        name: 'api_grupos_clear_rangos',
        methods: ['DELETE'],
        requirements: ['grupoId' => '\d+']
    )]
    public function clearRangos(int $grupoId, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $conn = $em->getConnection();
        // Hard-DELETE de PLs del grupo. Cascade DB borra horarios y PLIs.
        $deleted = $conn->executeStatement(
            'DELETE FROM periodo_lectivo WHERE grupo_id = :gid',
            ['gid' => $grupoId]
        );

        return $this->json([
            'ok' => true,
            'rangosBorrados' => $deleted,
        ]);
    }
}
