<?php

namespace App\Command;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:import-old-data',
    description: 'Importa datos del sistema antiguo respetando la nueva estructura',
)]
class ImportOldDataCommand extends Command
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $conn = $this->entityManager->getConnection();

        $io->title('Iniciando importación de datos antiguos...');

        // Desactivar checks de claves foráneas para poder truncar y reordenar
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');

        try {
            // 1. Limpiar tablas (Orden inverso de dependencia)
            // NO tocamos 'usuario' ni 'personalizacion'
            $tablesToTruncate = [
                'asistencia', 'calificacion', 'temario', 'entrega', 'tarea',
                'horario', 'matricula', 'imparticion', 'grupo', 'materia',
                'itinerario', 'festivo'
            ];

            foreach ($tablesToTruncate as $table) {
                $io->text("Limpiando tabla $table...");
                $conn->executeStatement("TRUNCATE TABLE $table");
            }

            // 2. Insertar Datos
            // CENTRO (Upsert para no romper usuarios existentes)
            $io->section('Importando Centros...');
            $this->insertCentro($conn);

            // FESTIVO
            $io->section('Importando Festivos...');
            $this->insertFestivo($conn);

            // CICLO FORMATIVO
            $io->section('Importando Ciclos Formativos...');
            $this->insertCicloFormativo($conn);

            // MODULO
            $io->section('Importando Módulos...');
            $this->insertModulo($conn);

            // GRUPO
            $io->section('Importando Grupos...');
            $this->insertGrupo($conn);

            // IMPARTICION
            $io->section('Importando Imparticiones (Profesores)...');
            $this->insertImparticion($conn);

            // MATRICULA
            $io->section('Importando Matrículas...');
            $this->insertMatricula($conn);

            // HORARIO
            $io->section('Importando Horarios...');
            $this->insertHorario($conn);

            // TAREA
            $io->section('Importando Tareas...');
            $this->insertTarea($conn);

            // ENTREGA
            $io->section('Importando Entregas...');
            $this->insertEntrega($conn);

            // CALIFICACION
            $io->section('Importando Calificaciones...');
            $this->insertCalificacion($conn);

            // MATERIAL
            $io->section('Importando Materiales...');
            $this->insertMaterial($conn);

            // ASISTENCIA
            $io->section('Importando Asistencias...');
            $this->insertAsistencia($conn);

            $io->success('Importación completada con éxito.');

        } catch (\Exception $e) {
            $io->error('Error durante la importación: ' . $e->getMessage());
            return Command::FAILURE;
        } finally {
            // Reactivar checks
            $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
        }

        return Command::SUCCESS;
    }

    private function insertCentro($conn)
    {
        $sql = "INSERT INTO centro (id, nombre, cif, activo, web_config, logo, direccion, telefono, created_at, deleted) VALUES
        (3,'Escuela Arte Granada','B18000000',1,NULL,'82a60d322ac7071d35e1bce779454d84068b4091.png','Av. Dr. Oloriz, 6, Beiro, 18012 Granada','958 27 80 60', NOW(), 0),
        (4,'IES Tecnológico TFG','B5363643538',1,NULL,'161072a8938d361bab5d9d4234e6e2eaa6488d8f.png','Calle Falsa, 123','958 11 11 11', NOW(), 0)
        ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), cif=VALUES(cif), direccion=VALUES(direccion), telefono=VALUES(telefono)";
        $conn->executeStatement($sql);
    }

    private function insertFestivo($conn)
    {
        $sql = "INSERT INTO festivo (id, nombre, fecha_inicio, centro_id, fecha_fin, created_at, deleted) VALUES
        (4,'Navidad','2025-12-22',NULL,'2026-01-06', NOW(), 0),
        (5,'Semana Santa','2026-03-28',NULL,'2026-04-05', NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertCicloFormativo($conn)
    {
        $sql = "INSERT INTO ciclo_formativo (id, nombre, nivel, centro_id, created_at, deleted) VALUES
        (3,'Desarrollo de Aplicaciones Web','Superior',3, NOW(), 0),
        (4,'Desarrollo de Aplicaciones Multiplataforma','Superior',3, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertModulo($conn)
    {
        $sql = "INSERT INTO modulo (id, nombre, codigo_oficial, ciclo_id, curso, horas_semanales, created_at, deleted) VALUES
        (23,'Bases de datos','0001',4,1,6, NOW(), 0),
        (24,'Entornos de desarrollo','0002',4,1,3, NOW(), 0),
        (25,'Lenguajes de marcas','0003',4,1,4, NOW(), 0),
        (26,'Programación','0004',4,1,8, NOW(), 0),
        (27,'Sistemas informáticos','0005',4,1,6, NOW(), 0),
        (28,'FOL','0006',4,1,3, NOW(), 0),
        (29,'Acceso a datos','0007',4,2,6, NOW(), 0),
        (30,'Desarrollo de interfaces','0008',4,2,6, NOW(), 0),
        (31,'Programación multimedia','0009',4,2,5, NOW(), 0),
        (32,'Servicios y procesos','0010',4,2,5, NOW(), 0),
        (33,'Sistemas de gestión','0011',4,2,5, NOW(), 0),
        (34,'EIE','0012',4,2,3, NOW(), 0),
        (35,'Bases de datos','0001',3,1,6, NOW(), 0),
        (36,'Entornos de desarrollo','0002',3,1,3, NOW(), 0),
        (37,'Lenguajes de marcas','0003',3,1,4, NOW(), 0),
        (38,'Programación','0004',3,1,8, NOW(), 0),
        (39,'Sistemas informáticos','0005',3,1,6, NOW(), 0),
        (40,'FOL','0006',3,1,3, NOW(), 0),
        (41,'Desarrollo Cliente','0013',3,2,7, NOW(), 0),
        (42,'Desarrollo Servidor','0014',3,2,8, NOW(), 0),
        (43,'Despliegue Apps','0015',3,2,4, NOW(), 0),
        (44,'Diseño de Interfaces','0016',3,2,6, NOW(), 0),
        (45,'EIE','0017',3,2,5, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertGrupo($conn)
    {
        $sql = "INSERT INTO grupo (id, nombre, anio_escolar, ciclo_id, centro_id, curso, abreviatura, created_at, deleted) VALUES
        (5,'Desarrollo de Aplicaciones Web','2025/2026',3,3,1,'1º DAW', NOW(), 0),
        (6,'Desarrollo de Aplicaciones Web','2024/2025',3,3,2,'2º DAW', NOW(), 0),
        (7,'Desarrollo de Aplicaciones Multiplataforma','2025/2026',4,3,1,'1º DAM', NOW(), 0),
        (8,'Desarrollo de Aplicaciones Multiplataforma','2024/2025',4,3,2,'2º DAM', NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertImparticion($conn)
    {
        $sql = "INSERT INTO imparticion (id, profesor_id, modulo_id, grupo_id, created_at, deleted) VALUES
        (23,50,35,5, NOW(), 0),
        (24,51,36,5, NOW(), 0),
        (25,52,37,5, NOW(), 0),
        (26,53,38,5, NOW(), 0),
        (27,54,39,5, NOW(), 0),
        (28,55,40,5, NOW(), 0),
        (29,56,41,6, NOW(), 0),
        (30,50,42,6, NOW(), 0),
        (31,51,43,6, NOW(), 0),
        (32,52,44,6, NOW(), 0),
        (33,53,45,6, NOW(), 0),
        (34,52,23,7, NOW(), 0),
        (35,53,24,7, NOW(), 0),
        (36,54,25,7, NOW(), 0),
        (37,55,26,7, NOW(), 0),
        (38,56,27,7, NOW(), 0),
        (39,50,28,7, NOW(), 0),
        (40,51,29,8, NOW(), 0),
        (41,52,30,8, NOW(), 0),
        (42,53,31,8, NOW(), 0),
        (43,54,32,8, NOW(), 0),
        (44,56,33,8, NOW(), 0),
        (45,56,34,8, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertMatricula($conn)
    {
        $sql = "INSERT INTO matricula (id, alumno_id, grupo_id, created_at, deleted) VALUES
        (41,57,5, NOW(), 0),
        (42,58,5, NOW(), 0),
        (43,59,5, NOW(), 0),
        (44,60,5, NOW(), 0),
        (45,61,5, NOW(), 0),
        (46,62,6, NOW(), 0),
        (47,63,6, NOW(), 0),
        (48,64,6, NOW(), 0),
        (49,65,6, NOW(), 0),
        (50,66,6, NOW(), 0),
        (51,67,7, NOW(), 0),
        (52,68,7, NOW(), 0),
        (53,69,7, NOW(), 0),
        (54,70,7, NOW(), 0),
        (55,71,7, NOW(), 0),
        (56,72,8, NOW(), 0),
        (57,73,8, NOW(), 0),
        (58,74,8, NOW(), 0),
        (59,75,8, NOW(), 0),
        (60,76,8, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertHorario($conn)
    {
        $sql = "INSERT INTO horario (id, dia_semana, hora_inicio, hora_fin, aula, imparticion_id, created_at, deleted) VALUES
        (98,1,'08:30:00','09:30:00','Aula 101',23, NOW(), 0),
        (99,1,'09:30:00','10:30:00','Aula 101',23, NOW(), 0),
        (100,1,'10:30:00','11:30:00','Aula 101',24, NOW(), 0),
        (101,1,'11:30:00','12:30:00','Aula 101',24, NOW(), 0),
        (102,1,'12:30:00','13:30:00','Aula 101',25, NOW(), 0),
        (103,1,'13:30:00','14:30:00','Aula 101',25, NOW(), 0),
        (104,2,'08:30:00','09:30:00','Aula 101',23, NOW(), 0),
        (105,2,'09:30:00','10:30:00','Aula 101',23, NOW(), 0),
        (106,2,'10:30:00','11:30:00','Aula 101',25, NOW(), 0),
        (107,2,'11:30:00','12:30:00','Aula 101',25, NOW(), 0),
        (108,2,'12:30:00','13:30:00','Aula 101',26, NOW(), 0),
        (109,2,'13:30:00','14:30:00','Aula 101',26, NOW(), 0),
        (110,3,'08:30:00','09:30:00','Aula 101',23, NOW(), 0),
        (111,3,'09:30:00','10:30:00','Aula 101',23, NOW(), 0),
        (112,3,'10:30:00','11:30:00','Aula 101',26, NOW(), 0),
        (113,3,'11:30:00','12:30:00','Aula 101',26, NOW(), 0),
        (114,3,'12:30:00','13:30:00','Aula 101',27, NOW(), 0),
        (115,3,'13:30:00','14:30:00','Aula 101',27, NOW(), 0),
        (116,4,'08:30:00','09:30:00','Aula 101',26, NOW(), 0),
        (117,4,'09:30:00','10:30:00','Aula 101',26, NOW(), 0),
        (118,4,'10:30:00','11:30:00','Aula 101',27, NOW(), 0),
        (119,4,'11:30:00','12:30:00','Aula 101',27, NOW(), 0),
        (120,4,'12:30:00','13:30:00','Aula 101',28, NOW(), 0),
        (121,4,'13:30:00','14:30:00','Aula 101',28, NOW(), 0),
        (122,5,'08:30:00','09:30:00','Aula 101',26, NOW(), 0),
        (123,5,'09:30:00','10:30:00','Aula 101',26, NOW(), 0),
        (124,5,'10:30:00','11:30:00','Aula 101',27, NOW(), 0),
        (125,5,'11:30:00','12:30:00','Aula 101',27, NOW(), 0),
        (126,5,'12:30:00','13:30:00','Aula 101',24, NOW(), 0),
        (127,5,'13:30:00','14:30:00','Aula 101',28, NOW(), 0),
        (128,1,'08:30:00','09:30:00','Aula 102',29, NOW(), 0),
        (129,1,'09:30:00','10:30:00','Aula 102',29, NOW(), 0),
        (130,1,'10:30:00','11:30:00','Aula 102',30, NOW(), 0),
        (131,1,'11:30:00','12:30:00','Aula 102',30, NOW(), 0),
        (132,1,'12:30:00','13:30:00','Aula 102',31, NOW(), 0),
        (133,1,'13:30:00','14:30:00','Aula 102',31, NOW(), 0),
        (134,2,'08:30:00','09:30:00','Aula 102',29, NOW(), 0),
        (135,2,'09:30:00','10:30:00','Aula 102',29, NOW(), 0),
        (136,2,'10:30:00','11:30:00','Aula 102',30, NOW(), 0),
        (137,2,'11:30:00','12:30:00','Aula 102',30, NOW(), 0),
        (138,2,'12:30:00','13:30:00','Aula 102',31, NOW(), 0),
        (139,2,'13:30:00','14:30:00','Aula 102',31, NOW(), 0),
        (140,3,'08:30:00','09:30:00','Aula 102',29, NOW(), 0),
        (141,3,'09:30:00','10:30:00','Aula 102',29, NOW(), 0),
        (142,3,'10:30:00','11:30:00','Aula 102',30, NOW(), 0),
        (143,3,'11:30:00','12:30:00','Aula 102',30, NOW(), 0),
        (144,3,'12:30:00','13:30:00','Aula 102',32, NOW(), 0),
        (145,3,'13:30:00','14:30:00','Aula 102',32, NOW(), 0),
        (146,4,'08:30:00','09:30:00','Aula 102',30, NOW(), 0),
        (147,4,'09:30:00','10:30:00','Aula 102',30, NOW(), 0),
        (148,4,'10:30:00','11:30:00','Aula 102',32, NOW(), 0),
        (149,4,'11:30:00','12:30:00','Aula 102',32, NOW(), 0),
        (150,4,'12:30:00','13:30:00','Aula 102',33, NOW(), 0),
        (151,4,'13:30:00','14:30:00','Aula 102',33, NOW(), 0),
        (152,5,'08:30:00','09:30:00','Aula 102',32, NOW(), 0),
        (153,5,'09:30:00','10:30:00','Aula 102',32, NOW(), 0),
        (154,5,'10:30:00','11:30:00','Aula 102',33, NOW(), 0),
        (155,5,'11:30:00','12:30:00','Aula 102',33, NOW(), 0),
        (156,5,'12:30:00','13:30:00','Aula 102',29, NOW(), 0),
        (157,1,'15:00:00','16:00:00','Aula 103',34, NOW(), 0),
        (158,1,'16:00:00','17:00:00','Aula 103',34, NOW(), 0),
        (159,1,'17:00:00','18:00:00','Aula 103',35, NOW(), 0),
        (160,1,'18:00:00','19:00:00','Aula 103',35, NOW(), 0),
        (161,1,'19:00:00','20:00:00','Aula 103',36, NOW(), 0),
        (162,1,'20:00:00','21:00:00','Aula 103',36, NOW(), 0),
        (163,2,'15:00:00','16:00:00','Aula 103',34, NOW(), 0),
        (164,2,'16:00:00','17:00:00','Aula 103',34, NOW(), 0),
        (165,2,'17:00:00','18:00:00','Aula 103',36, NOW(), 0),
        (166,2,'18:00:00','19:00:00','Aula 103',36, NOW(), 0),
        (167,2,'19:00:00','20:00:00','Aula 103',37, NOW(), 0),
        (168,2,'20:00:00','21:00:00','Aula 103',37, NOW(), 0),
        (169,3,'15:00:00','16:00:00','Aula 103',34, NOW(), 0),
        (170,3,'16:00:00','17:00:00','Aula 103',34, NOW(), 0),
        (171,3,'17:00:00','18:00:00','Aula 103',37, NOW(), 0),
        (172,3,'18:00:00','19:00:00','Aula 103',37, NOW(), 0),
        (173,3,'19:00:00','20:00:00','Aula 103',38, NOW(), 0),
        (174,3,'20:00:00','21:00:00','Aula 103',38, NOW(), 0),
        (175,4,'15:00:00','16:00:00','Aula 103',37, NOW(), 0),
        (176,4,'16:00:00','17:00:00','Aula 103',37, NOW(), 0),
        (177,4,'17:00:00','18:00:00','Aula 103',38, NOW(), 0),
        (178,4,'18:00:00','19:00:00','Aula 103',38, NOW(), 0),
        (179,4,'19:00:00','20:00:00','Aula 103',39, NOW(), 0),
        (180,4,'20:00:00','21:00:00','Aula 103',39, NOW(), 0),
        (181,5,'15:00:00','16:00:00','Aula 103',37, NOW(), 0),
        (182,5,'16:00:00','17:00:00','Aula 103',37, NOW(), 0),
        (183,5,'17:00:00','18:00:00','Aula 103',38, NOW(), 0),
        (184,5,'18:00:00','19:00:00','Aula 103',38, NOW(), 0),
        (185,5,'19:00:00','20:00:00','Aula 103',35, NOW(), 0),
        (186,5,'20:00:00','21:00:00','Aula 103',39, NOW(), 0),
        (187,1,'15:00:00','16:00:00','Aula 104',40, NOW(), 0),
        (188,1,'16:00:00','17:00:00','Aula 104',40, NOW(), 0),
        (189,1,'17:00:00','18:00:00','Aula 104',41, NOW(), 0),
        (190,1,'18:00:00','19:00:00','Aula 104',41, NOW(), 0),
        (191,1,'19:00:00','20:00:00','Aula 104',42, NOW(), 0),
        (192,1,'20:00:00','21:00:00','Aula 104',42, NOW(), 0),
        (193,2,'15:00:00','16:00:00','Aula 104',40, NOW(), 0),
        (194,2,'16:00:00','17:00:00','Aula 104',40, NOW(), 0),
        (195,2,'17:00:00','18:00:00','Aula 104',41, NOW(), 0),
        (196,2,'18:00:00','19:00:00','Aula 104',41, NOW(), 0),
        (197,2,'19:00:00','20:00:00','Aula 104',42, NOW(), 0),
        (198,2,'20:00:00','21:00:00','Aula 104',42, NOW(), 0),
        (199,3,'15:00:00','16:00:00','Aula 104',40, NOW(), 0),
        (200,3,'16:00:00','17:00:00','Aula 104',40, NOW(), 0),
        (201,3,'17:00:00','18:00:00','Aula 104',41, NOW(), 0),
        (202,3,'18:00:00','19:00:00','Aula 104',41, NOW(), 0),
        (203,3,'19:00:00','20:00:00','Aula 104',43, NOW(), 0),
        (204,3,'20:00:00','21:00:00','Aula 104',43, NOW(), 0),
        (205,4,'15:00:00','16:00:00','Aula 104',43, NOW(), 0),
        (206,4,'16:00:00','17:00:00','Aula 104',43, NOW(), 0),
        (207,4,'17:00:00','18:00:00','Aula 104',44, NOW(), 0),
        (208,4,'18:00:00','19:00:00','Aula 104',44, NOW(), 0),
        (209,4,'19:00:00','20:00:00','Aula 104',45, NOW(), 0),
        (210,4,'20:00:00','21:00:00','Aula 104',45, NOW(), 0),
        (211,5,'15:00:00','16:00:00','Aula 104',44, NOW(), 0),
        (212,5,'16:00:00','17:00:00','Aula 104',44, NOW(), 0),
        (213,5,'17:00:00','18:00:00','Aula 104',42, NOW(), 0),
        (214,5,'18:00:00','19:00:00','Aula 104',43, NOW(), 0),
        (215,5,'19:00:00','20:00:00','Aula 104',45, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertTarea($conn)
    {
        $sql = "INSERT INTO tarea (id, titulo, descripcion, fecha_limite, visible, imparticion_id, fecha_inicio, tipo, created_at, deleted) VALUES
        (9,'Examen T5','<div>Examen T5 Examen T5 Examen T5 Examen T5 Examen T5 Examen T5</div>','2025-12-23 12:30:00',1,24,'2025-12-23 10:30:00','examen', NOW(), 0),
        (10,'Ejercicios T2','<div>Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2&nbsp;</div>','2025-12-24 16:01:00',1,24,'2025-12-22 16:01:00','tarea', NOW(), 0),
        (11,'Ejercicios T3','<div>Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3</div>','2025-12-24 16:02:00',1,24,'2025-12-22 16:02:00','tarea', NOW(), 0),
        (12,'Ejercicios T1','<div>Ejercicios T1 Ejercicios T1 Ejercicios T1 Ejercicios T1</div>','2025-12-24 17:50:00',1,23,'2025-12-23 17:50:00','tarea', NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertEntrega($conn)
    {
        $sql = "INSERT INTO entrega (id, fecha_entrega, comentario_alumno, tarea_id, alumno_id, enlace, created_at, deleted) VALUES
        (7,'2025-12-22 16:04:15','asgsdgbsdfb',10,57,'https://drive.google.com/drive/folders/1w7-lVfgAcYjL3phW6RIEjjWXnfluH09t?usp=sharing', NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertCalificacion($conn)
    {
        $sql = "INSERT INTO calificacion (id, nota, feedback_profesor, entrega_id, created_at, deleted) VALUES
        (7,8,'lo has hecho muy bien',7, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertMaterial($conn)
    {
        $sql = "INSERT INTO material (id, titulo, archivo, fecha_subida, imparticion_id, created_at, deleted) VALUES
        (1,'TemaVisual 1','20251228_entornos-desarrollo-tema-1.pdf','2025-12-28 10:43:11',24, NOW(), 0),
        (2,'TemaVisual 1','20251228_fol-tema-1.pdf','2025-12-28 10:50:10',28, NOW(), 0)";
        $conn->executeStatement($sql);
    }

    private function insertAsistencia($conn)
    {
        $sql = "INSERT INTO asistencia (id, fecha, estado, imparticion_id, alumno_id, hora, comentario, created_at, deleted) VALUES
        (11,'2025-12-22','F',40,72,'15:00:00','tyihulhjgñ', NOW(), 0),
        (12,'2025-12-22','P',40,73,'15:00:00','', NOW(), 0),
        (13,'2025-12-22','P',40,74,'15:00:00','', NOW(), 0),
        (14,'2025-12-22','P',40,75,'15:00:00','', NOW(), 0),
        (15,'2025-12-22','P',40,76,'15:00:00','', NOW(), 0),
        (16,'2025-12-22','F',24,57,'10:00:00','', NOW(), 0),
        (17,'2025-12-22','P',24,58,'10:00:00','', NOW(), 0),
        (18,'2025-12-22','P',24,59,'10:00:00','', NOW(), 0),
        (19,'2025-12-22','P',24,60,'10:00:00','', NOW(), 0),
        (20,'2025-12-22','P',24,61,'10:00:00','', NOW(), 0),
        (21,'2025-12-22','R',31,62,'12:00:00','un retraso para un retrasado', NOW(), 0),
        (22,'2025-12-22','P',31,63,'12:00:00','', NOW(), 0),
        (23,'2025-12-22','P',31,64,'12:00:00','', NOW(), 0),
        (24,'2025-12-22','P',31,65,'12:00:00','', NOW(), 0),
        (25,'2025-12-22','P',31,66,'12:00:00','', NOW(), 0),
        (26,'2025-12-18','P',28,57,'12:00:00','', NOW(), 0),
        (27,'2025-12-18','F',28,58,'12:00:00','', NOW(), 0),
        (28,'2025-12-18','P',28,59,'12:00:00','', NOW(), 0),
        (29,'2025-12-18','P',28,60,'12:00:00','', NOW(), 0),
        (30,'2025-12-18','F',28,61,'12:00:00','', NOW(), 0),
        (31,'2025-12-19','F',28,57,'13:00:00','', NOW(), 0),
        (32,'2025-12-19','P',28,58,'13:00:00','', NOW(), 0),
        (33,'2025-12-19','P',28,59,'13:00:00','', NOW(), 0),
        (34,'2025-12-19','F',28,60,'13:00:00','', NOW(), 0),
        (35,'2025-12-19','P',28,61,'13:00:00','', NOW(), 0),
        (36,'2025-12-16','P',37,67,'19:00:00','', NOW(), 0),
        (37,'2025-12-16','F',37,68,'19:00:00','', NOW(), 0),
        (38,'2025-12-16','P',37,69,'19:00:00','', NOW(), 0),
        (39,'2025-12-16','P',37,70,'19:00:00','', NOW(), 0),
        (40,'2025-12-16','F',37,71,'19:00:00','', NOW(), 0)";
        $conn->executeStatement($sql);
    }
}
