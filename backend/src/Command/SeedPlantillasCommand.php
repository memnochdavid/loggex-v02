<?php

namespace App\Command;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Entity\TipoPeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Crea una PLANTILLA viva por cada grupo que no la tenga.
 *
 *   php bin/console app:semanas:seed-plantillas [--with-plis]
 *
 * Necesario tras la migration `Version20260506180000` que limpia el
 * subgrafo PL: deja a los grupos sin PLANTILLA, y este comando los
 * rearranca para que `/admin/horarios` y los demás endpoints sigan
 * encontrando un PL aplicable.
 *
 * Con `--with-plis`: tras crear cada PLANTILLA, le añade un PLI por
 * cada Imparticion viva del grupo (con `minutosSemanales=NULL`,
 * heredando `Materia.minutosSemanales`). Útil para que la cobertura
 * anual cuadre sin que el admin tenga que tocar nada.
 *
 * Idempotente: si el grupo ya tiene PLANTILLA viva, no hace nada.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 */
#[AsCommand(
    name: 'app:semanas:seed-plantillas',
    description: 'Crea una PLANTILLA por grupo que no la tenga (idempotente).'
)]
final class SeedPlantillasCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('with-plis', null, null, 'Crear PLI por cada imparticion del grupo tras crear la plantilla.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $withPlis = (bool) $input->getOption('with-plis');

        $grupos = $this->em->getRepository(Grupo::class)->createQueryBuilder('g')
            ->andWhere('g.deleted = false')
            ->orderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();

        $io->section(sprintf('Procesando %d grupos vivos', count($grupos)));

        $creados = 0;
        $existentes = 0;
        $plisCreados = 0;

        foreach ($grupos as $grupo) {
            /** @var Grupo $grupo */
            $existing = $this->em->getRepository(PeriodoLectivo::class)->createQueryBuilder('pl')
                ->andWhere('pl.grupo = :g')
                ->andWhere('pl.deleted = false')
                ->andWhere('pl.tipo = :t')
                ->setParameter('g', $grupo)
                ->setParameter('t', TipoPeriodoLectivo::PLANTILLA->value)
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();

            if ($existing !== null) {
                $existentes++;
                continue;
            }

            $plantilla = new PeriodoLectivo();
            $plantilla->setGrupo($grupo);
            $plantilla->setTipo(TipoPeriodoLectivo::PLANTILLA);
            $plantilla->setNombre('Plantilla del curso');
            $this->em->persist($plantilla);
            $this->em->flush();
            $creados++;

            if ($withPlis) {
                $imps = $this->em->getRepository(Imparticion::class)->createQueryBuilder('i')
                    ->andWhere('i.grupo = :g')
                    ->andWhere('i.deleted = false')
                    ->setParameter('g', $grupo)
                    ->getQuery()
                    ->getResult();

                foreach ($imps as $imp) {
                    $pli = new PeriodoLectivoImparticion();
                    $pli->setPeriodoLectivo($plantilla);
                    $pli->setImparticion($imp);
                    $this->em->persist($pli);
                    $plisCreados++;
                }
                if (count($imps) > 0) {
                    $this->em->flush();
                }
            }
        }

        $io->success([
            sprintf('PLANTILLAs creadas: %d', $creados),
            sprintf('Grupos con PLANTILLA ya existente (idempotencia): %d', $existentes),
            $withPlis ? sprintf('PLIs creados: %d', $plisCreados) : 'PLIs no creados (usa --with-plis para añadirlos).',
        ]);

        return Command::SUCCESS;
    }
}
