<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class HorarioBatchController extends AbstractController
{
    /**
     * Aplica un lote de creaciones / borrados sobre el horario de un grupo en
     * una única transacción. Si cualquier operación falla, se hace rollback.
     *
     * Body esperado:
     * {
     *   "grupoId": 5,
     *   "baselineMaxUpdatedAt": "2026-04-15T10:33:21+00:00", // opcional
     *   "operations": [
     *     {"op":"delete","id":42},
     *     {"op":"create","clientKey":"1_08:30:00","diaSemana":1,"horaInicio":"08:30","horaFin":"09:30","aula":"Aula 12","imparticion":17}
     *   ]
     * }
     *
     * Respuesta: { created: [{clientKey, id}], maxUpdatedAt: "..." }
     * En 409 (conflicto): { error: 'concurrent_update', currentMaxUpdatedAt: "..." }
     */
    #[Route('/api/v1/horarios/batch', name: 'api_horarios_batch', methods: ['POST'])]
    public function batch(Request $request, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['message' => 'JSON inválido'], 400);
        }

        $grupoId = $data['grupoId'] ?? null;
        $operations = $data['operations'] ?? [];
        $baseline = $data['baselineMaxUpdatedAt'] ?? null;
        $periodoLectivoId = $data['periodoLectivoId'] ?? null;

        if (!$grupoId) {
            return $this->json(['message' => 'grupoId requerido'], 400);
        }
        if (!is_array($operations)) {
            return $this->json(['message' => 'operations debe ser array'], 400);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        // PeriodoLectivo opcional: si viene, scope toda la operación a ese rango.
        // El frontend Fase 3a lo envía siempre; pre-Fase 3a se omitía y el
        // prePersist subscriber resuelve el rango activo.
        $periodoLectivo = null;
        if ($periodoLectivoId !== null) {
            $periodoLectivo = $em->getRepository(PeriodoLectivo::class)->find((int) $periodoLectivoId);
            if ($periodoLectivo === null || $periodoLectivo->getGrupo()?->getId() !== (int) $grupoId) {
                return $this->json(['message' => 'PeriodoLectivo no encontrado o no pertenece al grupo'], 422);
            }
        }

        // Check de concurrencia scoped al PL (si está set), sino a todo el grupo.
        $currentMax = $this->maxUpdatedAtForGrupo($em, (int) $grupoId, $periodoLectivo?->getId());
        if ($baseline && $currentMax && $this->parseDate($currentMax) > $this->parseDate($baseline)) {
            return $this->json([
                'error' => 'concurrent_update',
                'currentMaxUpdatedAt' => $currentMax,
            ], 409);
        }

        $em->beginTransaction();
        $touchedHorarioIds = [];  // Para resolver grupos hermanos tras el commit.
        try {
            $created = [];
            foreach ($operations as $idx => $op) {
                $kind = $op['op'] ?? null;
                if ($kind === 'delete') {
                    $h = $em->getRepository(Horario::class)->find($op['id'] ?? 0);
                    if ($h) {
                        // Soft delete coherente con el resto del sistema
                        $h->setDeleted(true);
                        $touchedHorarioIds[] = $h->getId();
                    }
                } elseif ($kind === 'create') {
                    $impId = $op['imparticion'] ?? null;
                    $imp = $impId ? $em->getRepository(Imparticion::class)->find($impId) : null;
                    if (!$imp) {
                        throw new \RuntimeException("Imparticion {$impId} no encontrada (op #$idx)");
                    }
                    if ($imp->getGrupo()?->getId() !== (int) $grupoId) {
                        throw new \RuntimeException("Imparticion {$impId} no pertenece al grupo $grupoId");
                    }
                    $h = new Horario();
                    $h->setDiaSemana((int) ($op['diaSemana'] ?? 0));
                    $h->setHoraInicio(new \DateTime($op['horaInicio'] ?? '00:00'));
                    $h->setHoraFin(new \DateTime($op['horaFin'] ?? '00:00'));
                    $h->setAula($op['aula'] ?? '');
                    $h->setImparticion($imp);
                    // Si el batch llega con periodoLectivoId, asignarlo aquí (más
                    // explícito que delegar al prePersist subscriber, que solo se
                    // dispara si el campo está null al persist).
                    if ($periodoLectivo !== null) {
                        $h->setPeriodoLectivo($periodoLectivo);
                    }
                    $em->persist($h);
                    $em->flush();
                    $created[] = [
                        'clientKey' => $op['clientKey'] ?? null,
                        'id' => $h->getId(),
                    ];
                    $touchedHorarioIds[] = $h->getId();
                } else {
                    throw new \RuntimeException("Operación desconocida: '$kind' (op #$idx)");
                }
            }
            $em->flush();
            $em->commit();
        } catch (\Throwable $e) {
            $em->rollback();
            return $this->json([
                'error' => 'batch_failed',
                'message' => $e->getMessage(),
            ], 500);
        }

        // Grupos hermanos cuya cache el frontend debe invalidar tras este
        // batch. Fase D `HorarioGemeloSyncSubscriber` propagó los cambios a
        // los placements gemelos en otros grupos, pero el editor de horarios
        // está excluido del sistema live updates por diseño (colisiona con
        // pendingTx). Devolvemos los IDs aquí para que el frontend invalide
        // sus caches de esos grupos al cambiar de grupo en el strip.
        // Doc: docs/hoja-de-ruta-clases-compartidas.md Fase D bitácora.
        $affectedGroups = $this->resolveAffectedGemeloGroups($em, $touchedHorarioIds, (int) $grupoId);

        $newMax = $this->maxUpdatedAtForGrupo($em, (int) $grupoId, $periodoLectivo?->getId());
        return $this->json([
            'created' => $created,
            'maxUpdatedAt' => $newMax,
            'affectedGroups' => $affectedGroups,
        ]);
    }

    /**
     * Para los Horarios tocados en el batch, devuelve los IDs únicos de los
     * grupos hermanos vivos (excluyendo el grupo del batch). Sirve al
     * frontend para invalidar la cache de esos grupos sin tener que pedir
     * un refetch global.
     *
     * @param list<int> $horarioIds
     * @return list<int>
     */
    private function resolveAffectedGemeloGroups(EntityManagerInterface $em, array $horarioIds, int $excludeGrupoId): array
    {
        if ($horarioIds === []) {
            return [];
        }
        // Hermanos = mismos del conjunto de hermandad, excluyendo el propio
        // placement. Conjunto plano (raíz + N copias): WHERE id = root OR
        // gemelo_id = root. Como root puede ser el propio horario o su
        // gemelo, resolvemos por dos JOINs OR.
        $sql = <<<'SQL'
SELECT DISTINCT i.grupo_id AS gid
FROM horario h_src
JOIN horario h_sib
  ON (
    h_sib.id = COALESCE(h_src.gemelo_id, h_src.id)
    OR h_sib.gemelo_id = COALESCE(h_src.gemelo_id, h_src.id)
  )
  AND h_sib.id != h_src.id
JOIN imparticion i ON i.id = h_sib.imparticion_id
WHERE h_src.id IN (:ids)
  AND i.grupo_id != :excludeGrupo
SQL;
        $rows = $em->getConnection()->executeQuery(
            $sql,
            ['ids' => $horarioIds, 'excludeGrupo' => $excludeGrupoId],
            ['ids' => \Doctrine\DBAL\ArrayParameterType::INTEGER]
        )->fetchAllAssociative();

        return array_values(array_unique(array_map(static fn ($r) => (int) $r['gid'], $rows)));
    }

    private function maxUpdatedAtForGrupo(EntityManagerInterface $em, int $grupoId, ?int $periodoLectivoId = null): ?string
    {
        $qb = $em->createQueryBuilder();
        $qb->select('MAX(h.updatedAt) AS m')
            ->from(Horario::class, 'h')
            ->join('h.imparticion', 'i')
            ->where('i.grupo = :g')
            ->setParameter('g', $grupoId);
        if ($periodoLectivoId !== null) {
            $qb->andWhere('h.periodoLectivo = :pl')
                ->setParameter('pl', $periodoLectivoId);
        }
        $r = $qb->getQuery()->getSingleScalarResult();
        if (!$r) return null;
        return $r instanceof \DateTimeInterface ? $r->format(\DateTime::ATOM) : (string) $r;
    }

    private function parseDate(string $s): \DateTimeImmutable
    {
        try { return new \DateTimeImmutable($s); }
        catch (\Throwable) { return new \DateTimeImmutable('1970-01-01'); }
    }
}
