<?php

namespace App\Catalogo\Source;

use App\Catalogo\Dto\CatalogoCentroDto;
use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Dto\CatalogoMateriaDto;
use App\Entity\Catalogo\EtapaEducativa;
use App\Entity\Catalogo\TipoMateria;

/**
 * Adapter de prueba con datos reales pero hardcoded.
 *
 * Sirve como SMOKE TEST end-to-end del pipeline (adapter → ingest → BD →
 * API → frontend) sin depender de scraping ni redes externas. Útil también
 * en entornos de desarrollo/CI donde no queremos hacer peticiones a
 * fuentes oficiales.
 *
 * Los itinerarios provistos son representativos:
 *  - Un ciclo de FP Superior (Desarrollo de Aplicaciones Web — IFC32).
 *  - Un ciclo de FP Medio (Sistemas Microinformáticos y Redes — IFC22).
 *  - Una modalidad de Bachillerato (Ciencias y Tecnología, 1º).
 *
 * NO usar este adapter en producción para nada serio: los datos son
 * exactos pero parciales y se quedarán desactualizados.
 */
final class DummyFixturesAdapter implements CatalogoSourceAdapterInterface
{
    public function source(): string
    {
        return 'dummy';
    }

    public function fetchItinerarios(): iterable
    {
        yield $this->desarrolloAplicacionesWeb();
        yield $this->sistemasMicroinformaticosYRedes();
        yield $this->bachilleratoCienciasTecnologia1();
    }

    public function fetchCentros(): iterable
    {
        // Este adapter no provee centros (la API andaluza lo hará en su momento).
        return [];
    }

    private function desarrolloAplicacionesWeb(): CatalogoItinerarioDto
    {
        $materias = [
            // Curso 1
            new CatalogoMateriaDto(
                codigoOficial: '0612',
                nombre: 'Sistemas Informáticos',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 192,
                horasSemanales: 6.0,
                orden: 1,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0613',
                nombre: 'Bases de Datos',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 192,
                horasSemanales: 6.0,
                orden: 2,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0614',
                nombre: 'Programación',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 256,
                horasSemanales: 8.0,
                orden: 3,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0615',
                nombre: 'Lenguajes de Marcas y Sistemas de Gestión de Información',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 128,
                horasSemanales: 4.0,
                orden: 4,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0617',
                nombre: 'Entornos de Desarrollo',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 96,
                horasSemanales: 3.0,
                orden: 5,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0373',
                nombre: 'Formación y Orientación Laboral',
                tipo: TipoMateria::MODULO,
                curso: 1,
                horasTotales: 96,
                horasSemanales: 3.0,
                orden: 6,
            ),
            // Curso 2
            new CatalogoMateriaDto(
                codigoOficial: '0613b',
                nombre: 'Desarrollo Web en Entorno Cliente',
                tipo: TipoMateria::MODULO,
                curso: 2,
                horasTotales: 168,
                horasSemanales: 8.0,
                orden: 7,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0614b',
                nombre: 'Desarrollo Web en Entorno Servidor',
                tipo: TipoMateria::MODULO,
                curso: 2,
                horasTotales: 168,
                horasSemanales: 8.0,
                orden: 8,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0615b',
                nombre: 'Despliegue de Aplicaciones Web',
                tipo: TipoMateria::MODULO,
                curso: 2,
                horasTotales: 84,
                horasSemanales: 4.0,
                orden: 9,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0616',
                nombre: 'Diseño de Interfaces Web',
                tipo: TipoMateria::MODULO,
                curso: 2,
                horasTotales: 126,
                horasSemanales: 6.0,
                orden: 10,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0617b',
                nombre: 'Empresa e Iniciativa Emprendedora',
                tipo: TipoMateria::MODULO,
                curso: 2,
                horasTotales: 84,
                horasSemanales: 4.0,
                orden: 11,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0618',
                nombre: 'Proyecto de Desarrollo de Aplicaciones Web',
                tipo: TipoMateria::PROYECTO,
                curso: 2,
                horasTotales: 30,
                horasSemanales: null,
                orden: 12,
            ),
            new CatalogoMateriaDto(
                codigoOficial: '0619',
                nombre: 'Formación en Centros de Trabajo',
                tipo: TipoMateria::FCT,
                curso: 2,
                horasTotales: 370,
                horasSemanales: null,
                orden: 13,
            ),
        ];

        return new CatalogoItinerarioDto(
            codigoOficial: 'IFC32',
            etapa: EtapaEducativa::FP_SUPERIOR,
            nombre: 'Desarrollo de Aplicaciones Web',
            familia: 'Informática y Comunicaciones',
            nivel: 'Grado Superior',
            duracionTotalHoras: 2000,
            duracionTotalEcts: null,
            ccaa: null,
            normativa: 'Real Decreto 686/2010, de 20 de mayo',
            boletinUrl: 'https://www.boe.es/eli/es/rd/2010/05/20/686',
            vigenteDesde: new \DateTimeImmutable('2010-09-01'),
            vigenteHasta: null,
            materias: $materias,
            fuenteHash: hash('sha256', 'IFC32-v1'),
        );
    }

