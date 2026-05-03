<?php

namespace App\Command;

use App\Entity\Grupo;
use App\Service\ConsumicionAnualService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Debug del servicio de consumición anual (Fase 8 PL):
 *   docker compose exec backend php bin/console app:fase8:consumicion <grupoId> [--fecha=YYYY-MM-DD]
 *
 * Imprime JSON crudo del cómputo para validar que cuadra antes de invertir
 * en UI. No persiste nada — sólo lectura.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8
 */
#[AsCommand(name: 'app:fase8:consumicion', description: 'Dump JSON del servicio ConsumicionAnualService para un grupo.')]
class ConsumicionAnualDebugCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ConsumicionAnualService $service,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('grupoId', InputArgument::REQUIRED, 'ID del grupo');
        $this->addOption('fecha', null, InputOption::VALUE_REQUIRED, 'Fecha de referencia YYYY-MM-DD (default: hoy)');
        $this->addOption('summary', null, InputOption::VALUE_NONE, 'Imprimir solo resumen tabular en lugar del JSON completo');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $grupoId = (int) $input->getArgument('grupoId');
        $grupo = $this->em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            $output->writeln("<error>Grupo $grupoId no encontrado.</error>");
            return Command::FAILURE;
        }

        $fechaOpt = $input->getOption('fecha');
        $fecha = $fechaOpt ? new \DateTime($fechaOpt) : null;

        $r = $this->service->computeForGrupo($grupo, $fecha);

        if ($input->getOption('summary')) {
            $output->writeln(sprintf(
                "<info>%s — fecha ref %s — %s%% del curso (%d/%d días lectivos)</info>",
                $r['grupoNombre'],
                $r['fechaReferencia'],
                $r['porcentajeCursoTranscurrido'],
                $r['diasLectivosTranscurridos'],
                $r['diasLectivosTotales'],
            ));
            $output->writeln('');
            $output->writeln(sprintf("<comment>Rangos: %d</comment>", count($r['rangos'])));
            foreach ($r['rangos'] as $rg) {
                $output->writeln(sprintf(
                    "  [#%d] %s (%s → %s) — %s sem totales / %s sem trans / jornada %dh/sem",
                    $rg['id'], $rg['nombre'], $rg['fechaInicio'], $rg['fechaFin'],
                    number_format($rg['semanas'], 1),
                    number_format($rg['semanasTranscurridas'], 1),
                    intdiv($rg['jornadaSemanaMinutos'], 60),
                ));
            }
            $output->writeln('');
            $output->writeln(sprintf("<comment>Materias: %d</comment>", count($r['materias'])));
            $output->writeln(str_pad("Materia", 40) . str_pad("Mod", 10) . str_pad("Curr (h)", 10) . str_pad("Plan (h)", 10) . str_pad("Imp hoy (h)", 12) . "Δ%");
            foreach ($r['materias'] as $m) {
                $curr = $m['minutosCurriculo'] / 60;
                $plan = $m['minutosPlanificadoTotal'] / 60;
                $imp  = $m['minutosImpartidosHoy'] / 60;
                $delta = $curr > 0 ? round(100.0 * ($plan - $curr) / $curr, 1) : 0.0;
                $output->writeln(
                    str_pad(substr((string) $m['materiaNombre'], 0, 38), 40)
                    . str_pad($m['modalidad'], 10)
                    . str_pad(number_format($curr, 1), 10)
                    . str_pad(number_format($plan, 1), 10)
                    . str_pad(number_format($imp, 1), 12)
                    . sprintf("%+.1f", $delta)
                );
            }
        } else {
            $output->writeln(json_encode($r, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        return Command::SUCCESS;
    }
}
