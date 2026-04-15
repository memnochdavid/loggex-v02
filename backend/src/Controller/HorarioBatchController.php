<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Imparticion;
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

        // Check de concurrencia: max(updatedAt) de horarios de imparticiones del grupo
        $currentMax = $this->maxUpdatedAtForGrupo($em, $grupoId);
        if ($baseline && $currentMax && $this->parseDate($currentMax) > $this->parseDate($baseline)) {
            return $this->json([
                'error' => 'concurrent_update',
                'currentMaxUpdatedAt' => $currentMax,
            ], 409);
        }

        $em->beginTransaction();
        try {
            $created = [];
            foreach ($operations as $idx => $op) {
                $kind = $op['op'] ?? null;
                if ($kind === 'delete') {
                    $h = $em->getRepository(Horario::class)->find($op['id'] ?? 0);
                    if ($h) {
                        // Soft delete coherente con el resto del sistema
                        $h->setDeleted(true);
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
                    $em->persist($h);
                    $em->flush();
                    $created[] = [
                        'clientKey' => $op['clientKey'] ?? null,
                        'id' => $h->getId(),
                    ];
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

        $newMax = $this->maxUpdatedAtForGrupo($em, $grupoId);
        return $this->json([
            'created' => $created,
            'maxUpdatedAt' => $newMax,
        ]);
    }

    private function maxUpdatedAtForGrupo(EntityManagerInterface $em, int $grupoId): ?string
    {
        $qb = $em->createQueryBuilder();
        $qb->select('MAX(h.updatedAt) AS m')
            ->from(Horario::class, 'h')
            ->join('h.imparticion', 'i')
            ->where('i.grupo = :g')
            ->setParameter('g', $grupoId);
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
