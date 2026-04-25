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

    #[Route('/api/ciclos/from-catalogo', name: 'api_ciclos_from_catalogo', methods: ['POST'])]
    public function ciclosFromCatalogo(Request $request): JsonResponse
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

        $itinerario = $this->em->getRepository(CatalogoItinerario::class)->find($itinerarioId);
        if (!$itinerario) {
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
            $itinerario = $this->buildCiclo($itinerario, $centro);
            $this->em->persist($itinerario);

            foreach ($itinerario->getMaterias() as $materia) {
                $materia = $this->buildModulo($materia, $itinerario);
                $this->em->persist($materia);
            }

            $this->em->flush();
        } catch (\Throwable $e) {
            return $this->json(
                ['message' => 'Error al materializar el ciclo desde el catálogo: ' . $e->getMessage()],
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }

        return $this->json([
            'id' => $itinerario->getId(),
            'nombre' => $itinerario->getNombre(),
            'nivel' => $itinerario->getNivel(),
            'centroId' => $centro->getId(),
            'catalogoItinerarioId' => $itinerario->getId(),
            'modulosCreados' => $itinerario->getMaterias()->count(),
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
        // CatalogoMateria → Materia: el campo horasSemanales del catálogo es decimal,
        // el del Materia del centro es int. Redondeamos al alza para no perder horas.
        // Si el catálogo no especifica (FCT, proyecto), usamos 0 — el setter de
        // Materia no acepta null y para esos módulos no hay carga semanal regular.
        $horasSemanales = $materia->getHorasSemanales();
        $horasInt = $horasSemanales !== null ? (int) ceil((float) $horasSemanales) : 0;

        return (new Materia())
            ->setNombre($materia->getNombre())
            ->setCodigoOficial($materia->getCodigoOficial())
            ->setCurso($materia->getCurso() ?? 1)
            ->setHorasSemanales($horasInt)
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
            default                            => $etapa->label(),
        };
    }
}