    private function sistemasMicroinformaticosYRedes(): CatalogoItinerarioDto
    {
        $materias = [
            new CatalogoMateriaDto('0221', 'Montaje y Mantenimiento de Equipo', TipoMateria::MODULO, curso: 1, horasTotales: 224, horasSemanales: 7.0, orden: 1),
            new CatalogoMateriaDto('0222', 'Sistemas Operativos Monopuesto', TipoMateria::MODULO, curso: 1, horasTotales: 160, horasSemanales: 5.0, orden: 2),
            new CatalogoMateriaDto('0223', 'Aplicaciones Ofimáticas', TipoMateria::MODULO, curso: 1, horasTotales: 256, horasSemanales: 8.0, orden: 3),
            new CatalogoMateriaDto('0224', 'Sistemas Operativos en Red', TipoMateria::MODULO, curso: 2, horasTotales: 147, horasSemanales: 7.0, orden: 4),
            new CatalogoMateriaDto('0225', 'Redes Locales', TipoMateria::MODULO, curso: 2, horasTotales: 231, horasSemanales: 11.0, orden: 5),
            new CatalogoMateriaDto('0226', 'Seguridad Informática', TipoMateria::MODULO, curso: 2, horasTotales: 105, horasSemanales: 5.0, orden: 6),
            new CatalogoMateriaDto('0227', 'Servicios en Red', TipoMateria::MODULO, curso: 2, horasTotales: 147, horasSemanales: 7.0, orden: 7),
            new CatalogoMateriaDto('0228', 'Aplicaciones Web', TipoMateria::MODULO, curso: 2, horasTotales: 84, horasSemanales: 4.0, orden: 8),
            new CatalogoMateriaDto('0229', 'Formación y Orientación Laboral', TipoMateria::MODULO, curso: 1, horasTotales: 96, horasSemanales: 3.0, orden: 9),
            new CatalogoMateriaDto('0230', 'Empresa e Iniciativa Emprendedora', TipoMateria::MODULO, curso: 2, horasTotales: 84, horasSemanales: 4.0, orden: 10),
            new CatalogoMateriaDto('0231', 'Formación en Centros de Trabajo', TipoMateria::FCT, curso: 2, horasTotales: 410, horasSemanales: null, orden: 11),
        ];

        return new CatalogoItinerarioDto(
            codigoOficial: 'IFC22',
            etapa: EtapaEducativa::FP_MEDIO,
            nombre: 'Sistemas Microinformáticos y Redes',
            familia: 'Informática y Comunicaciones',
            nivel: 'Grado Medio',
            duracionTotalHoras: 2000,
            duracionTotalEcts: null,
            ccaa: null,
            normativa: 'Real Decreto 1691/2007, de 14 de diciembre',
            boletinUrl: 'https://www.boe.es/eli/es/rd/2007/12/14/1691',
            vigenteDesde: new \DateTimeImmutable('2008-09-01'),
            vigenteHasta: null,
            materias: $materias,
            fuenteHash: hash('sha256', 'IFC22-v1'),
        );
    }

    private function bachilleratoCienciasTecnologia1(): CatalogoItinerarioDto
    {
        $materias = [
            new CatalogoMateriaDto('LCL-I',  'Lengua Castellana y Literatura I', TipoMateria::TRONCAL, curso: 1, horasSemanales: 4.0, orden: 1),
            new CatalogoMateriaDto('FIL',    'Filosofía',                        TipoMateria::TRONCAL, curso: 1, horasSemanales: 3.0, orden: 2),
            new CatalogoMateriaDto('IDM-I',  'Inglés I',                         TipoMateria::TRONCAL, curso: 1, horasSemanales: 3.0, orden: 3),
            new CatalogoMateriaDto('EDF',    'Educación Física',                 TipoMateria::TRONCAL, curso: 1, horasSemanales: 2.0, orden: 4),
            new CatalogoMateriaDto('MAT-I',  'Matemáticas I',                    TipoMateria::TRONCAL, curso: 1, horasSemanales: 4.0, orden: 5),
            new CatalogoMateriaDto('FIS-Q',  'Física y Química',                 TipoMateria::ESPECIFICA, curso: 1, horasSemanales: 4.0, orden: 6),
            new CatalogoMateriaDto('BIO-G',  'Biología, Geología y Ciencias Ambientales', TipoMateria::ESPECIFICA, curso: 1, horasSemanales: 4.0, orden: 7),
            new CatalogoMateriaDto('DIB-T',  'Dibujo Técnico I',                 TipoMateria::OPTATIVA, curso: 1, horasSemanales: 4.0, obligatoria: false, orden: 8),
            new CatalogoMateriaDto('TEC-I',  'Tecnología e Ingeniería I',        TipoMateria::OPTATIVA, curso: 1, horasSemanales: 4.0, obligatoria: false, orden: 9),
        ];

        return new CatalogoItinerarioDto(
            codigoOficial: 'BACH-CT-1',
            etapa: EtapaEducativa::BACHILLERATO,
            nombre: 'Bachillerato — Modalidad Ciencias y Tecnología (1º)',
            familia: 'Ciencias y Tecnología',
            nivel: 'Modalidad',
            duracionTotalHoras: null,
            duracionTotalEcts: null,
            ccaa: 'AND',
            normativa: 'Decreto 110/2023 de la Junta de Andalucía',
            boletinUrl: null,
            vigenteDesde: new \DateTimeImmutable('2023-09-01'),
            vigenteHasta: null,
            materias: $materias,
            fuenteHash: hash('sha256', 'BACH-CT-1-v1'),
        );
    }
}
