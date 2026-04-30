<?php

namespace App\Service;

use App\Entity\AmbitoFestivo;
use App\Entity\CalendarioEscolarCcaa;
use App\Entity\Ccaa;
use App\Entity\Centro;
use App\Entity\EtapaEducativa;
use App\Entity\Festivo;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Sincroniza los Festivos aplicables a un centro a partir de los JSONs
 * curados en MinIO (la fuente de verdad documental: PDF BOE laboral +
 * Resolución BOJA escolar autonómica). Idempotente — corre tantas veces
 * como haga falta sin duplicar filas. Usado desde:
 *
 *   POST /api/v1/centros/{id}/sync-festivos  (botón "Cargar festivos del centro")
 *
 * Lo que persiste para un centro con `ccaa=AN`, `provincia=SE`:
 *
 *   - Festivos NACIONALES de los años del JSON laboral BOE (todos aplican).
 *   - Festivos AUTONÓMICOS de AN del JSON laboral.
 *   - Vacaciones AUTONÓMICAS (Navidad, Semana Santa) del calendario escolar
 *     AN como `Festivo` con rango.
 *   - Día Comunidad Educativa AUTONÓMICO (fecha única).
 *   - Día no lectivo PROVINCIAL de SE.
 *   - CalendarioEscolarCcaa por etapa para ese curso académico (auxiliar).
 *
 * NUNCA toca filas existentes ni borra: solo INSERT cuando no existe match.
 */
class CentroFestivoSyncService
{
    private const PATH_FESTIVOS_LABORALES = 'catalogo/calendario/curated/festivos.json';
    private const PATH_CALENDARIO_ESCOLAR_CCAA = 'catalogo/calendario-escolar/%s/curated/calendario-escolar.json';

