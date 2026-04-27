<?php

namespace App\Controller;

use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\EtapaEducativa;
use App\Entity\Centro;
use App\Entity\Itinerario;
use App\Entity\Materia;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Materialización de ítems del catálogo oficial como entidades editables del centro.
 *
 * Cuando un admin selecciona un ciclo del catálogo en el modal "Nuevo ciclo",
 * el frontend POSTea aquí con el id del CatalogoItinerario. El backend crea
 * el Itinerario + sus Materia copiando los datos del catálogo, dejando
 * `catalogoOrigen` apuntando a la fuente para trazar futuros cambios.
 */
#[IsGranted('ROLE_ADMIN')]
final class CatalogoMaterializationController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('/api/itinerarios/from-catalogo', name: 'api_itinerarios_from_catalogo', methods: ['POST'])]
    public function itinerariosFromCatalogo(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $itinerarioId = $payload['catalogoItinerarioId'] ?? null;
        $centroId     = $payload['centroId'] ?? null;

        if (!is_int($itinerarioId)) {
            return $this->json(
                ['message' => 'Falta o es inválido el campo "catalogoItinerarioId" (debe ser entero).'],
                Response::HTTP_BAD_REQUEST
            );
        }

        $catalogoItinerario = $this->em->getRepository(CatalogoItinerario::class)->find($itinerarioId);
        if (!$catalogoItinerario) {
            return $this->json(
                ['message' => 'No se encuentra el itinerario solicitado en el catálogo.'],
                Response::HTTP_NOT_FOUND
            );
        }

        // Resolver el Centro: SuperAdmin elige; Admin hereda el suyo.
        /** @var User $currentUser */
        $currentUser = $this->getUser();
        $centro = $this->resolveCentro($currentUser, $centroId);
        if ($centro === null) {
            return $this->json(
                ['message' => 'No se ha podido determinar el centro destino.'],
                Response::HTTP_BAD_REQUEST
            );
        }

        try {
            $itinerario = $this->buildCiclo($catalogoItinerario, $centro);
            $this->em->persist($itinerario);

            $materiasCreadas = 0;
            foreach ($catalogoItinerario->getMaterias() as $catalogoMateria) {
                $materia = $this->buildModulo($catalogoMateria, $itinerario);
                $this->em->persist($materia);
                $materiasCreadas++;
            }

            $this->em->flush();
        } catch (\Throwable $e) {
            return $this->json(
                ['message' => 'Error al materializar el itinerario desde el catálogo: ' . $e->getMessage()],
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }

        return $this->json([
            'id' => $itinerario->getId(),
            'nombre' => $itinerario->getNombre(),
            'nivel' => $itinerario->getNivel(),
            'centroId' => $centro->getId(),
            'catalogoItinerarioId' => $catalogoItinerario->getId(),
            'modulosCreados' => $materiasCreadas,
        ], Response::HTTP_CREATED);
    }

    private function resolveCentro(User $currentUser, mixed $requestedCentroId): ?Centro
    {
        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $currentUser->getRoles(), true);

        if ($isSuperAdmin) {
            // SuperAdmin: debe especificar centroId.
            if (!is_int($requestedCentroId)) {
                return null;
            }
            return $this->em->getRepository(Centro::class)->find($requestedCentroId);
        }

        // Admin de centro: hereda el suyo. Ignora cualquier centroId del payload.
        return $currentUser->getCentro();
    }

    private function buildCiclo(CatalogoItinerario $itinerario, Centro $centro): Itinerario
    {
        return (new Itinerario())
            ->setNombre($itinerario->getNombre())
            ->setNivel($this->mapNivel($itinerario->getEtapa()))
            ->setCentro($centro)
            ->setCatalogoOrigen($itinerario);
    }

    private function buildModulo(CatalogoMateria $materia, Itinerario $itinerario): Materia
    {
        // CatalogoMateria → Materia: ambos campos son ahora int de minutos
        // (refactor 2026-04-27, ver hoja-de-ruta-curriculum-ccaa.md Fase 2).
        // Si el catálogo no lo especifica:
        //   - FP (FCT, proyecto): usar 0 — no hay carga semanal regular pero no es null.
        //   - ESO/Bach: dejar null. El admin lo completa cuando sepa el reparto CCAA.
        $minutosSemanales = $materia->getMinutosSemanales();
        $isFp = in_array($itinerario->getCatalogoOrigen()?->getEtapa()?->value ?? '', [
            'fp_basica', 'fp_medio', 'fp_superior', 'fp_especializacion',
        ], true);
        $minutosFinal = $minutosSemanales ?? ($isFp ? 0 : null);

        return (new Materia())
            ->setNombre($materia->getNombre())
            ->setCodigoOficial($materia->getCodigoOficial())
            ->setCurso($materia->getCurso() ?? 1)
            ->setMinutosSemanales($minutosFinal)
            ->setTipo($materia->getTipo())
            ->setItinerario($itinerario)
            ->setCatalogoOrigen($materia);
    }

    /**
     * Mapea la EtapaEducativa del catálogo al string `nivel` del Itinerario
     * que ya usa Loggex en el formulario actual ("Básico" / "Medio" / "Superior" / …).
     */
    private function mapNivel(EtapaEducativa $etapa): string
    {
        return match ($etapa) {
            EtapaEducativa::FP_BASICA          => 'Básico',
            EtapaEducativa::FP_MEDIO           => 'Medio',
            EtapaEducativa::FP_SUPERIOR        => 'Superior',
            EtapaEducativa::FP_ESPECIALIZACION => 'Curso de Especialización',
            EtapaEducativa::PRIMARIA           => 'Primaria',
            EtapaEducativa::ESO                => 'ESO',
            EtapaEducativa::BACHILLERATO       => 'Bachillerato',
            default                            => $etapa->label(),
        };
    }
}
