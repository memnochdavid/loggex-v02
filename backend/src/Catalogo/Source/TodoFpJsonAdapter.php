<?php

namespace App\Catalogo\Source;

use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Dto\CatalogoMateriaDto;
use App\Entity\Catalogo\EtapaEducativa;
use App\Entity\Catalogo\TipoMateria;

/**
 * Adapter del catálogo de FP basado en un JSON curado a mano.
 *
 * Lee `backend/data/catalogo/todofp/itinerarios-fp.json` (path absoluto
 * resuelto vía %kernel.project_dir%) y emite un DTO por cada itinerario.
 *
 * Estrategia v1: dataset bootstrap mantenido en repo, fácil de ampliar
 * editando el JSON. A futuro convivirá o se reemplazará por un
 * `TodoFpHttpAdapter` que scrapee TodoFP/BOE en directo (Fase 1.6).
 *
 * El `fuenteHash` por itinerario se calcula sobre su payload JSON canónico,
 * de modo que cualquier edición del archivo invalida el hash y dispara una
 * actualización en la siguiente ingesta. Sin cambios → no-op idempotente.
 */
final class TodoFpJsonAdapter implements CatalogoSourceAdapterInterface
{
    public function __construct(
        private readonly string $jsonPath,
    ) {}

    public function source(): string
    {
        return 'todofp';
    }

    public function fetchItinerarios(): iterable
    {
        if (!file_exists($this->jsonPath)) {
            throw new \RuntimeException(sprintf(
                'TodoFpJsonAdapter: no se encuentra el dataset en %s',
                $this->jsonPath
            ));
        }

        $raw = file_get_contents($this->jsonPath);
        if ($raw === false) {
            throw new \RuntimeException(sprintf(
                'TodoFpJsonAdapter: error leyendo %s',
                $this->jsonPath
            ));
        }

        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new \RuntimeException(sprintf(
                'TodoFpJsonAdapter: JSON inválido en %s — %s',
                $this->jsonPath,
                $e->getMessage()
            ), 0, $e);
        }

        $itinerarios = $data['itinerarios'] ?? [];
        if (!is_array($itinerarios)) {
            throw new \RuntimeException('TodoFpJsonAdapter: campo "itinerarios" ausente o no es un array.');
        }

        foreach ($itinerarios as $idx => $row) {
            yield $this->mapItinerario($row, $idx);
        }
    }

    public function fetchCentros(): iterable
    {
        // TodoFP no provee centros — este adapter solo cubre itinerarios.
        return [];
    }

    private function mapItinerario(array $row, int $idx): CatalogoItinerarioDto
    {
        $codigo = $row['codigoOficial'] ?? throw new \RuntimeException("Itinerario #$idx sin 'codigoOficial'");
        $etapa  = EtapaEducativa::tryFrom($row['etapa'] ?? '')
            ?? throw new \RuntimeException("Itinerario $codigo: etapa inválida '{$row['etapa']}'");

        $materias = [];
        foreach (($row['materias'] ?? []) as $matIdx => $matRow) {
            $materias[] = $this->mapMateria($matRow, $codigo, $matIdx);
        }

        // Hash determinista del payload del itinerario (sin metadatos del archivo
        // global, para que cambios en otros itinerarios no invaliden este hash).
        $hashable = [
            'codigoOficial' => $codigo,
            'etapa' => $etapa->value,
            'nombre' => $row['nombre'] ?? null,
            'familia' => $row['familia'] ?? null,
            'nivel' => $row['nivel'] ?? null,
            'duracionTotalHoras' => $row['duracionTotalHoras'] ?? null,
            'duracionTotalEcts' => $row['duracionTotalEcts'] ?? null,
            'ccaa' => $row['ccaa'] ?? null,
            'normativa' => $row['normativa'] ?? null,
            'boletinUrl' => $row['boletinUrl'] ?? null,
            'vigenteDesde' => $row['vigenteDesde'] ?? null,
            'vigenteHasta' => $row['vigenteHasta'] ?? null,
            'materias' => $row['materias'] ?? [],
        ];
        $hash = hash('sha256', json_encode($hashable, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return new CatalogoItinerarioDto(
            codigoOficial: $codigo,
            etapa: $etapa,
            nombre: $row['nombre'] ?? throw new \RuntimeException("Itinerario $codigo sin 'nombre'"),
            familia: $row['familia'] ?? null,
            nivel: $row['nivel'] ?? null,
            duracionTotalHoras: $row['duracionTotalHoras'] ?? null,
            duracionTotalEcts: $row['duracionTotalEcts'] ?? null,
            ccaa: $row['ccaa'] ?? null,
            normativa: $row['normativa'] ?? null,
            boletinUrl: $row['boletinUrl'] ?? null,
            vigenteDesde: $this->parseDate($row['vigenteDesde'] ?? null),
            vigenteHasta: $this->parseDate($row['vigenteHasta'] ?? null),
            materias: $materias,
            fuenteHash: $hash,
        );
    }

    private function mapMateria(array $row, string $codigoItinerario, int $idx): CatalogoMateriaDto
    {
        $tipo = TipoMateria::tryFrom($row['tipo'] ?? '')
            ?? throw new \RuntimeException(
                "Materia #$idx en $codigoItinerario: tipo inválido '{$row['tipo']}'"
            );

        return new CatalogoMateriaDto(
            codigoOficial: $row['codigoOficial'] ?? throw new \RuntimeException("Materia #$idx en $codigoItinerario sin 'codigoOficial'"),
            nombre: $row['nombre'] ?? throw new \RuntimeException("Materia #$idx en $codigoItinerario sin 'nombre'"),
            tipo: $tipo,
            curso: $row['curso'] ?? null,
            horasTotales: $row['horasTotales'] ?? null,
            horasSemanales: isset($row['horasSemanales']) ? (float) $row['horasSemanales'] : null,
            ects: $row['ects'] ?? null,
            distribucionAnual: $row['distribucionAnual'] ?? null,
            obligatoria: $row['obligatoria'] ?? true,
            prerequisitos: $row['prerequisitos'] ?? null,
            descripcion: $row['descripcion'] ?? null,
            competencias: $row['competencias'] ?? null,
            orden: $row['orden'] ?? 0,
        );
    }

    private function parseDate(?string $iso): ?\DateTimeImmutable
    {
        return $iso ? new \DateTimeImmutable($iso) : null;
    }
}
