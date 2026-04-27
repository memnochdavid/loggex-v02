<?php

namespace App\Catalogo\Ccaa\Provider;

use App\Catalogo\Ccaa\CcaaCurriculumProviderInterface;
use App\Catalogo\Ccaa\Dto\ItinerarioOverrideDto;
use App\Catalogo\Ccaa\Dto\MateriaOverrideDto;
use App\Entity\Ccaa;
use App\Entity\Catalogo\TipoMateria;
use League\Flysystem\FilesystemOperator;

/**
 * Provider que lee `catalogo/ccaa/AN/curated/horarios.json` desde MinIO y emite
 * los DTOs MateriaOverride / ItinerarioOverride. Datos verificados extraídos
 * de los PDFs oficiales BOJA + Resolución DG FP 2024.
 *
 * Fuente del JSON: comando `app:catalogo:ccaa:ingest --ccaa=AN` lo sube tras
 * generarlo a partir de los PDFs descargados. PDFs originales se conservan en
 * `catalogo/ccaa/AN/source/` como prueba auditable.
 *
 * Uso recomendado:
 *   php bin/console app:catalogo:ccaa:seed --source=boja_and_json
 *
 * Sustituye al `BojaAndHardcodedProvider` (que queda como fallback histórico).
 *
 * Si el archivo no existe en MinIO, el provider devuelve iterables vacíos —
 * NO lanza excepción, para que el seed pueda invocarse sin asumir presencia
 * (útil en CI o entornos sin acceso a MinIO).
 */
final class BojaAndJsonProvider implements CcaaCurriculumProviderInterface
{
    private const CURATED_PATH = 'catalogo/ccaa/AN/curated/horarios.json';

    private ?array $cachedData = null;

    public function __construct(private readonly FilesystemOperator $storage)
    {
    }

    public function source(): string
    {
        return 'boja_and_json';
    }

    public function ccaa(): Ccaa
    {
        return Ccaa::AN;
    }

