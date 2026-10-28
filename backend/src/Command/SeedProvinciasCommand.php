<?php

namespace App\Command;

use App\Entity\Ccaa;
use App\Entity\Provincia;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Carga las 52 provincias españolas (50 + Ceuta + Melilla) con su CCAA.
 * Datos hard-coded por código INE (estables: las provincias no cambian).
 *
 *   php bin/console app:seed:provincias
 *
 * Idempotente: salta las que ya existen, solo añade las nuevas.
 */
#[AsCommand(
    name: 'app:seed:provincias',
    description: 'Carga las 52 provincias españolas con su CCAA (idempotente).'
)]
final class SeedProvinciasCommand extends Command
{
    /**
     * Tabla código INE → [nombre, código CCAA ISO 3166-2:ES].
     */
    private const PROVINCIAS = [
        '01' => ['Álava', 'PV'],
        '02' => ['Albacete', 'CM'],
        '03' => ['Alicante', 'VC'],
        '04' => ['Almería', 'AN'],
        '05' => ['Ávila', 'CL'],
        '06' => ['Badajoz', 'EX'],
        '07' => ['Illes Balears', 'IB'],
        '08' => ['Barcelona', 'CT'],
        '09' => ['Burgos', 'CL'],
        '10' => ['Cáceres', 'EX'],
        '11' => ['Cádiz', 'AN'],
        '12' => ['Castellón', 'VC'],
        '13' => ['Ciudad Real', 'CM'],
        '14' => ['Córdoba', 'AN'],
        '15' => ['A Coruña', 'GA'],
        '16' => ['Cuenca', 'CM'],
        '17' => ['Girona', 'CT'],
        '18' => ['Granada', 'AN'],
        '19' => ['Guadalajara', 'CM'],
        '20' => ['Gipuzkoa', 'PV'],
        '21' => ['Huelva', 'AN'],
        '22' => ['Huesca', 'AR'],
        '23' => ['Jaén', 'AN'],
        '24' => ['León', 'CL'],
        '25' => ['Lleida', 'CT'],
        '26' => ['La Rioja', 'RI'],
        '27' => ['Lugo', 'GA'],
        '28' => ['Madrid', 'MD'],
        '29' => ['Málaga', 'AN'],
        '30' => ['Murcia', 'MC'],
        '31' => ['Navarra', 'NC'],
        '32' => ['Ourense', 'GA'],
        '33' => ['Asturias', 'AS'],
        '34' => ['Palencia', 'CL'],
        '35' => ['Las Palmas', 'CN'],
        '36' => ['Pontevedra', 'GA'],
        '37' => ['Salamanca', 'CL'],
        '38' => ['Santa Cruz de Tenerife', 'CN'],
        '39' => ['Cantabria', 'CB'],
        '40' => ['Segovia', 'CL'],
        '41' => ['Sevilla', 'AN'],
        '42' => ['Soria', 'CL'],
        '43' => ['Tarragona', 'CT'],
        '44' => ['Teruel', 'AR'],
        '45' => ['Toledo', 'CM'],
        '46' => ['Valencia', 'VC'],
        '47' => ['Valladolid', 'CL'],
        '48' => ['Bizkaia', 'PV'],
        '49' => ['Zamora', 'CL'],
        '50' => ['Zaragoza', 'AR'],
        '51' => ['Ceuta', 'CE'],
        '52' => ['Melilla', 'ML'],
    ];

    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Seed de provincias españolas');

        $repo = $this->em->getRepository(Provincia::class);
        $stats = ['nuevas' => 0, 'sinCambios' => 0];

        foreach (self::PROVINCIAS as $codigo => [$nombre, $ccaaCode]) {
            if ($repo->find($codigo)) {
                $stats['sinCambios']++;
                continue;
            }
            $ccaa = Ccaa::from($ccaaCode);
            $this->em->persist(new Provincia($codigo, $nombre, $ccaa));
            $stats['nuevas']++;
        }

        $this->em->flush();

        $io->definitionList(
            ['Provincias nuevas' => $stats['nuevas']],
            ['Sin cambios' => $stats['sinCambios']],
            ['Total' => count(self::PROVINCIAS)],
        );
        $io->success('Seed completado.');
        return Command::SUCCESS;
    }
}
