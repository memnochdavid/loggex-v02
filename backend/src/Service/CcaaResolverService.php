<?php

namespace App\Service;

use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\CatalogoMateriaCcaa;
use App\Entity\Catalogo\TipoMateria;
use App\Entity\Ccaa;
use App\Entity\Itinerario;
use App\Entity\Modalidad;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Resuelve las materias efectivas de un Itinerario aplicando el overlay CCAA
 * sobre el catálogo nacional. Algoritmo §4 del doc `hoja-de-ruta-curriculum-ccaa.md`.
 *
 * Casos:
 *   - Itinerario sin CCAA → materias del catálogo nacional tal cual.
 *   - Itinerario con CCAA, override de horas → minutos/nombre del overlay.
 *   - Itinerario con CCAA, materia autonómica → materia nueva (sin contraparte BOE).
 *   - Override con minutosSemanales=0 → materia "desactivada" (LOMLOE: Empresa
 *     se sustituye por IPE II en DAW 2º; el override pone Empresa en 0 y la
 *     materia desaparece del listado resuelto).
 *
 * Devuelve `ResolvedMateria[]` (struct anónimo) que el endpoint resync usa
 * para sincronizar las imparticiones del grupo.
 */
class CcaaResolverService
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * @return list<ResolvedMateria>
     */
    public function resolverMaterias(Itinerario $itinerario, ?\DateTimeImmutable $fecha = null): array
    {
        $catItin = $itinerario->getCatalogoOrigen();
        if ($catItin === null) {
            return [];
        }

        $ccaa = $itinerario->getCcaa();
        $base = $catItin->getMaterias();

        // Sin CCAA → solo catálogo nacional
        if ($ccaa === null) {
            $out = [];
            foreach ($base as $m) {
                $out[] = ResolvedMateria::fromCatalogoNacional($m);
            }
            return $out;
        }

        // Con CCAA → catálogo nacional + overrides + autonómicas
        $fecha ??= new \DateTimeImmutable();
        $overrides = $this->findOverridesVigentes($ccaa, $catItin, $fecha);

        $out = [];
        $handledNacionales = [];

        foreach ($overrides as $ov) {
            $catMat = $ov->getCatalogoMateria();
            if ($catMat !== null) {
                $handledNacionales[$catMat->getId()] = true;
                $minutos = $ov->getMinutosSemanales() ?? $catMat->getMinutosSemanales();
                // Override con minutos=0 ⇒ materia desactivada en esta CCAA
                // (caso LOMLOE: Empresa sustituida por IPE II en DAW 2º).
                if ($minutos === 0) {
                    continue;
                }
                $out[] = new ResolvedMateria(
                    catalogoMateria: $catMat,
                    overrideCcaa: $ov,
                    nombre: $ov->getNombre() ?? $catMat->getNombre(),
                    codigoOficial: $catMat->getCodigoOficial(),
                    minutosSemanales: $minutos,
                    curso: $catMat->getCurso() ?? 1,
                    tipo: $ov->getTipo() ?? $catMat->getTipo(),
                    // Cascada: override CCAA explícito > modalidad del catálogo
                    // nacional. NUNCA cae a PRESENCIAL implícito porque el
                    // catálogo nacional siempre tiene modalidad NOT NULL.
                    modalidad: $ov->getModalidad() ?? $catMat->getModalidad(),
                );
            } else {
                // Autonómica pura: sin contraparte en catálogo nacional. Si el
                // override no declara modalidad, fallback a heurística sobre el
                // nombre — así una autonómica "Horas de libre configuración" o
                // "Proyecto Intermodular" cuyo provider no marcó modalidad se
                // cataloga correctamente sin tener que tocar todos los seeds.
                $nombreOv = $ov->getNombre() ?? '';
                $out[] = new ResolvedMateria(
                    catalogoMateria: null,
                    overrideCcaa: $ov,
                    nombre: $nombreOv ?: '?',
                    codigoOficial: $ov->getCodigo() ?? '',
                    minutosSemanales: $ov->getMinutosSemanales() ?? 0,
                    curso: $ov->getCurso() ?? 1,
                    tipo: $ov->getTipo() ?? TipoMateria::MODULO,
                    modalidad: $ov->getModalidad() ?? Modalidad::inferFromName($nombreOv),
                );
            }
        }

        foreach ($base as $m) {
            if (!isset($handledNacionales[$m->getId()])) {
                $out[] = ResolvedMateria::fromCatalogoNacional($m);
            }
        }

        return $out;
    }

    /**
     * @return list<CatalogoMateriaCcaa>
     */
    private function findOverridesVigentes(Ccaa $ccaa, CatalogoItinerario $catItin, \DateTimeImmutable $fecha): array
    {
        $qb = $this->em->getRepository(CatalogoMateriaCcaa::class)->createQueryBuilder('o');
        $qb->where('o.ccaa = :ccaa')
            ->andWhere('o.catalogoItinerario = :it')
            ->andWhere('o.vigenteDesde <= :fecha')
            ->andWhere('o.vigenteHasta IS NULL OR o.vigenteHasta >= :fecha')
            ->setParameter('ccaa', $ccaa->value)
            ->setParameter('it', $catItin)
            ->setParameter('fecha', $fecha->format('Y-m-d'));
        return $qb->getQuery()->getResult();
    }
}

/**
 * Struct inmutable que representa una materia ya resuelta tras aplicar el
 * overlay. El endpoint resync lo materializa en una `Materia` real del grupo.
 */
final class ResolvedMateria
{
    public function __construct(
        public readonly ?CatalogoMateria $catalogoMateria,
        public readonly ?CatalogoMateriaCcaa $overrideCcaa,
        public readonly string $nombre,
        public readonly string $codigoOficial,
        public readonly ?int $minutosSemanales,
        public readonly int $curso,
        public readonly ?TipoMateria $tipo,
        public readonly Modalidad $modalidad = Modalidad::PRESENCIAL,
    ) {
    }

    public static function fromCatalogoNacional(CatalogoMateria $m): self
    {
        // minutosSemanales puede ser NULL en el catálogo nacional (parser BOE
        // no siempre extrae horas, especialmente en RDs antiguos). NULL aquí
        // significa "el catálogo no especifica" — el resync respetará el valor
        // que tenga la materia del grupo y no lo sobreescribirá.
        return new self(
            catalogoMateria: $m,
            overrideCcaa: null,
            nombre: $m->getNombre(),
            codigoOficial: $m->getCodigoOficial(),
            minutosSemanales: $m->getMinutosSemanales(),
            curso: $m->getCurso() ?? 1,
            tipo: $m->getTipo(),
            modalidad: $m->getModalidad(),
        );
    }
}