    public function fetchOverrides(): iterable
    {
        $data = $this->loadData();
        if ($data === null) return;

        $vigenteDesde = new \DateTimeImmutable($data['version'] ?? '2024-09-01');
        $fuenteBoja = $this->fuenteRef($data, 'boja-149-2011', 'boja-142-2011');
        $fuenteLomloe = $this->fuenteRef($data, 'resolucion-2024-06-26');

        // 1) Overrides de módulos BOJA: minutos del horario semanal según el Anexo II.
        //    Si la materia está marcada como `sustituidaEnLomloePor`, se emite
        //    override con minutos=0 (LOMLOE) — el resolver la trata como
        //    desactivada y no aparece en el grupo.
        foreach ($data['itinerarios'] ?? [] as $it) {
            $itinCodigo = $it['codigoOficial'] ?? null;
            if (!$itinCodigo) continue;

            foreach ($it['modulosBoja'] ?? [] as $m) {
                $codigo = $m['codigo'] ?? null;
                $curso = $m['curso'] ?? null;
                if (!$codigo || $curso === null) continue;

                $sustituida = !empty($m['sustituidaEnLomloePor']);
                $libreConfig = !empty($m['esLibreConfiguracion']);
                $horas = $m['horasSemanales'] ?? null;

                // Materias del catálogo nacional sustituidas en LOMLOE: minutos=0.
                if ($sustituida) {
                    yield new MateriaOverrideDto(
                        ccaa: Ccaa::AN,
                        itinerarioCodigoOficial: $itinCodigo,
                        materiaCodigoOficial: $codigo,
                        curso: $curso,
                        minutosSemanales: 0,
                        nombre: null,
                        codigo: null,
                        tipo: null,
                        boletinOficialRef: $fuenteLomloe,
                        vigenteDesde: $vigenteDesde,
                    );
                    continue;
                }

                // "Horas libre configuración" (AN-LIBRE-*) son códigos sintéticos
                // del propio JSON, no existen en `catalogo_materia` BOE.
                // Se modelan como autonómicas puras.
                if ($libreConfig || str_starts_with($codigo, 'AN-')) {
                    if ($horas !== null) {
                        yield new MateriaOverrideDto(
                            ccaa: Ccaa::AN,
                            itinerarioCodigoOficial: $itinCodigo,
                            materiaCodigoOficial: null,
                            curso: $curso,
                            minutosSemanales: (int) ($horas * 60),
                            nombre: $m['nombre'] ?? null,
                            codigo: $codigo,
                            tipo: TipoMateria::LIBRE_CONFIGURACION,
                            boletinOficialRef: $fuenteBoja,
                            vigenteDesde: $vigenteDesde,
                        );
                    }
                    continue;
                }

                // Override estándar de horas BOJA (puede coincidir con BOE: igual
                // se emite para que la trazabilidad de la fuente quede explícita).
                if ($horas !== null) {
                    yield new MateriaOverrideDto(
                        ccaa: Ccaa::AN,
                        itinerarioCodigoOficial: $itinCodigo,
                        materiaCodigoOficial: $codigo,
                        curso: $curso,
                        minutosSemanales: (int) ($horas * 60),
                        nombre: null,
                        codigo: null,
                        tipo: null,
                        boletinOficialRef: $fuenteBoja,
                        vigenteDesde: $vigenteDesde,
                    );
                }
                // horas=null + no sustituida → no override (FCT, Proyecto):
                // cae al valor del catálogo nacional (BOE).
            }
        }

        // 2) Transversales LOMLOE GS: aplican a TODOS los itinerarios de Grado
        //    Superior. Como el modelo CCAA almacena por itinerario, replicamos
        //    para cada itinerario presente.
        foreach ($data['transversalesLomloeGs'] ?? [] as $tr) {
            $codigo = $tr['codigo'] ?? null;
            $curso = $tr['curso'] ?? null;
            $horas = $tr['horasSemanales'] ?? null;
            if (!$codigo || $curso === null || $horas === null) continue;

            foreach ($data['itinerarios'] ?? [] as $it) {
                $itinCodigo = $it['codigoOficial'] ?? null;
                if (!$itinCodigo) continue;

                yield new MateriaOverrideDto(
                    ccaa: Ccaa::AN,
                    itinerarioCodigoOficial: $itinCodigo,
                    materiaCodigoOficial: null,
                    curso: $curso,
                    minutosSemanales: (int) ($horas * 60),
                    nombre: $tr['nombre'] ?? null,
                    codigo: $codigo,
                    tipo: TipoMateria::MODULO,
                    boletinOficialRef: $fuenteLomloe,
                    vigenteDesde: $vigenteDesde,
                );
            }
        }
    }

    public function fetchItinerarioOverrides(): iterable
    {
        // El JSON actual no incluye overrides de nombre de itinerario.
        // Si el BOJA renombra un itinerario (caso raro), añadir aquí.
        return [];
    }

    private function loadData(): ?array
    {
        if ($this->cachedData !== null) return $this->cachedData;

        if (!$this->storage->fileExists(self::CURATED_PATH)) {
            return null;
        }

        try {
            $raw = $this->storage->read(self::CURATED_PATH);
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) return null;
            return $this->cachedData = $decoded;
        } catch (\Throwable $e) {
            // Fallo silencioso: el seed reportará 0 emitidos.
            return null;
        }
    }

    /**
     * Devuelve una referencia corta y citable al boletín oficial. Usa los `id`
     * del array `fuentes` del JSON (ej. "boja-149-2011") en formato legible
     * compacto. Limita longitud para encajar en VARCHAR(255).
     */
    private function fuenteRef(array $data, string ...$ids): string
    {
        $partes = [];
        foreach ($data['fuentes'] ?? [] as $f) {
            if (in_array($f['id'] ?? '', $ids, true)) {
                $partes[] = $this->idCorto($f['id']);
            }
        }
        return implode(' + ', $partes) ?: 'BOJA Andalucía';
    }

    private function idCorto(string $id): string
    {
        return match ($id) {
            'boja-149-2011' => 'BOJA 149/2011 (DAW)',
            'boja-142-2011' => 'BOJA 142/2011 (DAM)',
            'resolucion-2024-06-26' => 'Resolución DG FP 26/06/2024',
            default => $id,
        };
    }
}
