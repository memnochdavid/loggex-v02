<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * "Adjuntar a grupo existente" — Fase A clases-compartidas.
 *
 * Replica el horario completo (PLs + PLIs + Horarios) de un grupo origen a un
 * grupo destino, mapeando las imparticiones por `materia.id`. Caso de uso real
 * (EAG, RD 405/2023): 1º DAW + 1º DAM comparten currículo LOMLOE — el admin
 * configura el horario en DAW y lo "adjunta" a DAM con un solo click.
 *
 * Premisa M:N validada en MVP previo (commit 6dd6e7c): las materias pueden
 * pertenecer a varios itinerarios. El destino debe tener imparticiones
 * apuntando a las mismas materias que el origen para que el mapeo funcione.
 *
 * Comportamiento ante materias no compartidas (decisión de sesión 2026-05-08):
 *   - Skip silencioso, reportar en stats finales (`materiasOmitidas[]`).
 *   - El admin añade esas materias al itinerario destino y vuelve a adjuntar
 *     si quiere unificarlas también.
 *
 * Comportamiento ante destino con PLs vivos (decisión de sesión 2026-05-08):
 *   - Si `cleanFirst=false` y destino tiene PLs vivos → 409 Conflict.
 *   - Si `cleanFirst=true` → soft-delete horarios + PLIs + PLs del destino
 *     antes del clonado, todo en la misma transacción.
 *
 * Doc: docs/hoja-de-ruta-clases-compartidas.md (Fase A).
 */
