<?php

namespace App\Command;

use App\Entity\Centro;
use App\Entity\Itinerario;
use App\Entity\Grupo;
use App\Entity\Matricula;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:matricular-alumnos',
    description: 'Matricula alumnos en grupos repartiéndolos equitativamente',
)]
class MatricularAlumnosCommand extends Command
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $centros = $this->entityManager->getRepository(Centro::class)->findAll();

        foreach ($centros as $centro) {
            $io->section("Procesando centro: " . $centro->getNombre());

            // 1. Obtener o Crear Ciclos y Grupos si no existen
            $grupos = $this->entityManager->getRepository(Grupo::class)->findBy(['centro' => $centro]);

            if (empty($grupos)) {
                $io->text("No hay grupos. Creando grupos básicos...");

                // Buscar o crear ciclo
                $itinerario = $this->entityManager->getRepository(Itinerario::class)->findOneBy(['centro' => $centro]);
                if (!$itinerario) {
                    $itinerario = new Itinerario();
                    $itinerario->setNombre("Desarrollo de Aplicaciones Multiplataforma");
                    $itinerario->setNivel("Superior");
                    $itinerario->setCentro($centro);
                    $this->entityManager->persist($itinerario);
                }

                // Crear grupos 1º y 2º
                $grupo1 = new Grupo();
                $grupo1->setNombre("1º DAM");
                $grupo1->setCurso(1);
                $grupo1->setAnioEscolar(date('Y') . '-' . (date('Y') + 1));
                $grupo1->setItinerario($itinerario);
                $grupo1->setCentro($centro);
                $this->entityManager->persist($grupo1);

                $grupo2 = new Grupo();
                $grupo2->setNombre("2º DAM");
                $grupo2->setCurso(2);
                $grupo2->setAnioEscolar(date('Y') . '-' . (date('Y') + 1));
                $grupo2->setItinerario($itinerario);
                $grupo2->setCentro($centro);
                $this->entityManager->persist($grupo2);

                $this->entityManager->flush();
                $grupos = [$grupo1, $grupo2];
            }

            // 2. Obtener Alumnos del centro
            // Buscamos usuarios que tengan ROLE_ALUMNO (o rol_app = 'alumno') y pertenezcan al centro
            // Como los roles son JSON, es difícil filtrar por SQL directo de forma portable y sencilla con Doctrine estándar sin extensiones JSON.
            // Filtraremos en memoria (asumiendo que no son millones).
            $usuarios = $this->entityManager->getRepository(User::class)->findBy(['centro' => $centro]);
            $alumnos = array_filter($usuarios, function(User $u) {
                return in_array('ROLE_ALUMNO', $u->getRoles());
            });

            $io->text(sprintf("Encontrados %d alumnos.", count($alumnos)));

            // 3. Matricular
            $matriculadosCount = 0;
            foreach ($alumnos as $index => $alumno) {
                // Verificar si ya tiene matrícula
                $existingMatricula = $this->entityManager->getRepository(Matricula::class)->findOneBy(['alumno' => $alumno]);

                if (!$existingMatricula) {
                    $grupoAsignado = $grupos[$index % count($grupos)]; // Round-robin

                    $matricula = new Matricula();
                    $matricula->setAlumno($alumno);
                    $matricula->setGrupo($grupoAsignado);

                    $this->entityManager->persist($matricula);
                    $matriculadosCount++;
                }
            }

            $io->text("Matriculados $matriculadosCount alumnos nuevos.");
        }

        $this->entityManager->flush();
        $io->success('Proceso de matriculación completado.');

        return Command::SUCCESS;
    }
}
