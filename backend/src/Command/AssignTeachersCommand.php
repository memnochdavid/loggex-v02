<?php

namespace App\Command;

use App\Entity\Imparticion;
use App\Entity\Modulo;
use App\Entity\User;
use App\Entity\Grupo;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:assign-teachers',
    description: 'Asigna profesores a módulos y grupos basándose en datos antiguos',
)]
class AssignTeachersCommand extends Command
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        // Datos extraídos de backup_tfg_old.sql (tabla imparticion)
        // id, profesor_id, modulo_id, grupo_id
        $imparticionesData = [
            [23, 50, 35, 5],
            [24, 51, 36, 5],
            [25, 52, 37, 5],
            [26, 53, 38, 5],
            [27, 54, 39, 5],
            [28, 55, 40, 5],
            [29, 56, 41, 6],
            [30, 50, 42, 6],
            [31, 51, 43, 6],
            [32, 52, 44, 6],
            [33, 53, 45, 6],
            [34, 52, 23, 7],
            [35, 53, 24, 7],
            [36, 54, 25, 7],
            [37, 55, 26, 7],
            [38, 56, 27, 7],
            [39, 50, 28, 7],
            [40, 51, 29, 8],
            [41, 52, 30, 8],
            [42, 53, 31, 8],
            [43, 54, 32, 8],
            [44, 56, 33, 8],
            [45, 56, 34, 8],
        ];

        $count = 0;
        foreach ($imparticionesData as $data) {
            $profesorId = $data[1];
            $moduloId = $data[2];
            $grupoId = $data[3];

            // Buscar entidades
            $profesor = $this->entityManager->getRepository(User::class)->find($profesorId);
            $modulo = $this->entityManager->getRepository(Modulo::class)->find($moduloId);
            $grupo = $this->entityManager->getRepository(Grupo::class)->find($grupoId);

            if ($profesor && $modulo && $grupo) {
                // Verificar si ya existe la impartición
                $existing = $this->entityManager->getRepository(Imparticion::class)->findOneBy([
                    'profesor' => $profesor,
                    'modulo' => $modulo,
                    'grupo' => $grupo
                ]);

                if (!$existing) {
                    $imparticion = new Imparticion();
                    $imparticion->setProfesor($profesor);
                    $imparticion->setModulo($modulo);
                    $imparticion->setGrupo($grupo);

                    $this->entityManager->persist($imparticion);
                    $count++;
                }
            } else {
                $io->warning("No se pudo crear impartición: Profesor $profesorId, Módulo $moduloId o Grupo $grupoId no encontrados.");
            }
        }

        $this->entityManager->flush();
        $io->success("Se han creado $count imparticiones.");

        return Command::SUCCESS;
    }
}