class AdjuntarGrupoController extends AbstractController
{
    /**
     * Preview sin tocar BD: devuelve qué cambiaría al adjuntar el origen al
     * destino. Stats: PLs/PLIs/horarios a clonar, materias compartidas vs
     * omitidas, profesores en discrepancia, si el destino tiene horario que
     * sería sobrescrito.
     */
    #[Route(
        '/api/v1/grupos/{destinoId}/adjuntar-preview/{origenId}',
        name: 'api_grupos_adjuntar_preview',
        methods: ['GET'],
        requirements: ['destinoId' => '\d+', 'origenId' => '\d+']
    )]
    public function preview(int $destinoId, int $origenId, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        [$destino, $origen, $err] = $this->loadPair($em, $destinoId, $origenId);
        if ($err) return $this->json(['message' => $err['msg']], $err['code']);

        $impMapDest = $this->buildImpMap($em, $destino);
        $impMapOrig = $this->buildImpMap($em, $origen);

        $plsOrigen = $this->fetchPlsVivos($em, $origen);
        $plsDestino = $this->fetchPlsVivos($em, $destino);

        $horariosOrigen = $em->getRepository(Horario::class)->createQueryBuilder('h')
            ->innerJoin('h.imparticion', 'i')
            ->andWhere('i.grupo = :g')
            ->andWhere('h.deleted = false')
            ->setParameter('g', $origen)
            ->getQuery()->getResult();

        $stats = $this->computeDiff($plsOrigen, $horariosOrigen, $impMapOrig, $impMapDest);
        $stats['destinoTienePls']      = count($plsDestino) > 0;
        $stats['destinoNumPls']        = count($plsDestino);
        $stats['origenNumPls']         = count($plsOrigen);
        $stats['origenNumHorarios']    = count($horariosOrigen);
        $stats['centroId']             = $origen->getCentro()?->getId();

        return $this->json($stats);
    }

    /**
     * Ejecuta el clonado origen→destino. Body: `{cleanFirst: bool}`. Devuelve
     * stats reales tras la operación.
     */
    #[Route(
        '/api/v1/grupos/{destinoId}/adjuntar-a/{origenId}',
        name: 'api_grupos_adjuntar_a',
        methods: ['POST'],
        requirements: ['destinoId' => '\d+', 'origenId' => '\d+']
    )]
    public function adjuntar(int $destinoId, int $origenId, Request $request, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        [$destino, $origen, $err] = $this->loadPair($em, $destinoId, $origenId);
        if ($err) return $this->json(['message' => $err['msg']], $err['code']);

        $body = json_decode($request->getContent() ?: '{}', true);
        $cleanFirst = (bool) ($body['cleanFirst'] ?? false);

        $plsDestVivos = $this->fetchPlsVivos($em, $destino);
        if (!empty($plsDestVivos) && !$cleanFirst) {
            return $this->json([
                'message'      => 'El grupo destino ya tiene PLs vivos. Pasa cleanFirst=true para reemplazar.',
                'destinoNumPls' => count($plsDestVivos),
            ], 409);
        }

        $impMapDest = $this->buildImpMap($em, $destino);
        if (empty($impMapDest)) {
            return $this->json([
                'message' => 'El grupo destino no tiene imparticiones; nada que mapear. Crea las imparticiones del grupo antes (ver "Aplicar overlay CCAA" en /admin/itinerarios).',
            ], 422);
        }

        $em->getConnection()->beginTransaction();
        try {
            $stats = [
                'plsCreados'        => 0,
                'plisCreados'       => 0,
                'horariosCreados'   => 0,
                'materiasOmitidas'  => [],
                'profeMismatch'     => [],
                'destinoLimpiado'   => false,
            ];

            // 1. Limpiar destino si procede. Soft-delete cascadeable a mano:
            //    horarios → PLIs → PLs (orden inverso al de creación).
            if ($cleanFirst && !empty($plsDestVivos)) {
                $this->softDeleteDestino($em, $destino);
                $stats['destinoLimpiado'] = true;
                $em->flush();
            }

            // 2. Clonar PLs en dos pasadas: PLANTILLAs primero (para que las
            //    SEMANAs puedan apuntar a `plantillaBase` ya persistida).
            $plsOrigen = $this->fetchPlsVivos($em, $origen);
            $mapPl = []; // origenPlId → destino PL entity

            foreach ($plsOrigen as $plOrig) {
                if (!$plOrig->isPlantilla()) continue;
                $plDest = $this->clonePl($plOrig, $destino, null);
                $em->persist($plDest);
                $mapPl[$plOrig->getId()] = $plDest;
                $stats['plsCreados']++;
            }
            $em->flush();

            foreach ($plsOrigen as $plOrig) {
                if ($plOrig->isPlantilla()) continue;  // ya hechos
                $plantillaBaseDest = null;
                $pbOrig = $plOrig->getPlantillaBase();
                if ($pbOrig !== null) {
                    $plantillaBaseDest = $mapPl[$pbOrig->getId()] ?? null;
                }
                $plDest = $this->clonePl($plOrig, $destino, $plantillaBaseDest);
                $em->persist($plDest);
                $mapPl[$plOrig->getId()] = $plDest;
                $stats['plsCreados']++;
            }
            $em->flush();

            // 3. PLIs y horarios por cada PL clonado.
            $impMapOrig = $this->buildImpMap($em, $origen);
            foreach ($plsOrigen as $plOrig) {
                $plDest = $mapPl[$plOrig->getId()] ?? null;
                if ($plDest === null) continue;

                foreach ($plOrig->getImparticiones() as $pliOrig) {
                    if ($pliOrig->isDeleted()) continue;
                    $impOrig = $pliOrig->getImparticion();
                    $matId = $impOrig?->getMateria()?->getId();
                    $impDest = $matId !== null ? ($impMapDest[$matId] ?? null) : null;
                    if ($impDest === null) {
                        $this->trackOmitida($stats, $impOrig, $matId);
                        continue;
                    }
                    $this->trackProfeMismatch($stats, $impOrig, $impDest);
                    $pliDest = (new PeriodoLectivoImparticion())
                        ->setPeriodoLectivo($plDest)
                        ->setImparticion($impDest)
                        ->setMinutosSemanales($pliOrig->getMinutosSemanales());
                    $em->persist($pliDest);
                    $stats['plisCreados']++;
                }

                $horariosPl = $em->getRepository(Horario::class)->createQueryBuilder('h')
                    ->andWhere('h.periodoLectivo = :pl')
                    ->andWhere('h.deleted = false')
                    ->setParameter('pl', $plOrig)
                    ->getQuery()->getResult();
                foreach ($horariosPl as $hOrig) {
                    $impOrig = $hOrig->getImparticion();
                    $matId = $impOrig?->getMateria()?->getId();
                    $impDest = $matId !== null ? ($impMapDest[$matId] ?? null) : null;
                    if ($impDest === null) continue;
                    $hDest = (new Horario())
                        ->setDiaSemana($hOrig->getDiaSemana())
                        ->setHoraInicio($hOrig->getHoraInicio())
                        ->setHoraFin($hOrig->getHoraFin())
                        ->setImparticion($impDest)
                        ->setPeriodoLectivo($plDest);
                    if ($hOrig->getAula()) {
                        $hDest->setAula($hOrig->getAula());
                    }
                    $em->persist($hDest);
                    $stats['horariosCreados']++;
                }
            }
            $em->flush();

            $stats['materiasOmitidas'] = $this->dedupeByMateriaId($stats['materiasOmitidas']);
            $stats['profeMismatch']    = $this->dedupeByMateriaId($stats['profeMismatch']);

            $em->getConnection()->commit();
            return $this->json([
                'success' => true,
                'stats'   => $stats,
            ]);
        } catch (\Throwable $e) {
            $em->getConnection()->rollBack();
            return $this->json([
                'success' => false,
                'message' => 'Error durante el clonado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @return array{0: ?Grupo, 1: ?Grupo, 2: ?array{msg: string, code: int}}
     */
    private function loadPair(EntityManagerInterface $em, int $destinoId, int $origenId): array
    {
        if ($destinoId === $origenId) {
            return [null, null, ['msg' => 'destino y origen no pueden ser el mismo grupo', 'code' => 422]];
        }
        $destino = $em->getRepository(Grupo::class)->find($destinoId);
        $origen  = $em->getRepository(Grupo::class)->find($origenId);
        if (!$destino || $destino->isDeleted()) {
            return [null, null, ['msg' => 'Grupo destino no encontrado', 'code' => 404]];
        }
        if (!$origen || $origen->isDeleted()) {
            return [null, null, ['msg' => 'Grupo origen no encontrado', 'code' => 404]];
        }
        $cD = $destino->getCentro()?->getId();
        $cO = $origen->getCentro()?->getId();
        if ($cD === null || $cO === null || $cD !== $cO) {
            return [null, null, ['msg' => 'Los grupos deben pertenecer al mismo centro', 'code' => 422]];
        }
        return [$destino, $origen, null];
    }

    /**
     * Mapa `materiaId → Imparticion` para las imparticiones vivas del grupo.
     * Si una materia tiene varias imparticiones en el mismo grupo (caso raro,
     * normalmente significa duplicado), gana la primera y el resto queda fuera.
     *
     * @return array<int, Imparticion>
     */
    private function buildImpMap(EntityManagerInterface $em, Grupo $g): array
    {
        $imps = $em->getRepository(Imparticion::class)->createQueryBuilder('i')
            ->andWhere('i.grupo = :g')
            ->andWhere('i.deleted = false')
            ->setParameter('g', $g)
            ->getQuery()->getResult();
        $map = [];
        foreach ($imps as $imp) {
            $matId = $imp->getMateria()?->getId();
            if ($matId !== null && !isset($map[$matId])) {
                $map[$matId] = $imp;
            }
        }
        return $map;
    }

    /**
     * @return list<PeriodoLectivo>
     */
    private function fetchPlsVivos(EntityManagerInterface $em, Grupo $g): array
    {
        return $em->getRepository(PeriodoLectivo::class)->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :g')
            ->andWhere('pl.deleted = false')
            ->orderBy('pl.tipo', 'ASC')      // PLANTILLA ('plantilla') antes que SEMANA ('semana') alfabéticamente.
            ->addOrderBy('pl.orden', 'ASC')
            ->addOrderBy('pl.fechaInicio', 'ASC')
            ->setParameter('g', $g)
            ->getQuery()->getResult();
    }

    /**
     * Crea PL nuevo asociado a `$grupoDest`, copiando los campos del origen.
     * Para SEMANAs, `$plantillaBaseDest` debe ser la PLANTILLA correspondiente
     * ya persistida en el destino (recién clonada).
     */
    private function clonePl(PeriodoLectivo $orig, Grupo $grupoDest, ?PeriodoLectivo $plantillaBaseDest): PeriodoLectivo
    {
        $dest = (new PeriodoLectivo())
            ->setGrupo($grupoDest)
            ->setNombre($orig->getNombre() ?? '')
            ->setTipo($orig->getTipo())
            ->setOrden($orig->getOrden())
            ->setFechaInicio($orig->getFechaInicio())
            ->setFechaFin($orig->getFechaFin())
            ->setJornadaTipo($orig->getJornadaTipo())
            ->setSemanaNumero($orig->getSemanaNumero());
        if ($plantillaBaseDest !== null) {
            $dest->setPlantillaBase($plantillaBaseDest);
        }
        return $dest;
    }

    /**
     * Soft-delete del horario completo del destino: horarios → PLIs → PLs.
     * Orden importante para evitar romper invariantes durante el flush.
     *
     * `setDeleted(true)` del SoftDeletableTrait ya pone `deletedAt = new \DateTime()`
     * (mutable, coherente con el `type: 'datetime'` de la columna). No llamar a
     * `setDeletedAt(\DateTimeImmutable)` directamente — Doctrine rechaza el cast.
     */
    private function softDeleteDestino(EntityManagerInterface $em, Grupo $destino): void
    {
        // Horarios.
        $horarios = $em->getRepository(Horario::class)->createQueryBuilder('h')
            ->innerJoin('h.imparticion', 'i')
            ->andWhere('i.grupo = :g')
            ->andWhere('h.deleted = false')
            ->setParameter('g', $destino)
            ->getQuery()->getResult();
        foreach ($horarios as $h) {
            $h->setDeleted(true);
        }

        // PLs (cascade BD borra sus PLIs en hard-delete; aquí soft → marcar PLIs aparte).
        $pls = $this->fetchPlsVivos($em, $destino);
        foreach ($pls as $pl) {
            foreach ($pl->getImparticiones() as $pli) {
                if (!$pli->isDeleted()) {
                    $pli->setDeleted(true);
                }
            }
            $pl->setDeleted(true);
        }
    }

    /**
     * Calcula los mismos stats que `adjuntar` pero sin tocar BD. Reutiliza
     * la lógica para el preview.
     *
     * @param list<PeriodoLectivo> $plsOrigen
     * @param list<Horario> $horariosOrigen
     * @param array<int, Imparticion> $impMapOrig
     * @param array<int, Imparticion> $impMapDest
     */
    private function computeDiff(array $plsOrigen, array $horariosOrigen, array $impMapOrig, array $impMapDest): array
    {
        $stats = [
            'plsCreados'       => 0,
            'plisCreados'      => 0,
            'horariosCreados'  => 0,
            'materiasOmitidas' => [],
            'profeMismatch'    => [],
        ];
        foreach ($plsOrigen as $plOrig) {
            $stats['plsCreados']++;
            foreach ($plOrig->getImparticiones() as $pliOrig) {
                if ($pliOrig->isDeleted()) continue;
                $impOrig = $pliOrig->getImparticion();
                $matId = $impOrig?->getMateria()?->getId();
                $impDest = $matId !== null ? ($impMapDest[$matId] ?? null) : null;
                if ($impDest === null) {
                    $this->trackOmitida($stats, $impOrig, $matId);
                    continue;
                }
                $this->trackProfeMismatch($stats, $impOrig, $impDest);
                $stats['plisCreados']++;
            }
        }
        foreach ($horariosOrigen as $hOrig) {
            $impOrig = $hOrig->getImparticion();
            $matId = $impOrig?->getMateria()?->getId();
            $impDest = $matId !== null ? ($impMapDest[$matId] ?? null) : null;
            if ($impDest !== null) {
                $stats['horariosCreados']++;
            }
        }
        $stats['materiasOmitidas'] = $this->dedupeByMateriaId($stats['materiasOmitidas']);
        $stats['profeMismatch']    = $this->dedupeByMateriaId($stats['profeMismatch']);
        return $stats;
    }

    /**
     * Dedupe por `materiaId` (clave estable). Preserva el primer elemento.
     */
    private function dedupeByMateriaId(array $rows): array
    {
        $seen = [];
        $out = [];
        foreach ($rows as $r) {
            $k = $r['materiaId'] ?? null;
            if ($k === null) { $out[] = $r; continue; }
            if (isset($seen[$k])) continue;
            $seen[$k] = true;
            $out[] = $r;
        }
        return $out;
    }

    private function trackOmitida(array &$stats, ?Imparticion $impOrig, ?int $matId): void
    {
        if ($matId === null) return;
        $mat = $impOrig?->getMateria();
        $stats['materiasOmitidas'][] = [
            'materiaId'   => $matId,
            'codigo'      => $mat?->getCodigoOficial(),
            'abreviatura' => $mat?->getAbreviatura(),
            'nombre'      => $mat?->getNombre(),
        ];
    }

    private function trackProfeMismatch(array &$stats, ?Imparticion $impOrig, ?Imparticion $impDest): void
    {
        $pOrig = $impOrig?->getProfesor()?->getId();
        $pDest = $impDest?->getProfesor()?->getId();
        if ($pOrig === null || $pDest === null) return;  // ambos sin profe = no es mismatch real.
        if ($pOrig === $pDest) return;
        $mat = $impOrig?->getMateria();
        $stats['profeMismatch'][] = [
            'materiaId'   => $mat?->getId(),
            'codigo'      => $mat?->getCodigoOficial(),
            'abreviatura' => $mat?->getAbreviatura(),
            'origenProfeId' => $pOrig,
            'destinoProfeId' => $pDest,
        ];
    }
}
