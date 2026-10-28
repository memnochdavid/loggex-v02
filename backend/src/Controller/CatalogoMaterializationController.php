<?php

namespace App\Controller;

use App\Entity\Catalogo\CatalogoCentro;
use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\EtapaEducativa;
use App\Entity\Ccaa;
use App\Entity\Centro;
use App\Entity\Itinerario;
use App\Entity\Materia;
use App\Entity\Provincia;
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

    #[Route('/api/centros/from-catalogo', name: 'api_centros_from_catalogo', methods: ['POST'])]
    public function centrosFromCatalogo(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $payload = json_decode($request->getContent(), true);
        $catalogoCentroId = $payload['catalogoCentroId'] ?? null;

        if (!is_int($catalogoCentroId)) {
            return $this->json(
                ['message' => 'Falta o es inválido el campo "catalogoCentroId" (debe ser entero).'],
                Response::HTTP_BAD_REQUEST
            );
        }

        $catalogoCentro = $this->em->getRepository(CatalogoCentro::class)->find($catalogoCentroId);
        if (!$catalogoCentro) {
            return $this->json(
                ['message' => 'No se encuentra el centro solicitado en el catálogo.'],
                Response::HTTP_NOT_FOUND
            );
        }

        try {
            $centro = $this->buildCentroFromCatalogo($catalogoCentro);
            $this->em->persist($centro);
            $this->em->flush();
        } catch (\Throwable $e) {
            return $this->json(
                ['message' => 'Error al materializar el centro desde el catálogo: ' . $e->getMessage()],
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }

        return $this->json([
            'id' => $centro->getId(),
            'nombre' => $centro->getNombre(),
            'ccaa' => $centro->getCcaa()?->value,
            'provincia' => $centro->getProvincia()?->getCodigo(),
        ], Response::HTTP_CREATED);
    }

    private function buildCentroFromCatalogo(CatalogoCentro $catalogoCentro): Centro
    {
        $centro = new Centro();
        $centro->setNombre($catalogoCentro->getNombre());
        $centro->setDireccion($catalogoCentro->getDireccion() ?? '');
        $centro->setCif('');
        $centro->setActivo(true);
        $centro->setTelefono(null);
        $centro->setPorcentajeMaxFaltas(20);
        $centro->setCatalogoOrigen($catalogoCentro);

        $ccaa = $this->mapCatalogoCcaa($catalogoCentro->getCcaa());
        if ($ccaa !== null) {
            $centro->setCcaa($ccaa);
        }

        $provincia = $this->resolveProvincia($catalogoCentro->getProvincia());
        if ($provincia !== null) {
            $centro->setProvincia($provincia);
        }

        return $centro;
    }

    /**
     * Map 3-letter Catalogo CCAA codes to the 2-letter Ccaa enum.
     * Currently only 'AND' is actually ingested (Junta de Andalucía).
     * The rest are mapped preemptively for future adapters.
     */
    private function mapCatalogoCcaa(string $ccaa3): ?Ccaa
    {
        return match ($ccaa3) {
            'AND'  => Ccaa::AN,
            'ARA'  => Ccaa::AR,
            'AST'  => Ccaa::AS,
            'CAB',
            'CANT' => Ccaa::CB,
            'CEU'  => Ccaa::CE,
            'CLE',
            'CYL'  => Ccaa::CL,
            'CLM'  => Ccaa::CM,
            'CNA',
            'CAN'  => Ccaa::CN,
            'CAT'  => Ccaa::CT,
            'EXT'  => Ccaa::EX,
            'GAL'  => Ccaa::GA,
            'BAL'  => Ccaa::IB,
            'MUR'  => Ccaa::MC,
            'MAD'  => Ccaa::MD,
            'MEL'  => Ccaa::ML,
            'NAV'  => Ccaa::NC,
            'PVA',
            'PVS'  => Ccaa::PV,
            'RIO'  => Ccaa::RI,
            'VAL'  => Ccaa::VC,
            default => null,
        };
    }

    /**
     * Resolve Provincia entity by normalized name from CatalogoCentro.
     * Falls back to prefix matching if exact match fails.
     */
    private function resolveProvincia(?string $provinciaNombre): ?Provincia
    {
        if ($provinciaNombre === null || $provinciaNombre === '') {
            return null;
        }

        $normalize = function (string $s): string {
            $s = mb_strtolower($s, 'UTF-8');
            return str_replace(
                ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
                ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
                $s
            );
        };

        $target = $normalize($provinciaNombre);
        $provincias = $this->em->getRepository(Provincia::class)->findAll();

        foreach ($provincias as $provincia) {
            if ($normalize($provincia->getNombre()) === $target) {
                return $provincia;
            }
        }

        // Prefix fallback (e.g., "Santa Cruz de Tenerife" vs "Santa Cruz")
        foreach ($provincias as $provincia) {
            $norm = $normalize($provincia->getNombre());
            if (str_starts_with($target, $norm) || str_starts_with($norm, $target)) {
                return $provincia;
            }
        }

        return null;
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

        // Horas totales anuales (Opción A 2026-04-29): es el dato LEGAL LOMLOE.
        // Política (post-fix 2026-05-06 sesión 4):
        //  1. Si el catálogo lo trae (BOE enriquecido por BoeRdEnricher),
        //     copiarlo tal cual — son las horas RD del título.
        //  2. Si no lo trae, dejar NULL en lugar de inflar con `min × 36 / 60`.
        //     El downstream (`Materia::getObjetivoAnualMinutos()`) gestiona
        //     NULL devolviendo el fallback histórico solo cuando no hay
        //     mejor dato. Esto evita el bug "horas infladas vs RD legal" que
        //     se producía cuando AN (u otra CCAA) define minutos semanales
        //     generosos (asumiendo ≥36 sem reales) y el sistema los convertía
        //     a horas asumiendo 36 sem LOMLOE puras → inflado sistemático.
        //  Doc: hoja-de-ruta-modelo-semanal.md §9 sesión 3 deuda mayor.
        $horasTotales = $materia->getHorasTotales();

        return (new Materia())
            ->setNombre($materia->getNombre())
            ->setCodigoOficial($materia->getCodigoOficial())
            ->setCurso($materia->getCurso() ?? 1)
            ->setMinutosSemanales($minutosFinal)
            ->setHorasTotales($horasTotales)
            ->setTipo($materia->getTipo())
            // Propaga modalidad del catálogo (Fase 2 modalidad). Sin esto, las
            // Materia nacen como `presencial` aunque CatalogoMateria sea fct/
            // no_regular, y solo se corrigen tras un resync explícito — frágil.
            ->setModalidad($materia->getModalidad())
            ->addItinerario($itinerario)
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
