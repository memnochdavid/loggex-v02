<?php

namespace App\Service;

use App\Entity\AmbitoFestivo;
use App\Entity\CalendarioEscolarCcaa;
use App\Entity\Centro;
use App\Entity\EtapaEducativa;
use App\Entity\Festivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Calcula las semanas y días lectivos REALES de un centro a partir del
 * calendario oficial, descontando festivos aplicables.
 *
 * Cascada de fechas (cuál se usa como ventana del cálculo):
 *
 *   1. Override pasado por argumento (`$fechaInicioOverride`/`$fechaFinOverride`).
 *   2. `Centro.fechaInicioCurso` / `Centro.fechaFinCurso` (override del centro).
 *   3. `CalendarioEscolarCcaa(centro.ccaa, anioAcademico, etapa)` — fecha
 *      oficial de la Resolución autonómica.
 *   4. NULL: si nada aplica, se devuelve `origen='fallback'` con `semanas=null`
 *      para que el llamador caiga al valor LOMLOE de referencia (36).
 *
 * Festivos descontados:
 *   - Ámbito NACIONAL (siempre).
 *   - Ámbito AUTONOMICO con `centro.ccaa`.
 *   - Ámbito PROVINCIAL con `centro.provincia`.
 *   - Ámbito LOCAL con `centro`.
 *   Festivos con `fechaFin` (rangos de vacaciones) descuentan todos los días
 *   del intervalo.
 *
 * Solo cuenta días L-V (días naturales L-V que no caen en festivo). El
 * resultado es `semanas = diasLectivos / 5.0` (decimal — el llamador decide
 * si redondea según contexto).
 */
class CalendarioLectivoService
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    /**
     * @return array{semanas: float|null, diasLectivos: int|null, fechaInicio: ?\DateTimeInterface, fechaFin: ?\DateTimeInterface, origen: string}
     */
    public function semanasLectivas(
        Centro $centro,
        ?EtapaEducativa $etapa = null,
        ?\DateTimeInterface $fechaInicioOverride = null,
        ?\DateTimeInterface $fechaFinOverride = null,
        ?string $anioAcademico = null,
    ): array {
        [$inicio, $fin, $origen] = $this->resolveVentana(
            $centro, $etapa, $fechaInicioOverride, $fechaFinOverride, $anioAcademico
        );

        if ($inicio === null || $fin === null) {
            return [
                'semanas' => null,
                'diasLectivos' => null,
                'fechaInicio' => null,
                'fechaFin' => null,
                'origen' => 'fallback',
            ];
        }

        $diasLectivos = $this->contarDiasLectivos($centro, $inicio, $fin);

        return [
            'semanas' => $diasLectivos / 5.0,
            'diasLectivos' => $diasLectivos,
            'fechaInicio' => $inicio,
            'fechaFin' => $fin,
            'origen' => $origen,
        ];
    }

    /**
     * @return array{0: ?\DateTimeInterface, 1: ?\DateTimeInterface, 2: string}
     */
    private function resolveVentana(
        Centro $centro,
        ?EtapaEducativa $etapa,
        ?\DateTimeInterface $inicio,
        ?\DateTimeInterface $fin,
        ?string $anioAcademico,
    ): array {
        if ($inicio !== null && $fin !== null) {
            return [$inicio, $fin, 'override'];
        }

        if ($centro->getFechaInicioCurso() !== null && $centro->getFechaFinCurso() !== null) {
            return [$centro->getFechaInicioCurso(), $centro->getFechaFinCurso(), 'centro'];
        }

        if ($centro->getCcaa() !== null && $etapa !== null) {
            $anio = $anioAcademico ?? $this->cursoAcademicoActual();
            $cal = $this->em->getRepository(CalendarioEscolarCcaa::class)->findOneBy([
                'ccaa' => $centro->getCcaa(),
                'anioAcademico' => $anio,
                'etapa' => $etapa,
            ]);
            if ($cal) {
                return [$cal->getFechaInicio(), $cal->getFechaFin(), 'ccaa'];
            }
        }

        return [null, null, 'fallback'];
    }

    private function contarDiasLectivos(Centro $centro, \DateTimeInterface $inicio, \DateTimeInterface $fin): int
    {
        $dias = $this->indexarFestivosAplicables($centro, $inicio, $fin);

        $cur = (new \DateTime($inicio->format('Y-m-d')));
        $end = (new \DateTime($fin->format('Y-m-d')));
        $count = 0;
        while ($cur <= $end) {
            $dow = (int) $cur->format('N'); // 1=Mon .. 7=Sun
            if ($dow <= 5 && !isset($dias[$cur->format('Y-m-d')])) {
                $count++;
            }
            $cur->modify('+1 day');
        }
        return $count;
    }

    /**
     * Devuelve un set indexado por 'Y-m-d' con los días no lectivos por
     * festivos aplicables al centro dentro del rango [inicio, fin].
     *
     * @return array<string, true>
     */
    private function indexarFestivosAplicables(Centro $centro, \DateTimeInterface $inicio, \DateTimeInterface $fin): array
    {
        $qb = $this->em->getRepository(Festivo::class)->createQueryBuilder('f')
            ->where('f.deleted = 0')
            ->andWhere('f.fechaInicio <= :fin')
            ->andWhere('COALESCE(f.fechaFin, f.fechaInicio) >= :inicio')
            ->andWhere(
                "(f.ambito = :nacional)"
                . " OR (f.ambito = :autonomico AND f.ccaa = :ccaa)"
                . " OR (f.ambito = :provincial AND f.provincia = :provincia)"
                . " OR (f.ambito = :local AND f.centro = :centro)"
            )
            ->setParameter('fin', $fin->format('Y-m-d'))
            ->setParameter('inicio', $inicio->format('Y-m-d'))
            ->setParameter('nacional', AmbitoFestivo::NACIONAL->value)
            ->setParameter('autonomico', AmbitoFestivo::AUTONOMICO->value)
            ->setParameter('provincial', AmbitoFestivo::PROVINCIAL->value)
            ->setParameter('local', AmbitoFestivo::LOCAL->value)
            ->setParameter('ccaa', $centro->getCcaa()?->value)
            ->setParameter('provincia', $centro->getProvincia())
            ->setParameter('centro', $centro);

        $festivos = $qb->getQuery()->getResult();

        $set = [];
        foreach ($festivos as $f) {
            /** @var Festivo $f */
            $iniF = $f->getFechaInicio();
            $finF = $f->getFechaFin() ?? $iniF;
            $cur = new \DateTime($iniF->format('Y-m-d'));
            $end = new \DateTime($finF->format('Y-m-d'));
            while ($cur <= $end) {
                $set[$cur->format('Y-m-d')] = true;
                $cur->modify('+1 day');
            }
        }
        return $set;
    }

    /**
     * Curso académico al que pertenece la fecha de hoy. Si hoy ≥ 1-jul, el
     * curso es `Y-(Y+1)`; si no, `(Y-1)-Y`.
     */
    private function cursoAcademicoActual(): string
    {
        $hoy = new \DateTime();
        $y = (int) $hoy->format('Y');
        $m = (int) $hoy->format('n');
        if ($m >= 7) {
            return sprintf('%d-%d', $y, $y + 1);
        }
        return sprintf('%d-%d', $y - 1, $y);
    }
}