    public function __construct(
        private readonly FilesystemOperator $storage,
        private readonly EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    /**
     * Auto-ingest desde staging local antes de leer de MinIO. Si el repo
     * tiene una versión más reciente del JSON curado en
     * `backend/var/staging/calendario-escolar-{ccaa}/`, la sube a MinIO
     * (junto con los PDFs del subdirectorio `source/`) sobrescribiendo lo
     * que hubiera. Esto evita el paso manual `app:calendario:ingest-escolar`
     * cuando el operador edita el staging directamente desde la máquina.
     *
     * Idempotente: si los archivos no existen en local, no hace nada y se
     * sigue leyendo lo que ya hubiera en MinIO.
     */
    private function autoIngestFromStaging(Ccaa $ccaa): void
    {
        $stagingDir = sprintf('%s/var/staging/calendario-escolar-%s', $this->projectDir, strtolower($ccaa->value));
        $jsonLocal = $stagingDir . '/curated/calendario-escolar.json';
        if (is_file($jsonLocal)) {
            $contenido = file_get_contents($jsonLocal);
            $decoded = json_decode($contenido, true);
            if (is_array($decoded) && ($decoded['ccaa'] ?? null) === $ccaa->value) {
                $this->storage->write(sprintf(self::PATH_CALENDARIO_ESCOLAR_CCAA, $ccaa->value), $contenido);
            }
        }
        $sourceDir = $stagingDir . '/source';
        if (is_dir($sourceDir)) {
            foreach (glob($sourceDir . '/*.pdf') ?: [] as $pdf) {
                $name = basename($pdf);
                $this->storage->write(
                    sprintf('catalogo/calendario-escolar/%s/source/%s', $ccaa->value, $name),
                    file_get_contents($pdf)
                );
            }
        }
    }

    /**
     * @return array{
     *   nacionales: int, autonomicos: int, provinciales: int, vacaciones: int,
     *   etapas: int, sinCambios: int, mensajes: string[]
     * }
     */
    public function sync(Centro $centro): array
    {
        $stats = [
            'nacionales' => 0,
            'autonomicos' => 0,
            'provinciales' => 0,
            'vacaciones' => 0,
            'etapas' => 0,
            'sinCambios' => 0,
            'mensajes' => [],
        ];

        $ccaa = $centro->getCcaa();
        $provincia = $centro->getProvincia();

        if (!$ccaa) {
            $stats['mensajes'][] = 'El centro no tiene CCAA asignada — no se cargarán festivos autonómicos ni provinciales. Configúrala en /admin/centros.';
        } else {
            // Antes de leer de MinIO, sube la versión más reciente del staging
            // local (si la hay) para que MinIO refleje los cambios sin pedir
            // ejecutar `app:calendario:ingest-escolar` a mano.
            $this->autoIngestFromStaging($ccaa);
        }

        $repoFest = $this->em->getRepository(Festivo::class);

        // 1. Festivos laborales (BOE) — nacionales + autonómicos del centro.
        if ($this->storage->fileExists(self::PATH_FESTIVOS_LABORALES)) {
            $data = json_decode($this->storage->read(self::PATH_FESTIVOS_LABORALES), true);
            foreach (($data['anios'] ?? []) as $anio => $bloque) {
                foreach (($bloque['nacionales'] ?? []) as $f) {
                    $r = $this->upsertFestivo(
                        $repoFest,
                        AmbitoFestivo::NACIONAL,
                        null,
                        null,
                        null,
                        $f['nombre'],
                        new \DateTime($f['fecha']),
                        null,
                    );
                    $stats[$r === 'nuevas' ? 'nacionales' : 'sinCambios']++;
                }
                if ($ccaa && isset($bloque['autonomicos'][$ccaa->value])) {
                    foreach ($bloque['autonomicos'][$ccaa->value] as $f) {
                        $r = $this->upsertFestivo(
                            $repoFest,
                            AmbitoFestivo::AUTONOMICO,
                            $ccaa,
                            null,
                            null,
                            $f['nombre'],
                            new \DateTime($f['fecha']),
                            null,
                        );
                        $stats[$r === 'nuevas' ? 'autonomicos' : 'sinCambios']++;
                    }
                }
            }
        } else {
            $stats['mensajes'][] = 'No existe ' . self::PATH_FESTIVOS_LABORALES . ' en MinIO. Ejecuta primero `app:calendario:ingest` + `app:calendario:seed`.';
        }

        // 2. Calendario escolar autonómico — vacaciones + día Comunidad +
        //    provincial del centro + CalendarioEscolarCcaa por etapa.
        if ($ccaa) {
            $pathEsc = sprintf(self::PATH_CALENDARIO_ESCOLAR_CCAA, $ccaa->value);
            if ($this->storage->fileExists($pathEsc)) {
                $data = json_decode($this->storage->read($pathEsc), true);
                $anioAcademico = (string) ($data['anio_academico'] ?? '');
                $fuenteUrl = $data['fuente']['url'] ?? null;
                $fuenteFecha = isset($data['fuente']['fecha_firma']) ? new \DateTime($data['fuente']['fecha_firma']) : null;

                // Etapas (auxiliares — alimentan la sugerencia de fechas curso en /admin/centros).
                $repoCal = $this->em->getRepository(CalendarioEscolarCcaa::class);
                foreach (($data['etapas'] ?? []) as $etapaCode => $info) {
                    $etapa = EtapaEducativa::tryFrom(strtolower($etapaCode));
                    if (!$etapa) continue;
                    $existente = $repoCal->findOneBy([
                        'ccaa' => $ccaa,
                        'anioAcademico' => $anioAcademico,
                        'etapa' => $etapa,
                    ]);
                    if ($existente) {
                        $stats['sinCambios']++;
                        continue;
                    }
                    $cal = new CalendarioEscolarCcaa();
                    $cal->setCcaa($ccaa);
                    $cal->setAnioAcademico($anioAcademico);
                    $cal->setEtapa($etapa);
                    $cal->setFechaInicio(new \DateTime($info['fechaInicio']));
                    $cal->setFechaFin(new \DateTime($info['fechaFin']));
                    $cal->setDiasLectivos($info['diasLectivos'] ?? null);
                    $cal->setHorasDocencia($info['horasDocenciaDirecta'] ?? null);
                    $cal->setFuenteUrl($fuenteUrl);
                    $cal->setFuenteFecha($fuenteFecha);
                    $cal->setComentario($info['comentario'] ?? null);
                    $this->em->persist($cal);
                    $stats['etapas']++;
                }

                // Vacaciones autonómicas (rangos).
                foreach (($data['vacaciones_autonomicas'] ?? []) as $f) {
                    $r = $this->upsertFestivo(
                        $repoFest,
                        AmbitoFestivo::AUTONOMICO,
                        $ccaa,
                        null,
                        null,
                        $f['nombre'],
                        new \DateTime($f['fechaInicio']),
                        isset($f['fechaFin']) ? new \DateTime($f['fechaFin']) : null,
                    );
                    $stats[$r === 'nuevas' ? 'vacaciones' : 'sinCambios']++;
                }

                // Días no lectivos autonómicos (fecha única).
                foreach (($data['dias_no_lectivos_autonomicos'] ?? []) as $f) {
                    $r = $this->upsertFestivo(
                        $repoFest,
                        AmbitoFestivo::AUTONOMICO,
                        $ccaa,
                        null,
                        null,
                        $f['nombre'],
                        new \DateTime($f['fecha']),
                        null,
                    );
                    $stats[$r === 'nuevas' ? 'autonomicos' : 'sinCambios']++;
                }

                // Días no lectivos PROVINCIALES — solo los de la provincia del centro.
                if ($provincia) {
                    $provCode = $provincia->getCodigo();
                    $itemsProv = $data['dias_no_lectivos_provinciales'][$provCode] ?? null;
                    if ($itemsProv) {
                        foreach ($itemsProv as $f) {
                            $r = $this->upsertFestivo(
                                $repoFest,
                                AmbitoFestivo::PROVINCIAL,
                                null,
                                $provincia,
                                null,
                                $f['nombre'],
                                new \DateTime($f['fecha']),
                                isset($f['fechaFin']) ? new \DateTime($f['fechaFin']) : null,
                            );
                            $stats[$r === 'nuevas' ? 'provinciales' : 'sinCambios']++;
                        }
                    } else {
                        $stats['mensajes'][] = sprintf(
                            'No hay datos del calendario escolar para la provincia %s en %s. Solo se cargaron los autonómicos.',
                            $provCode, $ccaa->value
                        );
                    }
                } else {
                    $stats['mensajes'][] = 'El centro no tiene provincia asignada — no se cargarán festivos provinciales.';
                }
            } else {
                $stats['mensajes'][] = sprintf(
                    'No existe %s en MinIO. Ejecuta `app:calendario:ingest-escolar --ccaa=%s` para esta CCAA.',
                    $pathEsc, $ccaa->value
                );
            }
        }

        $this->em->flush();

        return $stats;
    }

    /**
     * @return string 'nuevas' | 'sinCambios'
     */
    private function upsertFestivo(
        $repo,
        AmbitoFestivo $ambito,
        ?Ccaa $ccaa,
        ?\App\Entity\Provincia $provincia,
        ?Centro $centro,
        string $nombre,
        \DateTime $fechaInicio,
        ?\DateTime $fechaFin,
    ): string {
        $criteria = ['ambito' => $ambito->value, 'fechaInicio' => $fechaInicio, 'nombre' => $nombre];
        if ($ccaa) $criteria['ccaa'] = $ccaa->value;
        if ($provincia) $criteria['provincia'] = $provincia;
        if ($centro) $criteria['centro'] = $centro;

        $existente = $repo->findOneBy($criteria);
        if ($existente) {
            return 'sinCambios';
        }

        $f = new Festivo();
        $f->setNombre($nombre);
        $f->setFechaInicio($fechaInicio);
        $f->setFechaFin($fechaFin);
        $f->setAmbito($ambito);
        if ($ccaa) $f->setCcaa($ccaa);
        if ($provincia) $f->setProvincia($provincia);
        if ($centro) $f->setCentro($centro);
        $this->em->persist($f);
        return 'nuevas';
    }
}
