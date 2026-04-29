<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\Materia;
use App\Service\CcaaResolverService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Re-aplica el overlay CCAA del itinerario sobre las materias e imparticiones
 * del grupo. Idempotente.
 *
 *   - Materias existentes con `codigoOficial + curso` que coinciden con la
 *     resolución → actualiza nombre/minutos si difieren.
 *   - Materias resueltas que no tienen par existente → crea Materia +
 *     Imparticion (sin profesor; lo asigna el admin después).
 *   - Materias del catálogo que ya no aparecen en la resolución (caso LOMLOE
 *     Empresa→IPE II) → soft-delete + soft-delete de Imparticion + Horarios.
 *   - Materias manuales (sin `catalogoOrigen`) → conservadas tal cual.
 *
 * Devuelve un resumen por categoría.
 */
class GrupoResyncCcaaController extends AbstractController
{
    #[Route('/api/v1/grupos/{id}/resync-ccaa', name: 'api_grupos_resync_ccaa', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function resync(int $id, EntityManagerInterface $em, CcaaResolverService $resolver): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], Response::HTTP_FORBIDDEN);
        }

        $grupo = $em->getRepository(Grupo::class)->find($id);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], Response::HTTP_NOT_FOUND);
        }

        $itinerario = $grupo->getItinerario();
        if (!$itinerario) {
            return $this->json(['message' => 'El grupo no tiene itinerario asignado'], Response::HTTP_BAD_REQUEST);
        }

        $resolved = $resolver->resolverMaterias($itinerario);

        // Index resolved por codigoOficial+curso. Filtramos por el curso del
        // grupo: las materias de otros cursos del mismo itinerario pertenecen
        // a otros grupos y no deben procesarse aquí.
        $cursoGrupo = $grupo->getCurso();
        $resolvedByKey = [];
        foreach ($resolved as $r) {
            if ($cursoGrupo !== null && $r->curso !== $cursoGrupo) continue;
            $resolvedByKey[$r->codigoOficial . '|' . $r->curso] = $r;
        }

        $stats = ['actualizadas' => 0, 'creadas' => 0, 'desactivadas' => 0, 'sinCambios' => 0, 'manualesIgnoradas' => 0];
        $now = new \DateTimeImmutable();

        // Materias existentes vivas del itinerario, filtradas por el curso del grupo.
        $existentesCriteria = ['itinerario' => $itinerario, 'deleted' => false];
        if ($cursoGrupo !== null) {
            $existentesCriteria['curso'] = $cursoGrupo;
        }
        $existentes = $em->getRepository(Materia::class)->findBy($existentesCriteria);
        $procesadas = [];

        foreach ($existentes as $m) {
            $key = $m->getCodigoOficial() . '|' . $m->getCurso();

            if (isset($resolvedByKey[$key])) {
                $procesadas[$key] = true;
                $r = $resolvedByKey[$key];
                $changed = false;
                // minutos: solo actualiza si el resolver dio un valor concreto.
                // NULL = "el catálogo no especifica" → preserva lo que hay.
                if ($r->minutosSemanales !== null && $m->getMinutosSemanales() !== $r->minutosSemanales) {
                    $m->setMinutosSemanales($r->minutosSemanales);
                    $changed = true;
                }
                if ($m->getNombre() !== $r->nombre) {
                    $m->setNombre($r->nombre);
                    $changed = true;
                }
                // Modalidad: el catálogo siempre tiene una concreta (NOT NULL).
                // Si difiere, se actualiza — el override per-grupo en
                // Imparticion.modalidad sigue ganando vía getEffectiveModalidad
                // (ese override no se toca aquí: persiste decisión del centro).
                if ($m->getModalidad() !== $r->modalidad) {
                    $m->setModalidad($r->modalidad);
                    $changed = true;
                }
                $stats[$changed ? 'actualizadas' : 'sinCambios']++;
                continue;
            }

            // No está en resolved
            if ($m->getCatalogoOrigen() === null) {
                // Materia manual: la conservamos
                $stats['manualesIgnoradas']++;
                continue;
            }
            // Materia del catálogo que ya no procede (LOMLOE: Empresa→IPE II).
            // Marca solo la Imparticion del grupo actual (no la Materia entera,
            // porque otros grupos del mismo itinerario podrían seguir teniéndola).
            $imps = $em->getRepository(Imparticion::class)->findBy([
                'materia' => $m, 'grupo' => $grupo, 'deleted' => false,
            ]);
            foreach ($imps as $imp) {
                $imp->setDeleted(true);  // trait pone deletedAt
                foreach ($imp->getHorarios() as $h) {
                    if (!$h->isDeleted()) {
                        $h->setDeleted(true);  // trait pone deletedAt
                    }
                }
            }
            $stats['desactivadas']++;
        }

        // Crear materias resolved que no tenían par existente
        foreach ($resolvedByKey as $key => $r) {
            if (isset($procesadas[$key])) continue;
            $m = (new Materia())
                ->setNombre($r->nombre)
                ->setCodigoOficial($r->codigoOficial)
                ->setCurso($r->curso)
                ->setMinutosSemanales($r->minutosSemanales)
                ->setTipo($r->tipo)
                ->setModalidad($r->modalidad)
                ->setItinerario($itinerario)
                ->setCatalogoOrigen($r->catalogoMateria);
            $em->persist($m);

            $imp = (new Imparticion())
                ->setMateria($m)
                ->setGrupo($grupo);
            $em->persist($imp);
            $stats['creadas']++;
        }

        $em->flush();

        return $this->json([
            'grupoId' => $grupo->getId(),
            'itinerarioId' => $itinerario->getId(),
            'ccaa' => $itinerario->getCcaa()?->value,
            'stats' => $stats,
        ]);
    }
}
