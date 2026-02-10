/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.15-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: app_db
-- ------------------------------------------------------
-- Server version	10.11.15-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `asistencia`
--

DROP TABLE IF EXISTS `asistencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asistencia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `estado` varchar(20) NOT NULL,
  `imparticion_id` int(11) NOT NULL,
  `alumno_id` int(11) NOT NULL,
  `hora` time NOT NULL,
  `comentario` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_D8264A8D5396730A` (`imparticion_id`),
  KEY `IDX_D8264A8DFC28E5EE` (`alumno_id`),
  CONSTRAINT `FK_D8264A8D5396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`),
  CONSTRAINT `FK_D8264A8DFC28E5EE` FOREIGN KEY (`alumno_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencia`
--

LOCK TABLES `asistencia` WRITE;
/*!40000 ALTER TABLE `asistencia` DISABLE KEYS */;
INSERT INTO `asistencia` VALUES
(45,'2026-01-15','F',28,57,'12:30:00','caca caca','2026-02-04 11:01:39','2026-02-04 11:01:39',0,NULL),
(46,'2026-01-16','P',28,61,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(47,'2026-01-16','P',28,58,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(48,'2026-01-16','P',28,59,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(49,'2026-01-16','P',28,60,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(50,'2026-01-16','J',28,57,'13:30:00','tonto, has justificado','2026-02-04 11:04:22','2026-02-04 11:06:25',0,NULL);
/*!40000 ALTER TABLE `asistencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calificacion`
--

DROP TABLE IF EXISTS `calificacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `calificacion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nota` double NOT NULL,
  `feedback_profesor` longtext DEFAULT NULL,
  `entrega_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_8A3AF2187AB91AEC` (`entrega_id`),
  CONSTRAINT `FK_8A3AF2187AB91AEC` FOREIGN KEY (`entrega_id`) REFERENCES `entrega` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calificacion`
--

LOCK TABLES `calificacion` WRITE;
/*!40000 ALTER TABLE `calificacion` DISABLE KEYS */;
INSERT INTO `calificacion` VALUES
(7,8,'lo has hecho muy bien',7,'2026-02-01 08:05:15',NULL,0,NULL),
(8,5,'vaya puta mierda',8,'2026-02-05 14:01:55','2026-02-05 14:01:55',0,NULL);
/*!40000 ALTER TABLE `calificacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `centro`
--

DROP TABLE IF EXISTS `centro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `centro` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `cif` varchar(20) NOT NULL,
  `activo` tinyint(4) NOT NULL,
  `web_config` varchar(255) DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) NOT NULL,
  `telefono` varchar(25) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `centro`
--

LOCK TABLES `centro` WRITE;
/*!40000 ALTER TABLE `centro` DISABLE KEYS */;
INSERT INTO `centro` VALUES
(3,'Escuela Arte Granada','B18000000',1,NULL,'logoEAG-69820676cd526.png','Av. Dr. Oloriz, 6, Beiro, 18012 Granada','958 27 80 60','2026-01-31 22:12:20','2026-02-03 14:30:14',0,NULL),
(4,'IES Tecnológico TFG','B5363643538',1,NULL,'161072a8938d361bab5d9d4234e6e2eaa6488d8f-697e2433c8e80.png','Calle Falsa, 123','958 11 11 11','2026-01-31 22:12:20',NULL,0,NULL);
/*!40000 ALTER TABLE `centro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ciclo_formativo`
--

DROP TABLE IF EXISTS `ciclo_formativo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ciclo_formativo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `nivel` varchar(50) NOT NULL,
  `centro_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_F907D8A9298137A7` (`centro_id`),
  CONSTRAINT `FK_F907D8A9298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ciclo_formativo`
--

LOCK TABLES `ciclo_formativo` WRITE;
/*!40000 ALTER TABLE `ciclo_formativo` DISABLE KEYS */;
INSERT INTO `ciclo_formativo` VALUES
(3,'Desarrollo de Aplicaciones Web','Superior',3,'2026-02-01 08:05:15',NULL,0,NULL),
(4,'Desarrollo de Aplicaciones Multiplataforma','Superior',3,'2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `ciclo_formativo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctrine_migration_versions`
--

DROP TABLE IF EXISTS `doctrine_migration_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctrine_migration_versions` (
  `version` varchar(191) NOT NULL,
  `executed_at` datetime DEFAULT NULL,
  `execution_time` int(11) DEFAULT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctrine_migration_versions`
--

LOCK TABLES `doctrine_migration_versions` WRITE;
/*!40000 ALTER TABLE `doctrine_migration_versions` DISABLE KEYS */;
INSERT INTO `doctrine_migration_versions` VALUES
('DoctrineMigrations\\Version20251219094458','2025-12-20 14:57:49',610),
('DoctrineMigrations\\Version20251219101418','2025-12-20 14:57:49',698),
('DoctrineMigrations\\Version20251219101946','2025-12-20 14:57:50',160),
('DoctrineMigrations\\Version20251219163337','2025-12-20 14:57:50',38),
('DoctrineMigrations\\Version20251219171147','2025-12-20 14:57:50',58),
('DoctrineMigrations\\Version20251220080016','2025-12-20 14:57:50',36),
('DoctrineMigrations\\Version20251220080742','2025-12-20 14:57:50',37),
('DoctrineMigrations\\Version20251220081540','2025-12-20 14:57:50',38),
('DoctrineMigrations\\Version20251220082014','2025-12-20 14:57:50',37),
('DoctrineMigrations\\Version20251220092842','2025-12-20 14:57:50',154),
('DoctrineMigrations\\Version20251220103247','2025-12-20 14:57:51',79),
('DoctrineMigrations\\Version20251220124440','2025-12-20 14:57:51',92),
('DoctrineMigrations\\Version20251221132254','2025-12-21 13:23:07',1031),
('DoctrineMigrations\\Version20251221173754','2025-12-21 17:38:05',232),
('DoctrineMigrations\\Version20251222112549','2025-12-22 11:25:54',88),
('DoctrineMigrations\\Version20251222123345','2025-12-22 12:33:52',40),
('DoctrineMigrations\\Version20251222124831','2025-12-22 12:48:37',43),
('DoctrineMigrations\\Version20251222125623','2025-12-22 12:56:34',35),
('DoctrineMigrations\\Version20251222184403','2025-12-22 18:44:08',231),
('DoctrineMigrations\\Version20251222190604','2025-12-22 19:06:09',40),
('DoctrineMigrations\\Version20251222191604','2025-12-22 19:16:09',88),
('DoctrineMigrations\\Version20251222192903','2025-12-22 19:29:09',40),
('DoctrineMigrations\\Version20251222195743','2025-12-22 19:57:50',40),
('DoctrineMigrations\\Version20251222201520','2025-12-22 20:15:25',39),
('DoctrineMigrations\\Version20251222223053','2025-12-22 22:31:00',39),
('DoctrineMigrations\\Version20251222230444','2025-12-22 23:04:49',38),
('DoctrineMigrations\\Version20251222230943','2025-12-22 23:09:46',42),
('DoctrineMigrations\\Version20251225153709','2025-12-25 15:37:16',69),
('DoctrineMigrations\\Version20260131161708','2026-01-31 16:17:08',102),
('DoctrineMigrations\\Version20260131163505','2026-01-31 16:35:06',22),
('DoctrineMigrations\\Version20260131165130','2026-01-31 16:51:31',16),
('DoctrineMigrations\\Version20260131171928','2026-01-31 17:19:30',20),
('DoctrineMigrations\\Version20260131215848','2026-01-31 21:58:49',36),
('DoctrineMigrations\\Version20260131221220','2026-01-31 22:12:20',178),
('DoctrineMigrations\\Version20260131233534','2026-01-31 23:35:34',27),
('DoctrineMigrations\\Version20260201003333','2026-02-01 00:33:33',24),
('DoctrineMigrations\\Version20260201012720','2026-02-01 01:27:20',301),
('DoctrineMigrations\\Version20260201102353','2026-02-01 10:23:54',24),
('DoctrineMigrations\\Version20260201105311','2026-02-01 10:53:12',23),
('DoctrineMigrations\\Version20260201114243','2026-02-01 11:42:44',21),
('DoctrineMigrations\\Version20260201114738','2026-02-01 11:47:39',33),
('DoctrineMigrations\\Version20260201120350','2026-02-01 12:03:51',49),
('DoctrineMigrations\\Version20260201195447','2026-02-02 13:51:42',1458),
('DoctrineMigrations\\Version20260202100000','2026-02-02 13:51:44',1044),
('DoctrineMigrations\\Version20260202110000','2026-02-02 13:51:45',68),
('DoctrineMigrations\\Version20260202114720','2026-02-02 13:51:45',1110),
('DoctrineMigrations\\Version20260202122225','2026-02-02 13:51:46',994),
('DoctrineMigrations\\Version20260202135142',NULL,NULL),
('DoctrineMigrations\\Version20260202151917',NULL,NULL),
('DoctrineMigrations\\Version20260203081414',NULL,NULL),
('DoctrineMigrations\\Version20260203081800',NULL,NULL),
('DoctrineMigrations\\Version20260203081929',NULL,NULL),
('DoctrineMigrations\\Version20260203085719',NULL,NULL),
('DoctrineMigrations\\Version20260203131603',NULL,NULL),
('DoctrineMigrations\\Version20260205050601','2026-02-05 05:10:54',86);
/*!40000 ALTER TABLE `doctrine_migration_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrega`
--

DROP TABLE IF EXISTS `entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrega` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha_entrega` datetime NOT NULL,
  `comentario_alumno` longtext DEFAULT NULL,
  `tarea_id` int(11) NOT NULL,
  `alumno_id` int(11) NOT NULL,
  `enlace` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `archivo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_E56D596B6D5BDFE1` (`tarea_id`),
  KEY `IDX_E56D596BFC28E5EE` (`alumno_id`),
  CONSTRAINT `FK_E56D596B6D5BDFE1` FOREIGN KEY (`tarea_id`) REFERENCES `tarea` (`id`),
  CONSTRAINT `FK_E56D596BFC28E5EE` FOREIGN KEY (`alumno_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega`
--

LOCK TABLES `entrega` WRITE;
/*!40000 ALTER TABLE `entrega` DISABLE KEYS */;
INSERT INTO `entrega` VALUES
(7,'2025-12-22 16:04:15','asgsdgbsdfb',10,57,'https://drive.google.com/drive/folders/1w7-lVfgAcYjL3phW6RIEjjWXnfluH09t?usp=sharing','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(8,'2026-02-05 13:31:55','fuck you',13,57,'https://www.youtube.com/watch?v=dQw4w9WgXcQ','2026-02-05 13:31:55','2026-02-05 13:31:55',0,NULL,NULL);
/*!40000 ALTER TABLE `entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `festivo`
--

DROP TABLE IF EXISTS `festivo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `festivo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `centro_id` int(11) DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_9472C78A298137A7` (`centro_id`),
  CONSTRAINT `FK_9472C78A298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `festivo`
--

LOCK TABLES `festivo` WRITE;
/*!40000 ALTER TABLE `festivo` DISABLE KEYS */;
INSERT INTO `festivo` VALUES
(4,'Navidad','2025-12-22',NULL,'2026-01-06','2026-02-01 08:05:15',NULL,0,NULL),
(5,'Semana Santa','2026-03-28',NULL,'2026-04-05','2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `festivo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupo`
--

DROP TABLE IF EXISTS `grupo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grupo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `anio_escolar` varchar(20) NOT NULL,
  `ciclo_id` int(11) NOT NULL,
  `centro_id` int(11) NOT NULL,
  `curso` int(11) NOT NULL,
  `abreviatura` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_8C0E9BD3D8F6DC8` (`ciclo_id`),
  KEY `IDX_8C0E9BD3298137A7` (`centro_id`),
  CONSTRAINT `FK_8C0E9BD3298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`),
  CONSTRAINT `FK_8C0E9BD3D8F6DC8` FOREIGN KEY (`ciclo_id`) REFERENCES `ciclo_formativo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupo`
--

LOCK TABLES `grupo` WRITE;
/*!40000 ALTER TABLE `grupo` DISABLE KEYS */;
INSERT INTO `grupo` VALUES
(5,'Desarrollo de Aplicaciones Web','2025/2026',3,3,1,'1º DAW',NULL,'2026-02-03 23:49:34',0,NULL),
(6,'Desarrollo de Aplicaciones Web','2024/2025',3,3,2,'2º DAW','2026-02-01 08:05:15',NULL,0,NULL),
(7,'Desarrollo de Aplicaciones Multiplataforma','2025/2026',4,3,1,'1º DAM','2026-02-01 08:05:15',NULL,0,NULL),
(8,'Desarrollo de Aplicaciones Multiplataforma','2024/2025',4,3,2,'2º DAM','2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `grupo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `horario`
--

DROP TABLE IF EXISTS `horario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `horario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dia_semana` int(11) NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `aula` varchar(255) NOT NULL,
  `imparticion_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_E25853A35396730A` (`imparticion_id`),
  CONSTRAINT `FK_E25853A35396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=216 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `horario`
--

LOCK TABLES `horario` WRITE;
/*!40000 ALTER TABLE `horario` DISABLE KEYS */;
INSERT INTO `horario` VALUES
(98,1,'08:30:00','09:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(99,1,'09:30:00','10:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(100,1,'10:30:00','11:30:00','Aula 101',24,'2026-02-01 08:05:15',NULL,0,NULL),
(101,1,'11:30:00','12:30:00','Aula 101',24,'2026-02-01 08:05:15',NULL,0,NULL),
(102,1,'12:30:00','13:30:00','Aula 101',25,'2026-02-01 08:05:15',NULL,0,NULL),
(103,1,'13:30:00','14:30:00','Aula 101',25,'2026-02-01 08:05:15',NULL,0,NULL),
(104,2,'08:30:00','09:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(105,2,'09:30:00','10:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(106,2,'10:30:00','11:30:00','Aula 101',25,'2026-02-01 08:05:15',NULL,0,NULL),
(107,2,'11:30:00','12:30:00','Aula 101',25,'2026-02-01 08:05:15',NULL,0,NULL),
(108,2,'12:30:00','13:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(109,2,'13:30:00','14:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(110,3,'08:30:00','09:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(111,3,'09:30:00','10:30:00','Aula 101',23,'2026-02-01 08:05:15',NULL,0,NULL),
(112,3,'10:30:00','11:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(113,3,'11:30:00','12:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(114,3,'12:30:00','13:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(115,3,'13:30:00','14:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(116,4,'08:30:00','09:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(117,4,'09:30:00','10:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(118,4,'10:30:00','11:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(119,4,'11:30:00','12:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(120,4,'12:30:00','13:30:00','Aula 101',28,'2026-02-01 08:05:15',NULL,0,NULL),
(121,4,'13:30:00','14:30:00','Aula 101',28,'2026-02-01 08:05:15',NULL,0,NULL),
(122,5,'08:30:00','09:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(123,5,'09:30:00','10:30:00','Aula 101',26,'2026-02-01 08:05:15',NULL,0,NULL),
(124,5,'10:30:00','11:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(125,5,'11:30:00','12:30:00','Aula 101',27,'2026-02-01 08:05:15',NULL,0,NULL),
(126,5,'12:30:00','13:30:00','Aula 101',24,'2026-02-01 08:05:15',NULL,0,NULL),
(127,5,'13:30:00','14:30:00','Aula 101',28,'2026-02-01 08:05:15',NULL,0,NULL),
(128,1,'08:30:00','09:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(129,1,'09:30:00','10:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(130,1,'10:30:00','11:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(131,1,'11:30:00','12:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(132,1,'12:30:00','13:30:00','Aula 102',31,'2026-02-01 08:05:15',NULL,0,NULL),
(133,1,'13:30:00','14:30:00','Aula 102',31,'2026-02-01 08:05:15',NULL,0,NULL),
(134,2,'08:30:00','09:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(135,2,'09:30:00','10:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(136,2,'10:30:00','11:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(137,2,'11:30:00','12:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(138,2,'12:30:00','13:30:00','Aula 102',31,'2026-02-01 08:05:15',NULL,0,NULL),
(139,2,'13:30:00','14:30:00','Aula 102',31,'2026-02-01 08:05:15',NULL,0,NULL),
(140,3,'08:30:00','09:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(141,3,'09:30:00','10:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(142,3,'10:30:00','11:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(143,3,'11:30:00','12:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(144,3,'12:30:00','13:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(145,3,'13:30:00','14:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(146,4,'08:30:00','09:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(147,4,'09:30:00','10:30:00','Aula 102',30,'2026-02-01 08:05:15',NULL,0,NULL),
(148,4,'10:30:00','11:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(149,4,'11:30:00','12:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(150,4,'12:30:00','13:30:00','Aula 102',33,'2026-02-01 08:05:15',NULL,0,NULL),
(151,4,'13:30:00','14:30:00','Aula 102',33,'2026-02-01 08:05:15',NULL,0,NULL),
(152,5,'08:30:00','09:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(153,5,'09:30:00','10:30:00','Aula 102',32,'2026-02-01 08:05:15',NULL,0,NULL),
(154,5,'10:30:00','11:30:00','Aula 102',33,'2026-02-01 08:05:15',NULL,0,NULL),
(155,5,'11:30:00','12:30:00','Aula 102',33,'2026-02-01 08:05:15',NULL,0,NULL),
(156,5,'12:30:00','13:30:00','Aula 102',29,'2026-02-01 08:05:15',NULL,0,NULL),
(157,1,'15:00:00','16:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(158,1,'16:00:00','17:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(159,1,'17:00:00','18:00:00','Aula 103',35,'2026-02-01 08:05:15',NULL,0,NULL),
(160,1,'18:00:00','19:00:00','Aula 103',35,'2026-02-01 08:05:15',NULL,0,NULL),
(161,1,'19:00:00','20:00:00','Aula 103',36,'2026-02-01 08:05:15',NULL,0,NULL),
(162,1,'20:00:00','21:00:00','Aula 103',36,'2026-02-01 08:05:15',NULL,0,NULL),
(163,2,'15:00:00','16:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(164,2,'16:00:00','17:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(165,2,'17:00:00','18:00:00','Aula 103',36,'2026-02-01 08:05:15',NULL,0,NULL),
(166,2,'18:00:00','19:00:00','Aula 103',36,'2026-02-01 08:05:15',NULL,0,NULL),
(167,2,'19:00:00','20:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(168,2,'20:00:00','21:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(169,3,'15:00:00','16:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(170,3,'16:00:00','17:00:00','Aula 103',34,'2026-02-01 08:05:15',NULL,0,NULL),
(171,3,'17:00:00','18:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(172,3,'18:00:00','19:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(173,3,'19:00:00','20:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(174,3,'20:00:00','21:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(175,4,'15:00:00','16:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(176,4,'16:00:00','17:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(177,4,'17:00:00','18:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(178,4,'18:00:00','19:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(179,4,'19:00:00','20:00:00','Aula 103',39,'2026-02-01 08:05:15',NULL,0,NULL),
(180,4,'20:00:00','21:00:00','Aula 103',39,'2026-02-01 08:05:15',NULL,0,NULL),
(181,5,'15:00:00','16:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(182,5,'16:00:00','17:00:00','Aula 103',37,'2026-02-01 08:05:15',NULL,0,NULL),
(183,5,'17:00:00','18:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(184,5,'18:00:00','19:00:00','Aula 103',38,'2026-02-01 08:05:15',NULL,0,NULL),
(185,5,'19:00:00','20:00:00','Aula 103',35,'2026-02-01 08:05:15',NULL,0,NULL),
(186,5,'20:00:00','21:00:00','Aula 103',39,'2026-02-01 08:05:15',NULL,0,NULL),
(187,1,'15:00:00','16:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(188,1,'16:00:00','17:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(189,1,'17:00:00','18:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(190,1,'18:00:00','19:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(191,1,'19:00:00','20:00:00','Aula 104',42,'2026-02-01 08:05:15',NULL,0,NULL),
(192,1,'20:00:00','21:00:00','Aula 104',42,'2026-02-01 08:05:15',NULL,0,NULL),
(193,2,'15:00:00','16:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(194,2,'16:00:00','17:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(195,2,'17:00:00','18:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(196,2,'18:00:00','19:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(197,2,'19:00:00','20:00:00','Aula 104',42,'2026-02-01 08:05:15',NULL,0,NULL),
(198,2,'20:00:00','21:00:00','Aula 104',42,'2026-02-01 08:05:15',NULL,0,NULL),
(199,3,'15:00:00','16:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(200,3,'16:00:00','17:00:00','Aula 104',40,'2026-02-01 08:05:15',NULL,0,NULL),
(201,3,'17:00:00','18:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(202,3,'18:00:00','19:00:00','Aula 104',41,'2026-02-01 08:05:15',NULL,0,NULL),
(203,3,'19:00:00','20:00:00','Aula 104',43,'2026-02-01 08:05:15',NULL,0,NULL),
(204,3,'20:00:00','21:00:00','Aula 104',43,'2026-02-01 08:05:15',NULL,0,NULL),
(205,4,'15:00:00','16:00:00','Aula 104',43,'2026-02-01 08:05:15',NULL,0,NULL),
(206,4,'16:00:00','17:00:00','Aula 104',43,'2026-02-01 08:05:15',NULL,0,NULL),
(207,4,'17:00:00','18:00:00','Aula 104',44,'2026-02-01 08:05:15',NULL,0,NULL),
(208,4,'18:00:00','19:00:00','Aula 104',44,'2026-02-01 08:05:15',NULL,0,NULL),
(209,4,'19:00:00','20:00:00','Aula 104',45,'2026-02-01 08:05:15',NULL,0,NULL),
(210,4,'20:00:00','21:00:00','Aula 104',45,'2026-02-01 08:05:15',NULL,0,NULL),
(211,5,'15:00:00','16:00:00','Aula 104',44,'2026-02-01 08:05:15',NULL,0,NULL),
(212,5,'16:00:00','17:00:00','Aula 104',44,'2026-02-01 08:05:15',NULL,0,NULL),
(213,5,'17:00:00','18:00:00','Aula 104',42,'2026-02-01 08:05:15',NULL,0,NULL),
(214,5,'18:00:00','19:00:00','Aula 104',43,'2026-02-01 08:05:15',NULL,0,NULL),
(215,5,'19:00:00','20:00:00','Aula 104',45,'2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `horario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `imparticion`
--

DROP TABLE IF EXISTS `imparticion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `imparticion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `profesor_id` int(11) NOT NULL,
  `modulo_id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_D179FDFDE52BD977` (`profesor_id`),
  KEY `IDX_D179FDFDC07F55F5` (`modulo_id`),
  KEY `IDX_D179FDFD9C833003` (`grupo_id`),
  CONSTRAINT `FK_D179FDFD9C833003` FOREIGN KEY (`grupo_id`) REFERENCES `grupo` (`id`),
  CONSTRAINT `FK_D179FDFDC07F55F5` FOREIGN KEY (`modulo_id`) REFERENCES `modulo` (`id`),
  CONSTRAINT `FK_D179FDFDE52BD977` FOREIGN KEY (`profesor_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imparticion`
--

LOCK TABLES `imparticion` WRITE;
/*!40000 ALTER TABLE `imparticion` DISABLE KEYS */;
INSERT INTO `imparticion` VALUES
(23,50,43,6,NULL,'2026-02-01 22:21:52',0,NULL),
(24,51,36,5,'2026-02-01 08:05:15',NULL,0,NULL),
(25,52,37,5,'2026-02-01 08:05:15',NULL,0,NULL),
(26,53,38,5,'2026-02-01 08:05:15',NULL,0,NULL),
(27,54,39,5,'2026-02-01 08:05:15',NULL,0,NULL),
(28,55,40,5,'2026-02-01 08:05:15',NULL,0,NULL),
(29,56,41,6,'2026-02-01 08:05:15',NULL,0,NULL),
(30,50,42,6,'2026-02-01 08:05:15',NULL,0,NULL),
(31,51,43,6,'2026-02-01 08:05:15',NULL,0,NULL),
(32,52,44,6,'2026-02-01 08:05:15',NULL,0,NULL),
(33,53,45,6,'2026-02-01 08:05:15',NULL,0,NULL),
(34,52,23,7,'2026-02-01 08:05:15',NULL,0,NULL),
(35,53,24,7,'2026-02-01 08:05:15',NULL,0,NULL),
(36,54,25,7,'2026-02-01 08:05:15',NULL,0,NULL),
(37,55,26,7,'2026-02-01 08:05:15',NULL,0,NULL),
(38,56,27,7,'2026-02-01 08:05:15',NULL,0,NULL),
(39,50,28,7,'2026-02-01 08:05:15',NULL,0,NULL),
(40,51,29,8,'2026-02-01 08:05:15',NULL,0,NULL),
(41,52,30,8,'2026-02-01 08:05:15',NULL,0,NULL),
(42,53,31,8,'2026-02-01 08:05:15',NULL,0,NULL),
(43,54,32,8,'2026-02-01 08:05:15',NULL,0,NULL),
(44,56,33,8,'2026-02-01 08:05:15',NULL,0,NULL),
(45,56,34,8,'2026-02-01 08:05:15',NULL,0,NULL),
(46,50,35,5,'2026-02-04 10:05:06',NULL,0,NULL);
/*!40000 ALTER TABLE `imparticion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material`
--

DROP TABLE IF EXISTS `material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `material` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(255) NOT NULL,
  `archivo` varchar(255) NOT NULL,
  `fecha_subida` datetime NOT NULL,
  `imparticion_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_7CBE75955396730A` (`imparticion_id`),
  CONSTRAINT `FK_7CBE75955396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material`
--

LOCK TABLES `material` WRITE;
/*!40000 ALTER TABLE `material` DISABLE KEYS */;
INSERT INTO `material` VALUES
(1,'Tema 1','20251228_entornos-desarrollo-tema-1.pdf','2025-12-28 10:43:11',24,'2026-02-01 08:05:15',NULL,0,NULL),
(2,'Tema 1','20251228_fol-tema-1.pdf','2025-12-28 10:50:10',28,'2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `matricula`
--

DROP TABLE IF EXISTS `matricula`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matricula` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `alumno_id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_15DF1885FC28E5EE` (`alumno_id`),
  KEY `IDX_15DF18859C833003` (`grupo_id`),
  CONSTRAINT `FK_15DF18859C833003` FOREIGN KEY (`grupo_id`) REFERENCES `grupo` (`id`),
  CONSTRAINT `FK_15DF1885FC28E5EE` FOREIGN KEY (`alumno_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `matricula`
--

LOCK TABLES `matricula` WRITE;
/*!40000 ALTER TABLE `matricula` DISABLE KEYS */;
INSERT INTO `matricula` VALUES
(41,57,5,NULL,'2026-02-01 22:34:58',0,NULL),
(42,58,5,'2026-02-01 08:05:15',NULL,0,NULL),
(43,59,5,'2026-02-01 08:05:15',NULL,0,NULL),
(44,60,5,'2026-02-01 08:05:15',NULL,0,NULL),
(45,61,5,'2026-02-01 08:05:15',NULL,0,NULL),
(46,62,6,'2026-02-01 08:05:15',NULL,0,NULL),
(47,63,6,'2026-02-01 08:05:15',NULL,0,NULL),
(48,64,6,'2026-02-01 08:05:15',NULL,0,NULL),
(49,65,6,'2026-02-01 08:05:15',NULL,0,NULL),
(50,66,6,'2026-02-01 08:05:15',NULL,0,NULL),
(51,67,7,'2026-02-01 08:05:15',NULL,0,NULL),
(52,68,7,'2026-02-01 08:05:15',NULL,0,NULL),
(53,69,7,'2026-02-01 08:05:15',NULL,0,NULL),
(54,70,7,'2026-02-01 08:05:15',NULL,0,NULL),
(55,71,7,'2026-02-01 08:05:15',NULL,0,NULL),
(56,72,8,'2026-02-01 08:05:15',NULL,0,NULL),
(57,73,8,'2026-02-01 08:05:15',NULL,0,NULL),
(58,74,8,'2026-02-01 08:05:15',NULL,0,NULL),
(59,75,8,'2026-02-01 08:05:15',NULL,0,NULL),
(60,76,8,'2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `matricula` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mensaje`
--

DROP TABLE IF EXISTS `mensaje`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `mensaje` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contenido` longtext NOT NULL,
  `fecha_envio` datetime NOT NULL,
  `leido` tinyint(4) NOT NULL,
  `remitente_id` int(11) NOT NULL,
  `destinatario_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_9B631D011C3E945F` (`remitente_id`),
  KEY `IDX_9B631D01B564FBC1` (`destinatario_id`),
  CONSTRAINT `FK_9B631D011C3E945F` FOREIGN KEY (`remitente_id`) REFERENCES `usuario` (`id`),
  CONSTRAINT `FK_9B631D01B564FBC1` FOREIGN KEY (`destinatario_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mensaje`
--

LOCK TABLES `mensaje` WRITE;
/*!40000 ALTER TABLE `mensaje` DISABLE KEYS */;
INSERT INTO `mensaje` VALUES
(21,'oPtauxYsNbvsDGHzxlnjczJ6NHJ6MWlTcTFzaDRHWEtRTkMzYVE2M3VmODRQQUdEb0lHamxjS1BzZWc9','2026-02-05 11:11:34',1,50,55),
(22,'RgjMkMVx6GIZtnOaBLCOcFFHcTVHSEZORWRXK2RPR2FZZWlxS0E9PQ==','2026-02-05 11:12:00',1,55,50),
(23,'7BRXb+Ys3tfclyGUGD2ObzRteE9DSVM5eHdyaXNNNitoVEc4Q2o4Y3FyNTR3K2xpV0hPWk45RW51TjA9','2026-02-05 11:18:59',1,50,55),
(24,'bcpHoxkbXxJU9zBwUMV+8WpwdXRDT05TakVmemFOZ0t0bVVTSFE9PQ==','2026-02-05 11:24:41',1,55,50),
(25,'1Vb4yUU5I91oxDeh1uw1oDJKTzFOSGhHYmM4aUNRM2N1Z3haaEE9PQ==','2026-02-05 11:26:13',1,55,50),
(26,'1MEYkbmq6V+AAOiiHZ3vT1ExalpXQzJaYlFCR1lIV0dYa1VqVXp3a0tmVVgyMlF6dS9HVDJtd1o1Tlk9','2026-02-05 11:28:46',1,55,50),
(27,'EfeFJ+YRo9kfP0MwxFNyt3E2Ymo3RzMvU2VheUxXTng5a2ZCNmtQcXVyb1lWMGh0dzlHbFdMallvTDZPdFVGdGFDTURjQ3dmWEdwQXVhOWY=','2026-02-05 11:33:05',1,55,50),
(28,'ja9njbrTqou2i4eJbFDMoEZZZUdlVlpsb2J5a2xWeU1qWEJzdnc9PQ==','2026-02-05 11:33:58',1,56,50),
(29,'O5MKCI3RNA1tpvZoyUEX30tFVFcxVGxEZGJNYXRRa2VxYVUzTEE9PQ==','2026-02-05 11:34:37',1,56,50),
(30,'S+8YSDvKRzNNh6A+bYeS4XU3RVBzWXpwU1hzaUZKOXFDNDkrS1NYUTFLRFBKVno0N0Yva0ZuUERDN1dRTEhkU1FHSzZWWStCeFBMVUFRcjhLdHljT3NWN2htVGlvRk1MNTR6RlBBPT0=','2026-02-05 11:38:03',1,50,55),
(31,'DGY1PMD0HEw0lLhFalgyXVZKVU9IMlZFZ1ZEV1FlU3g0UjIzdG9WMWY2Vll1b0NRNFRTZVQvS1YwVnM9','2026-02-05 11:38:45',1,55,50),
(32,'iA26My4KZWJwgthhdSr2ZkYzZXlxYmlkVVo3bTdDMjJMbGEvKzZvUFlCVHhGZVBUay9pNUlCT2tnclJhZklaVjVFK3duaHN5cmpGb3JlUEc=','2026-02-05 12:14:03',1,50,55),
(33,'saiLmkMFLSUj3RkLQAbFfEVGRFM1RTdLRW5VajYxckQ5ZG9UeXc9PQ==','2026-02-05 12:15:03',1,50,55),
(34,'kPbjkeK1Ftbn6amtabzQQzljc09PTkw1d09EVytRYWMrOXk1NlE9PQ==','2026-02-05 12:16:05',1,56,50),
(35,'ni3r/NRTGKCaZUOyb065ymFKRWt6SzF6SG02K2ttQUlQOU1HTmc9PQ==','2026-02-05 12:16:30',1,56,55),
(36,'1UkSwN9V1QxyTJeVCNeN8nRZd29JclhiTXRlZERQZXhxRmtkazFqKzBTcWNsSGl2aDhmMS9FamJodnM2bnlZR04rcjVJU0NTSWRkVW9GLys=','2026-02-05 12:20:32',1,56,55),
(37,'0Qg/CzuIqG0fmNNhPvH9xUJFVVRPcFVNTlp5WlZnSWVnbGxHRTAxY0ZVL2ZBbUFPSTdmM3JBNE5ocHFLUXJGWkdiT0xlMEszTTlhUlBQU3g=','2026-02-05 12:21:08',1,55,56),
(38,'6QQZG82c+8INpJ8mh4rQYCsreFJEUFh2aWJPOUsyTzVUQzZMMFE9PQ==','2026-02-10 06:05:48',1,57,55),
(39,'8IcLNhsHlu4b3LXW8NcuuCt2aG1xNXk1WXRNKzhoQjcxWlEzdWc9PQ==','2026-02-10 06:10:22',1,55,49),
(40,'es5pIrlb5RUDkZLoZDOUY204eERJcE9CL3RXZ2s3N043bnlsZmc9PQ==','2026-02-10 06:12:13',1,49,55),
(41,'aZoXTRK/bF2yNhCkhKeVvVJVOGNYUUNKb1R0Y1hKQTZWR2Vrd0x5ZDZBWmFtME9ncGlMSXpMa2hFaVZOeEFNM0xpdmJUcHVCREJWNVpmVGQ=','2026-02-10 06:50:15',1,50,57),
(42,'ASh/ZJqxjJ+9AWO9E23fg211aW5rM2FUS1ZSdWNFRWFuT1hscXVFY0JTSVlyRElhNk8wUWFiWUtWVlNDVmNJY3R3bjNqb0lObmEwdUxBQ2k=','2026-02-10 06:51:09',1,57,50),
(43,'dw8nZR0ukEcgdD3DMS3s3nAvWUY1SXZycmZGVEZDcTdzRVZheWc9PQ==','2026-02-10 09:35:51',1,50,55),
(44,'6OzZ96PH9oT212fI2p4toVkrV0RPQ2E0ZHJ2NDkxVkova1ZEZnlxWlFkUWg1bkxnOE1Oc0R2djBYWnFWbWFxS0JPblJ2TThZTnh5SkRZRFc=','2026-02-10 09:37:42',1,50,55),
(45,'amqeZr02LIpPQaDKLvC4ynQrNGVaelpxWElIMFFISkE3VE82T0pJQVljb3prVzBCNGJZczZTRjJBL0k9','2026-02-10 09:37:52',1,55,50),
(46,'omT07o9Rn8uQhHW3uvLNVnlWWGp1dDhERDJSMHB1KzNZUHNuS0E9PQ==','2026-02-10 09:41:01',1,50,55),
(47,'WncUHxgKWrVXsIWddNe6eThiWHk4NUJMQ0V0eDRhMDA2Z0E2ZVE9PQ==','2026-02-10 09:41:31',0,55,50),
(48,'e8wUhujdS6449CiBdh6dyndLU1NLVGlVQXN1NVZEZm9pSk9Nb0E9PQ==','2026-02-10 09:43:11',0,55,68),
(49,'6wo8WwbNC8q6XUohzmkEATBoSG1pdFBIY0t5djNaNE5Ub1RkVXc9PQ==','2026-02-10 10:58:40',1,49,55),
(50,'JWbEb8wa6D8g7jw4T8k94kk5QzA3bUI5QVYwMGJza1h1RFl5a0YwVVRGeXA4b0hGSVpKT2JSZ3F2K0k9','2026-02-10 10:59:21',1,55,49),
(51,'1SZOffgL1X1mvZyL4KIfoURubVRjUmRaMG1UYldINnZZWFZUNUlkZldLdzJWVzdZK1VlaVhRaXIwRG89','2026-02-10 11:02:16',1,49,55),
(52,'ub/N/91w+akJg0nq0up4blAyMXhVNzdyalRQaUFwVFB1OUFDL3NtUnJKVFVMSDJDdzdXNXNmUHhmeDA9','2026-02-10 11:12:59',1,55,49),
(53,'x+JgbB/zEeFRtIhPS44yxWJXeVR1Njh6bG9RSUx3MklvNW94L2c9PQ==','2026-02-10 11:13:28',1,49,55);
/*!40000 ALTER TABLE `mensaje` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messenger_messages`
--

DROP TABLE IF EXISTS `messenger_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messenger_messages` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `body` longtext NOT NULL,
  `headers` longtext NOT NULL,
  `queue_name` varchar(190) NOT NULL,
  `created_at` datetime NOT NULL,
  `available_at` datetime NOT NULL,
  `delivered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750` (`queue_name`,`available_at`,`delivered_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messenger_messages`
--

LOCK TABLES `messenger_messages` WRITE;
/*!40000 ALTER TABLE `messenger_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messenger_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modulo`
--

DROP TABLE IF EXISTS `modulo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `modulo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `codigo_oficial` varchar(50) DEFAULT NULL,
  `ciclo_id` int(11) NOT NULL,
  `curso` int(11) NOT NULL,
  `horas_semanales` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_ECF1CF36D8F6DC8` (`ciclo_id`),
  CONSTRAINT `FK_ECF1CF36D8F6DC8` FOREIGN KEY (`ciclo_id`) REFERENCES `ciclo_formativo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modulo`
--

LOCK TABLES `modulo` WRITE;
/*!40000 ALTER TABLE `modulo` DISABLE KEYS */;
INSERT INTO `modulo` VALUES
(23,'Bases de datos','0001',4,1,6,NULL,'2026-02-01 22:24:41',0,NULL),
(24,'Entornos de desarrollo','0002',4,1,3,'2026-02-01 08:05:15',NULL,0,NULL),
(25,'Lenguajes de marcas','0003',4,1,4,'2026-02-01 08:05:15',NULL,0,NULL),
(26,'Programación','0004',4,1,8,'2026-02-01 08:05:15',NULL,0,NULL),
(27,'Sistemas informáticos','0005',4,1,6,'2026-02-01 08:05:15',NULL,0,NULL),
(28,'FOL','0006',4,1,3,'2026-02-01 08:05:15',NULL,0,NULL),
(29,'Acceso a datos','0007',4,2,6,'2026-02-01 08:05:15',NULL,0,NULL),
(30,'Desarrollo de interfaces','0008',4,2,6,'2026-02-01 08:05:15',NULL,0,NULL),
(31,'Programación multimedia','0009',4,2,5,'2026-02-01 08:05:15',NULL,0,NULL),
(32,'Servicios y procesos','0010',4,2,5,'2026-02-01 08:05:15',NULL,0,NULL),
(33,'Sistemas de gestión','0011',4,2,5,'2026-02-01 08:05:15',NULL,0,NULL),
(34,'EIE','0012',4,2,3,'2026-02-01 08:05:15',NULL,0,NULL),
(35,'Bases de datos','0001',3,1,6,NULL,'2026-02-04 08:41:05',0,NULL),
(36,'Entornos de desarrollo','0002',3,1,3,'2026-02-01 08:05:15',NULL,0,NULL),
(37,'Lenguajes de marcas','0003',3,1,4,'2026-02-01 08:05:15',NULL,0,NULL),
(38,'Programación','0004',3,1,8,'2026-02-01 08:05:15',NULL,0,NULL),
(39,'Sistemas informáticos','0005',3,1,6,'2026-02-01 08:05:15',NULL,0,NULL),
(40,'FOL','0006',3,1,3,'2026-02-01 08:05:15',NULL,0,NULL),
(41,'Desarrollo Cliente','0013',3,2,7,'2026-02-01 08:05:15',NULL,0,NULL),
(42,'Desarrollo Servidor','0014',3,2,8,'2026-02-01 08:05:15',NULL,0,NULL),
(43,'Despliegue Apps','0015',3,2,4,'2026-02-01 08:05:15',NULL,0,NULL),
(44,'Diseño de Interfaces','0016',3,2,6,'2026-02-01 08:05:15',NULL,0,NULL),
(45,'EIE','0017',3,2,5,'2026-02-01 08:05:15',NULL,0,NULL);
/*!40000 ALTER TABLE `modulo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personalizacion`
--

DROP TABLE IF EXISTS `personalizacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `personalizacion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `primary_color` varchar(7) NOT NULL,
  `sidebar_color` varchar(7) NOT NULL,
  `centro_id` int(11) DEFAULT NULL,
  `text_main_color` varchar(7) NOT NULL,
  `text_secondary_color` varchar(7) NOT NULL,
  `button_primary_color` varchar(7) NOT NULL,
  `button_secondary_color` varchar(7) NOT NULL,
  `header_footer_color` varchar(7) NOT NULL,
  `header_footer_text_color` varchar(7) NOT NULL,
  `sidebar_active_color` varchar(7) NOT NULL,
  `sidebar_active_text_color` varchar(7) NOT NULL,
  `sidebar_hover_color` varchar(7) NOT NULL,
  `sidebar_hover_text_color` varchar(7) NOT NULL,
  `button_primary_text_color` varchar(7) NOT NULL,
  `button_secondary_text_color` varchar(7) NOT NULL,
  `secondary_color` varchar(7) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `scrollbar_thumb_color` varchar(7) NOT NULL,
  `scrollbar_track_color` varchar(7) NOT NULL,
  `scrollbar_hover_color` varchar(7) NOT NULL,
  `calendar_selected_bg_color` varchar(7) NOT NULL,
  `calendar_selected_text_color` varchar(7) NOT NULL,
  `calendar_weekend_bg_color` varchar(7) NOT NULL,
  `calendar_weekend_text_color` varchar(7) NOT NULL,
  `timetable_header_bg_color` varchar(7) NOT NULL,
  `timetable_header_text_color` varchar(7) NOT NULL,
  `timetable_hours_bg_color` varchar(7) NOT NULL,
  `timetable_hours_text_color` varchar(7) NOT NULL,
  `datatable_header_bg_color` varchar(7) NOT NULL,
  `datatable_header_text_color` varchar(7) NOT NULL,
  `datatable_pagination_bg_color` varchar(7) NOT NULL,
  `datatable_pagination_text_color` varchar(7) NOT NULL,
  `datatable_header_hover_bg_color` varchar(7) NOT NULL,
  `datatable_header_hover_text_color` varchar(7) NOT NULL,
  `datatable_header_active_bg_color` varchar(7) NOT NULL,
  `datatable_header_active_text_color` varchar(7) NOT NULL,
  `datatable_pagination_button_bg_color` varchar(7) NOT NULL,
  `datatable_pagination_button_text_color` varchar(7) NOT NULL,
  `datatable_pagination_button_hover_bg_color` varchar(7) NOT NULL,
  `datatable_pagination_button_hover_text_color` varchar(7) NOT NULL,
  `datatable_pagination_button_active_bg_color` varchar(7) NOT NULL,
  `datatable_pagination_button_active_text_color` varchar(7) NOT NULL,
  `items_per_page_usuarios` int(11) NOT NULL,
  `items_per_page_centros` int(11) NOT NULL,
  `items_per_page_ciclos` int(11) NOT NULL,
  `items_per_page_grupos` int(11) NOT NULL,
  `items_per_page_modulos` int(11) NOT NULL,
  `items_per_page_matriculas` int(11) NOT NULL,
  `items_per_page_imparticiones` int(11) NOT NULL,
  `items_per_page_horarios` int(11) NOT NULL,
  `timetable_selected_header_bg` varchar(7) NOT NULL,
  `timetable_selected_header_text` varchar(7) NOT NULL,
  `timetable_selected_cell_bg` varchar(7) NOT NULL,
  `scrollbar_width` varchar(10) NOT NULL,
  `accordion_header_bg_color` varchar(7) NOT NULL,
  `accordion_header_text_color` varchar(7) NOT NULL,
  `accordion_content_bg_color` varchar(7) NOT NULL,
  `accordion_content_text_color` varchar(7) NOT NULL,
  `temas_guardados` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`temas_guardados`)),
  `special_text_color` varchar(7) NOT NULL,
  `modal_header_bg_color` varchar(7) NOT NULL,
  `modal_header_text_color` varchar(7) NOT NULL,
  `modal_body_bg_color` varchar(7) NOT NULL,
  `modal_body_text_color` varchar(7) NOT NULL,
  `modal_footer_bg_color` varchar(7) NOT NULL,
  `modal_close_button_bg_color` varchar(7) NOT NULL,
  `modal_close_button_text_color` varchar(7) NOT NULL,
  `modal_close_button_hover_bg_color` varchar(7) NOT NULL,
  `modal_close_button_hover_text_color` varchar(7) NOT NULL,
  `name_title_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`name_title_config`)),
  `user_card_bg_color` varchar(7) NOT NULL,
  `user_card_text_color` varchar(7) NOT NULL,
  `user_card_text_secondary_color` varchar(7) NOT NULL,
  `chat_sidebar_bg_color` varchar(7) NOT NULL,
  `chat_item_hover_bg_color` varchar(7) NOT NULL,
  `chat_item_active_bg_color` varchar(7) NOT NULL,
  `chat_item_active_border_color` varchar(7) NOT NULL,
  `chat_item_text_main_color` varchar(7) NOT NULL,
  `chat_item_text_secondary_color` varchar(7) NOT NULL,
  `chat_badge_bg_color` varchar(7) NOT NULL,
  `chat_badge_text_color` varchar(7) NOT NULL,
  `chat_header_bg_color` varchar(7) NOT NULL,
  `chat_header_text_color` varchar(7) NOT NULL,
  `chat_container_bg_color` varchar(7) NOT NULL,
  `chat_bubble_sent_bg_color` varchar(7) NOT NULL,
  `chat_bubble_sent_text_color` varchar(7) NOT NULL,
  `chat_bubble_received_bg_color` varchar(7) NOT NULL,
  `chat_bubble_received_text_color` varchar(7) NOT NULL,
  `chat_input_area_bg_color` varchar(7) NOT NULL,
  `accordion_header_active_bg_color` varchar(7) NOT NULL,
  `accordion_header_active_text_color` varchar(7) NOT NULL,
  `event_card_bg_color` varchar(7) NOT NULL,
  `event_card_border_color` varchar(7) NOT NULL,
  `event_card_title_color` varchar(7) NOT NULL,
  `event_card_meta_color` varchar(7) NOT NULL,
  `events_sidebar_bg_color` varchar(7) NOT NULL,
  `events_sidebar_title_color` varchar(7) NOT NULL,
  `sidebar_accordion_header_bg_color` varchar(7) NOT NULL,
  `sidebar_accordion_header_text_color` varchar(7) NOT NULL,
  `sidebar_accordion_content_bg_color` varchar(7) NOT NULL,
  `sidebar_accordion_content_text_color` varchar(7) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_A6EC3EF3298137A7` (`centro_id`),
  CONSTRAINT `FK_A6EC3EF3298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personalizacion`
--

LOCK TABLES `personalizacion` WRITE;
/*!40000 ALTER TABLE `personalizacion` DISABLE KEYS */;
INSERT INTO `personalizacion` VALUES
(1,'#5c94f0','#1e293b',3,'#334155','#64748b','#62b767','#5c94f0','#1e293b','#ffffff','#334155','#ffffff','#334155','#ffffff','#ffffff','#ffffff','#608fd2','2026-02-01 10:25:33','2026-02-10 05:14:19',0,NULL,'#5c94f0','#f0f0f0','#8ab7ff','#62b767','#ffffff','#ff0000','#ffffff','#5c94f0','#ffffff','#e6e6e6','#000000','#62b767','#ffffff','#5c94f0','#ffffff','#7dcf82','#ffffff','#81df88','#ffffff','#94bdff','#ffffff','#3884ff','#ffffff','#96aaca','#ffffff',10,10,10,10,10,10,10,10,'#5c94f0','#ffffff','#eef2ff','auto','#5c94f0','#ffffff','#f0f0f0','#46505d','[{\"name\":\"EAG\",\"settings\":{\"primaryColor\":\"#5c94f0\",\"secondaryColor\":\"#608fd2\",\"sidebarColor\":\"#1e293b\",\"sidebarActiveColor\":\"#334155\",\"sidebarActiveTextColor\":\"#ffffff\",\"sidebarHoverColor\":\"#334155\",\"sidebarHoverTextColor\":\"#ffffff\",\"sidebarAccordionHeaderBgColor\":\"#2b3950\",\"sidebarAccordionHeaderTextColor\":\"#ffffff\",\"sidebarAccordionContentBgColor\":\"#1e293b\",\"sidebarAccordionContentTextColor\":\"#ffffff\",\"textMainColor\":\"#334155\",\"textSecondaryColor\":\"#64748b\",\"specialTextColor\":\"#ffffff\",\"buttonPrimaryColor\":\"#62b767\",\"buttonPrimaryTextColor\":\"#ffffff\",\"buttonSecondaryColor\":\"#5c94f0\",\"buttonSecondaryTextColor\":\"#ffffff\",\"headerFooterColor\":\"#1e293b\",\"headerFooterTextColor\":\"#ffffff\",\"scrollbarThumbColor\":\"#5c94f0\",\"scrollbarTrackColor\":\"#f0f0f0\",\"scrollbarHoverColor\":\"#8ab7ff\",\"scrollbarWidth\":\"auto\",\"calendarSelectedBgColor\":\"#62b767\",\"calendarSelectedTextColor\":\"#ffffff\",\"calendarWeekendBgColor\":\"#ff0000\",\"calendarWeekendTextColor\":\"#ffffff\",\"timetableHeaderBgColor\":\"#5c94f0\",\"timetableHeaderTextColor\":\"#ffffff\",\"timetableHoursBgColor\":\"#e6e6e6\",\"timetableHoursTextColor\":\"#000000\",\"timetableSelectedHeaderBg\":\"#5c94f0\",\"timetableSelectedHeaderText\":\"#ffffff\",\"timetableSelectedCellBg\":\"#eef2ff\",\"datatableHeaderBgColor\":\"#62b767\",\"datatableHeaderTextColor\":\"#ffffff\",\"datatableHeaderHoverBgColor\":\"#7dcf82\",\"datatableHeaderHoverTextColor\":\"#ffffff\",\"datatableHeaderActiveBgColor\":\"#81df88\",\"datatableHeaderActiveTextColor\":\"#ffffff\",\"datatablePaginationBgColor\":\"#5c94f0\",\"datatablePaginationTextColor\":\"#ffffff\",\"datatablePaginationButtonBgColor\":\"#94bdff\",\"datatablePaginationButtonTextColor\":\"#ffffff\",\"datatablePaginationButtonHoverBgColor\":\"#3884ff\",\"datatablePaginationButtonHoverTextColor\":\"#ffffff\",\"datatablePaginationButtonActiveBgColor\":\"#96aaca\",\"datatablePaginationButtonActiveTextColor\":\"#ffffff\",\"accordionHeaderBgColor\":\"#5c94f0\",\"accordionHeaderTextColor\":\"#ffffff\",\"accordionHeaderActiveBgColor\":\"#77a9f8\",\"accordionHeaderActiveTextColor\":\"#ffffff\",\"accordionContentBgColor\":\"#f0f0f0\",\"accordionContentTextColor\":\"#46505d\",\"modalHeaderBgColor\":\"#5c94f0\",\"modalHeaderTextColor\":\"#ffffff\",\"modalBodyBgColor\":\"#e6e6e6\",\"modalBodyTextColor\":\"#000000\",\"modalFooterBgColor\":\"#c7c7c7\",\"modalCloseButtonBgColor\":\"#ff0000\",\"modalCloseButtonTextColor\":\"#ffffff\",\"modalCloseButtonHoverBgColor\":\"#b30000\",\"modalCloseButtonHoverTextColor\":\"#ffffff\",\"userCardBgColor\":\"#e0e7ff\",\"userCardTextColor\":\"#363030\",\"userCardTextSecondaryColor\":\"#585e65\",\"chatSidebarBgColor\":\"#e5f2ff\",\"chatItemHoverBgColor\":\"#f1f5f9\",\"chatItemActiveBgColor\":\"#e0e7ff\",\"chatItemActiveBorderColor\":\"#6366f1\",\"chatItemTextMainColor\":\"#334155\",\"chatItemTextSecondaryColor\":\"#64748b\",\"chatBadgeBgColor\":\"#f75e5e\",\"chatBadgeTextColor\":\"#ffffff\",\"chatHeaderBgColor\":\"#5c94f0\",\"chatHeaderTextColor\":\"#ffffff\",\"chatContainerBgColor\":\"#f8fafc\",\"chatInputAreaBgColor\":\"#f1f5f9\",\"chatBubbleSentBgColor\":\"#62b767\",\"chatBubbleSentTextColor\":\"#ffffff\",\"chatBubbleReceivedBgColor\":\"#828282\",\"chatBubbleReceivedTextColor\":\"#ffffff\",\"eventCardBgColor\":\"#e0fdff\",\"eventCardBorderColor\":\"#e0fdff\",\"eventCardTitleColor\":\"#000000\",\"eventCardMetaColor\":\"#000000\",\"eventsSidebarBgColor\":\"#ededed\",\"eventsSidebarTitleColor\":\"#000000\",\"itemsPerPageUsuarios\":10,\"itemsPerPageCentros\":10,\"itemsPerPageCiclos\":10,\"itemsPerPageGrupos\":10,\"itemsPerPageModulos\":10,\"itemsPerPageMatriculas\":10,\"itemsPerPageImparticiones\":10,\"itemsPerPageHorarios\":10,\"nameTitleConfig\":{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}}}]','#ffffff','#5c94f0','#ffffff','#e6e6e6','#000000','#c7c7c7','#ff0000','#ffffff','#b30000','#ffffff','{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}','#e0e7ff','#363030','#585e65','#e5f2ff','#f1f5f9','#e0e7ff','#6366f1','#334155','#64748b','#f75e5e','#ffffff','#5c94f0','#ffffff','#f8fafc','#62b767','#ffffff','#828282','#ffffff','#f1f5f9','#77a9f8','#ffffff','#e0fdff','#e0fdff','#000000','#000000','#ededed','#000000','#2b3950','#ffffff','#1e293b','#ffffff'),
(2,'#3b82f6','#1e3a8a',4,'#0f172a','#334155','#3b82f6','#ffffff','#1e3a8a','#ffffff','#1e40af','#ffffff','#1e40af','#ffffff','#ffffff','#0f172a','#64748b','2026-02-03 14:40:48','2026-02-03 14:40:48',0,NULL,'#bfdbfe','#eff6ff','#93c5fd','#3b82f6','#ffffff','#f1f5f9','#64748b','#f1f5f9','#334155','#f8fafc','#64748b','#f8fafc','#64748b','#f8fafc','#64748b','#f1f5f9','#334155','#e2e8f0','#1e293b','#ffffff','#64748b','#f1f5f9','#334155','#e2e8f0','#1e293b',20,20,20,20,20,20,20,20,'#dbeafe','#1e40af','#eff6ff','12px','#f1f5f9','#334155','#ffffff','#64748b','[]','#ffffff','#1e3a8a','#ffffff','#ffffff','#0f172a','#eff6ff','#ffffff','#64748b','#f1f5f9','#334155',NULL,'','','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''),
(3,'#3b82f6','#1e3a8a',NULL,'#0f172a','#334155','#3b82f6','#ffffff','#1e3a8a','#ffffff','#1e40af','#ffffff','#1e40af','#ffffff','#ffffff','#0f172a','#64748b','2026-02-04 17:19:09','2026-02-10 11:27:21',0,NULL,'#bfdbfe','#eff6ff','#93c5fd','#3b82f6','#ffffff','#f1f5f9','#64748b','#f1f5f9','#334155','#f8fafc','#64748b','#f8fafc','#64748b','#f8fafc','#64748b','#f1f5f9','#334155','#e2e8f0','#1e293b','#ffffff','#64748b','#f1f5f9','#334155','#e2e8f0','#1e293b',20,20,20,20,20,20,20,20,'#dbeafe','#1e40af','#eff6ff','12px','#f1f5f9','#334155','#ffffff','#64748b','[{\"name\":\"ADMIN\",\"settings\":{\"primaryColor\":\"#3b82f6\",\"secondaryColor\":\"#64748b\",\"sidebarColor\":\"#1e3a8a\",\"sidebarActiveColor\":\"#1e40af\",\"sidebarActiveTextColor\":\"#ffffff\",\"sidebarHoverColor\":\"#1e40af\",\"sidebarHoverTextColor\":\"#ffffff\",\"sidebarAccordionHeaderBgColor\":\"#1e3a8a\",\"sidebarAccordionHeaderTextColor\":\"#ffffff\",\"sidebarAccordionContentBgColor\":\"#1e3a8a\",\"sidebarAccordionContentTextColor\":\"#ffffff\",\"textMainColor\":\"#0f172a\",\"textSecondaryColor\":\"#334155\",\"specialTextColor\":\"#ffffff\",\"buttonPrimaryColor\":\"#3b82f6\",\"buttonPrimaryTextColor\":\"#ffffff\",\"buttonSecondaryColor\":\"#ffffff\",\"buttonSecondaryTextColor\":\"#0f172a\",\"headerFooterColor\":\"#1e3a8a\",\"headerFooterTextColor\":\"#ffffff\",\"scrollbarThumbColor\":\"#bfdbfe\",\"scrollbarTrackColor\":\"#eff6ff\",\"scrollbarHoverColor\":\"#93c5fd\",\"scrollbarWidth\":\"12px\",\"calendarSelectedBgColor\":\"#3b82f6\",\"calendarSelectedTextColor\":\"#ffffff\",\"calendarWeekendBgColor\":\"#f1f5f9\",\"calendarWeekendTextColor\":\"#64748b\",\"timetableHeaderBgColor\":\"#f1f5f9\",\"timetableHeaderTextColor\":\"#334155\",\"timetableHoursBgColor\":\"#f8fafc\",\"timetableHoursTextColor\":\"#64748b\",\"timetableSelectedHeaderBg\":\"#dbeafe\",\"timetableSelectedHeaderText\":\"#1e40af\",\"timetableSelectedCellBg\":\"#eff6ff\",\"datatableHeaderBgColor\":\"#f8fafc\",\"datatableHeaderTextColor\":\"#64748b\",\"datatableHeaderHoverBgColor\":\"#f1f5f9\",\"datatableHeaderHoverTextColor\":\"#334155\",\"datatableHeaderActiveBgColor\":\"#e2e8f0\",\"datatableHeaderActiveTextColor\":\"#1e293b\",\"datatablePaginationBgColor\":\"#f8fafc\",\"datatablePaginationTextColor\":\"#64748b\",\"datatablePaginationButtonBgColor\":\"#ffffff\",\"datatablePaginationButtonTextColor\":\"#64748b\",\"datatablePaginationButtonHoverBgColor\":\"#f1f5f9\",\"datatablePaginationButtonHoverTextColor\":\"#334155\",\"datatablePaginationButtonActiveBgColor\":\"#e2e8f0\",\"datatablePaginationButtonActiveTextColor\":\"#1e293b\",\"accordionHeaderBgColor\":\"#f1f5f9\",\"accordionHeaderTextColor\":\"#334155\",\"accordionHeaderActiveBgColor\":\"\",\"accordionHeaderActiveTextColor\":\"\",\"accordionContentBgColor\":\"#ffffff\",\"accordionContentTextColor\":\"#64748b\",\"modalHeaderBgColor\":\"#1e3a8a\",\"modalHeaderTextColor\":\"#ffffff\",\"modalBodyBgColor\":\"#ffffff\",\"modalBodyTextColor\":\"#0f172a\",\"modalFooterBgColor\":\"#eff6ff\",\"modalCloseButtonBgColor\":\"#ffffff\",\"modalCloseButtonTextColor\":\"#64748b\",\"modalCloseButtonHoverBgColor\":\"#f1f5f9\",\"modalCloseButtonHoverTextColor\":\"#334155\",\"userCardBgColor\":\"\",\"userCardTextColor\":\"\",\"userCardTextSecondaryColor\":\"\",\"chatSidebarBgColor\":\"\",\"chatItemHoverBgColor\":\"\",\"chatItemActiveBgColor\":\"\",\"chatItemActiveBorderColor\":\"\",\"chatItemTextMainColor\":\"\",\"chatItemTextSecondaryColor\":\"\",\"chatBadgeBgColor\":\"\",\"chatBadgeTextColor\":\"\",\"chatHeaderBgColor\":\"\",\"chatHeaderTextColor\":\"\",\"chatContainerBgColor\":\"\",\"chatInputAreaBgColor\":\"\",\"chatBubbleSentBgColor\":\"\",\"chatBubbleSentTextColor\":\"\",\"chatBubbleReceivedBgColor\":\"\",\"chatBubbleReceivedTextColor\":\"\",\"eventCardBgColor\":\"#e5fcff\",\"eventCardBorderColor\":\"#e5fcff\",\"eventCardTitleColor\":\"#000000\",\"eventCardMetaColor\":\"#000000\",\"eventsSidebarBgColor\":\"#f0f0f0\",\"eventsSidebarTitleColor\":\"#000000\",\"itemsPerPageUsuarios\":20,\"itemsPerPageCentros\":20,\"itemsPerPageCiclos\":20,\"itemsPerPageGrupos\":20,\"itemsPerPageModulos\":20,\"itemsPerPageMatriculas\":20,\"itemsPerPageImparticiones\":20,\"itemsPerPageHorarios\":20,\"nameTitleConfig\":{\"words\":[],\"spacing\":\"0.5rem\",\"casing\":\"original\",\"alignment\":\"center\"}}}]','#ffffff','#1e3a8a','#ffffff','#ffffff','#0f172a','#eff6ff','#ffffff','#64748b','#f1f5f9','#334155','{\"words\":[],\"spacing\":\"0.5rem\",\"casing\":\"original\",\"alignment\":\"center\"}','','','','','','','','','','','','','','','','','','','','','','#e5fcff','#e5fcff','#000000','#000000','#f0f0f0','#000000','#1e3a8a','#ffffff','#1e3a8a','#ffffff');
/*!40000 ALTER TABLE `personalizacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tarea`
--

DROP TABLE IF EXISTS `tarea`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarea` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(255) NOT NULL,
  `descripcion` longtext DEFAULT NULL,
  `fecha_limite` datetime NOT NULL,
  `visible` tinyint(4) NOT NULL,
  `imparticion_id` int(11) NOT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `tipo` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `archivo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_3CA053665396730A` (`imparticion_id`),
  CONSTRAINT `FK_3CA053665396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tarea`
--

LOCK TABLES `tarea` WRITE;
/*!40000 ALTER TABLE `tarea` DISABLE KEYS */;
INSERT INTO `tarea` VALUES
(9,'Examen T5','<div>Examen T5 Examen T5 Examen T5 Examen T5 Examen T5 Examen T5</div>','2025-12-23 12:30:00',1,24,'2025-12-23 10:30:00','examen','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(10,'Ejercicios T2','<div>Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2&nbsp;</div>','2025-12-24 16:01:00',1,24,'2025-12-22 16:01:00','tarea','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(11,'Ejercicios T3','<div>Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3</div>','2025-12-24 16:02:00',1,24,'2025-12-22 16:02:00','tarea','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(12,'Ejercicios T1','<div>Ejercicios T1 Ejercicios T1 Ejercicios T1 Ejercicios T1</div>','2025-12-24 17:50:00',1,23,'2025-12-23 17:50:00','tarea','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(13,'Fol Tema 1 tarea','asdlfnsdkgjn','2026-02-10 21:53:00',1,28,NULL,'tarea','2026-02-03 20:53:05','2026-02-03 20:53:05',0,NULL,'EXAMEN-DESARROLLO-WEB-EN-ENTORNO-SERVIDOR-RESPUESTAS-698260316d01b.pdf'),
(14,'caca de asignatura 2','dgsdfghdfh','2026-02-11 00:41:00',1,28,NULL,'tarea','2026-02-03 23:42:19','2026-02-03 23:42:19',0,NULL,'ejerciciosTipoExamen2-698287db093f7.pdf');
/*!40000 ALTER TABLE `tarea` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(180) NOT NULL,
  `roles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`roles`)),
  `password` varchar(255) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `apellidos` varchar(255) NOT NULL,
  `rol_app` varchar(20) NOT NULL,
  `centro_id` int(11) DEFAULT NULL,
  `foto` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `nif` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_2265B05DE7927C74` (`email`),
  KEY `IDX_2265B05D298137A7` (`centro_id`),
  CONSTRAINT `FK_2265B05D298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES
(49,'admin@loggex.com','[\"ROLE_SUPERADMIN\"]','$2y$13$2Jljtnj7wPTQAWD6AEW59O7SKhJ9l2IJuxEYZRqDCeacmVV6Aw55K','David','Duque Díaz','admin',NULL,'/uploads/avatar/c7ea53844ba2bb780d716155eb9c34498d6bf505-697e01ce208fd.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 964 65 1347','60765993Q'),
(50,'alberto@eag.com','[\"ROLE_PROFESOR\",\"ROLE_USER\"]','$2y$13$GU7YaDFM1IofnCHCqtGfde7C/ETEFO8jkSp73i7I0v4FRZTQTPtJq','Alberto','Núñez Papo','profesor',3,'/uploads/avatar/35aedb388479dbcea7f406764fab3f8508ca7009.jpg','2026-01-31 22:12:20','2026-02-01 22:07:50',0,NULL,'911 456556','21588840M'),
(51,'joaquin@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$yCPpgazE03gBjonimhMknOslPIqA0dR6856dzvov7HQQYsttSBXJu','Joaquín','Suarez Mañueco','profesor',3,'/uploads/avatar/d53a3bcbd4852069b8eabdc09cea7f6b76119e36.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'952-18-0985','96281348J'),
(52,'jose@eag.com','[\"ROLE_PROFESOR\",\"ROLE_USER\"]','$2y$13$ZgGQ0vW/l/gcq21/KO/7RedTfu1/ZU4Tfpy1mdJGCWkt2dSj2fI.6','José','Pérez Cambriano','profesor',3,'/uploads/avatar/120d7b849b6cf5897d2c2c8c31af7f5776f57e25.jpg','2026-01-31 22:12:20','2026-02-10 09:23:57',0,NULL,'+34 995-95-6724','1111111111111'),
(53,'walter@eag.com','[\"ROLE_PROFESOR\",\"ROLE_USER\"]','$2y$13$OOx6cBcguY8ltLR89NJRh.Qtqp72M1APAMHH4IU0Zua6wJlluiAVO','Walter','Donovan Yupanky','profesor',3,'/uploads/avatar/f4c9a4458b819ecbfe8829d5ab7a202e5e12e677.jpg','2026-01-31 22:12:20','2026-02-10 09:23:48',0,NULL,'961 26 1798','aa'),
(54,'clara@eag.com','[\"ROLE_PROFESOR\",\"ROLE_USER\"]','$2y$13$8VLephkdOwaGB7a7yAYA1.DtvJwu37wc15TMeAzGBHMlFp1PNPnAS','Clara','Gutiérrez Mira','profesor',3,'/uploads/avatar/e63758981329e99969202e3b7cee1e694f93a2d1.jpg','2026-01-31 22:12:20','2026-02-10 09:23:40',0,NULL,'','70300626E'),
(55,'sara@eag.com','[\"ROLE_PROFESOR\",\"ROLE_ADMIN\"]','$2y$13$cSLKFuyGmUrJv/OwIiykk.0slJzhSwm1vHHPeXuIU.9ZbcFGgu/xq','Sara','Alberti Marizza','admin',3,'/uploads/avatar/438efc2c1de4294ac2e3bf134777ef6069eb8934.jpg','2026-01-31 22:12:20','2026-02-01 22:10:18',0,NULL,'+34 976423896','37603007P'),
(56,'maria@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$/8r.QIUMGYWWr8aXJXCfau4wmx7NCNCMqo250jQFPjGlT.BjabfGi','María','Cordero Acosta','profesor',3,'/uploads/avatar/afd1b2acb3a8c8c5c0ed24b089896c4b6ee3908b.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 965 62 9033','25151901K'),
(57,'vega.ferrer@alvarez.es','[\"ROLE_ALUMNO\",\"ROLE_USER\"]','$2y$13$God9dDDd0jN8pANHweaR0.AQfm3w4rz/p39nAYBDFpmHH0WPHiqzq','Daniel','Rosario Gálvez','alumno',3,'/uploads/avatar/dani-698371955bacf.jpg','2026-01-31 22:12:20','2026-02-04 16:19:33',0,NULL,'922 63 5586','80834170A'),
(58,'javier.coronado@yahoo.es','[\"ROLE_ALUMNO\"]','$2y$13$OEk6NniM8mcZiVcW3yJtSOiLGBzLIucbB5oAxnJIkj0/BAqc7J63G','Noa','Figueroa Negrón','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'993 878184','74304969L'),
(59,'tello.adam@torres.es','[\"ROLE_ALUMNO\"]','$2y$13$1ThREXZhftidvwXR3NBVDePCo.lHG1tfdsOsnnzqL7dMDWM7ui68q','Celia','Maldonado Treviño','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'983537145','05132434F'),
(60,'uaguirre@estrada.com.es','[\"ROLE_ALUMNO\"]','$2y$13$BLtX/l3Sy55bSNIM5VfDXesj8te7lk6Iy71xdfFKTNkVR9tAnYPY.','Saúl','Ortega Regalado','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 978-123247','99823086G'),
(61,'marc59@hotmail.com','[\"ROLE_ALUMNO\"]','$2y$13$btchZ3ChU1Ujcadu7IWU4uthWlz86VbsfkXHZ3a5BYHeBQxTzcPK.','Guillermo','Baca Heredia','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 932-75-1302','94367429Q'),
(62,'correa.mariacarmen@hotmail.com','[\"ROLE_ALUMNO\"]','$2y$13$AbwRR6McTGXozobYeH9eleBYdKdWjo/S3a5VpSBJJBXYBNC0KCuLS','Rosa María','Partida Cortez','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'986 073091','57058938D'),
(63,'escobar.arnau@hotmail.es','[\"ROLE_ALUMNO\"]','$2y$13$sGQa65iAvDcXYf3oqD48D.0kLg6wq7TT2915CeiFFEKsRwgislD8u','Aurora','Soler Solano','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 912377588','31521589C'),
(64,'hsedillo@pereira.es','[\"ROLE_ALUMNO\"]','$2y$13$mlZcuTyli1xgjxCamR2LNe5InMngraJjM3YAE9LqwjFRYCJF33zbe','Biel','Colunga Casillas','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 941-488626','66364474K'),
(65,'ainara.montero@castellano.es','[\"ROLE_ALUMNO\"]','$2y$13$9j/m78a7YvBMeL/LYWrpguF2MA.SAZuu5H2mN0BlJexJsw2zzRpDG','Fernando','Domenech Ordóñez','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 987-07-3304','19596477V'),
(66,'rodrigo08@gmail.com','[\"ROLE_ALUMNO\"]','$2y$13$54Zyude4z5xv1ddZM6i7p.8nk3z3D4EFi/uBHr5nJJBz6Le5XLRhW','Paula','Castellanos Rosas','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 904953726','76908969M'),
(67,'hnino@munoz.com.es','[\"ROLE_ALUMNO\"]','$2y$13$VKic4BlrmRfh/BBsqW12iurh4iODOGhVMGDICoRrO3mDs3H6xnJbi','Izan','Briseño Villarreal','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 975 822358','60471060N'),
(68,'munguia.ariadna@hispavista.com','[\"ROLE_ALUMNO\"]','$2y$13$kQhkGcigWjkEsYSqDprPtO1ZQJZRravcqkljYaOlYPfsOnujUSkV2','Jorge','Elizondo Castaño','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'908445241','11435655D'),
(69,'ariadna34@abeyta.es','[\"ROLE_ALUMNO\"]','$2y$13$KvVKTqKjcXVf2wQLZD8v1u/YfzdabNkRiy1emP7sQRHPLiOwevcv.','Helena','Tejada Amaya','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'991-112520','15532023P'),
(70,'plucero@live.com','[\"ROLE_ALUMNO\"]','$2y$13$j8ClxeqluN9PGl6Mpw/7SOnKT0X/MLKUAZmg/oA37oVu051kcsssK','Álvaro','Centeno Santiago','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'928 284709','25236922B'),
(71,'nerea66@hispavista.com','[\"ROLE_ALUMNO\"]','$2y$13$pQ0E17PbWw0EXR90fYW.jORKfmlOYKe4DywAc5hu2sVvEDfiClhbq','Alba','Segura Domínguez','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'983709720','77056038N'),
(72,'saparicio@roybal.es','[\"ROLE_ALUMNO\"]','$2y$13$U1uMjiUf/gaQ8v4xHDyX0.pyvwtFQA1QoHYCtcFKB95TrY3lQ2MnS','Aaron','Carbonell Betancourt','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 918 934388','23486280Z'),
(73,'gallegos.rosamaria@navarro.org','[\"ROLE_ALUMNO\"]','$2y$13$hmxh/0aLjWLJQqAWq.moNOjTHJ/53T3kcIgPgkg23tnlWlRJVrgDm','Ángel','Cotto Ozuna','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'903-544197','47447299R'),
(74,'vergara.gael@renteria.net','[\"ROLE_ALUMNO\"]','$2y$13$/z8G3WSXViQh4PiNLEQoJuVYeRVJYnajG9ex8Tl.HZ0FsnaJU.KQ2','Saúl','Cavazos Gutiérrez','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 901 400546','14141392A'),
(75,'jordi.oliva@pascual.es','[\"ROLE_ALUMNO\"]','$2y$13$7Rvh5NW3eOpPGR2Sl6/CLeXwNclsGv/ZAE/IalqchjqBxxnJ9ke6y','Marina','Lozano Varela','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'970 06 2677','56522210D'),
(76,'rey.omar@verduzco.com.es','[\"ROLE_ALUMNO\"]','$2y$13$AweRu9/TW0l/KEzzpgOBVO09Qopl3l2684Fi1sMJwKwm5/je7ttCa','Laia','Delarosa Montez','alumno',3,'/uploads/avatar/avatar-placeholder.png','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 936 86 1825','21052314T'),
(77,'pepe@iestech.com','[\"ROLE_PROFESOR\",\"ROLE_ADMIN\"]','$2y$13$7OivdXwRW2aOHtTiLw96wO8/p7hY4BATQTpAp0Ve/o/BRYAd0G.ni','Theodore','Robert Bundy','admin',4,'/uploads/avatar/f0dc3678d4d52bf22d2ebcdfd9cd28e4f1b99cb6.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 900-59-7119','48507053F'),
(79,'vega.ferrer+34@alvarez.es','[\"ROLE_ALUMNO\"]','$2y$13$aGPheup/oe8/4glf99xkB.CxGgKHyLOXJNVepu5HnhJiMWHPuP4bO','vega','ferrer','alumno',3,NULL,'2026-02-10 09:27:35','2026-02-10 09:27:35',0,NULL,'12345678','70300626E');
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-10 11:30:22
