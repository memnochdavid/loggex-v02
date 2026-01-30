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
  PRIMARY KEY (`id`),
  KEY `IDX_D8264A8D5396730A` (`imparticion_id`),
  KEY `IDX_D8264A8DFC28E5EE` (`alumno_id`),
  CONSTRAINT `FK_D8264A8D5396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`),
  CONSTRAINT `FK_D8264A8DFC28E5EE` FOREIGN KEY (`alumno_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencia`
--

LOCK TABLES `asistencia` WRITE;
/*!40000 ALTER TABLE `asistencia` DISABLE KEYS */;
INSERT INTO `asistencia` VALUES
(11,'2025-12-22','F',40,72,'15:00:00','tyihulhjgñ'),
(12,'2025-12-22','P',40,73,'15:00:00',''),
(13,'2025-12-22','P',40,74,'15:00:00',''),
(14,'2025-12-22','P',40,75,'15:00:00',''),
(15,'2025-12-22','P',40,76,'15:00:00',''),
(16,'2025-12-22','F',24,57,'10:00:00',''),
(17,'2025-12-22','P',24,58,'10:00:00',''),
(18,'2025-12-22','P',24,59,'10:00:00',''),
(19,'2025-12-22','P',24,60,'10:00:00',''),
(20,'2025-12-22','P',24,61,'10:00:00',''),
(21,'2025-12-22','R',31,62,'12:00:00','un retraso para un retrasado'),
(22,'2025-12-22','P',31,63,'12:00:00',''),
(23,'2025-12-22','P',31,64,'12:00:00',''),
(24,'2025-12-22','P',31,65,'12:00:00',''),
(25,'2025-12-22','P',31,66,'12:00:00',''),
(26,'2025-12-18','P',28,57,'12:00:00',''),
(27,'2025-12-18','F',28,58,'12:00:00',''),
(28,'2025-12-18','P',28,59,'12:00:00',''),
(29,'2025-12-18','P',28,60,'12:00:00',''),
(30,'2025-12-18','F',28,61,'12:00:00',''),
(31,'2025-12-19','F',28,57,'13:00:00',''),
(32,'2025-12-19','P',28,58,'13:00:00',''),
(33,'2025-12-19','P',28,59,'13:00:00',''),
(34,'2025-12-19','F',28,60,'13:00:00',''),
(35,'2025-12-19','P',28,61,'13:00:00',''),
(36,'2025-12-16','P',37,67,'19:00:00',''),
(37,'2025-12-16','F',37,68,'19:00:00',''),
(38,'2025-12-16','P',37,69,'19:00:00',''),
(39,'2025-12-16','P',37,70,'19:00:00',''),
(40,'2025-12-16','F',37,71,'19:00:00','');
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_8A3AF2187AB91AEC` (`entrega_id`),
  CONSTRAINT `FK_8A3AF2187AB91AEC` FOREIGN KEY (`entrega_id`) REFERENCES `entrega` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calificacion`
--

LOCK TABLES `calificacion` WRITE;
/*!40000 ALTER TABLE `calificacion` DISABLE KEYS */;
INSERT INTO `calificacion` VALUES
(7,8,'lo has hecho muy bien',7);
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `centro`
--

LOCK TABLES `centro` WRITE;
/*!40000 ALTER TABLE `centro` DISABLE KEYS */;
INSERT INTO `centro` VALUES
(3,'Escuela Arte Granada','B18000000',1,NULL,'82a60d322ac7071d35e1bce779454d84068b4091.png','Av. Dr. Oloriz, 6, Beiro, 18012 Granada','958 27 80 60'),
(4,'IES Tecnológico TFG','B5363643538',1,NULL,'161072a8938d361bab5d9d4234e6e2eaa6488d8f.png','Calle Falsa, 123','958 11 11 11');
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
(3,'Desarrollo de Aplicaciones Web','Superior',3),
(4,'Desarrollo de Aplicaciones Multiplataforma','Superior',3);
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
('DoctrineMigrations\\Version20251225153709','2025-12-25 15:37:16',69);
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
  PRIMARY KEY (`id`),
  KEY `IDX_E56D596B6D5BDFE1` (`tarea_id`),
  KEY `IDX_E56D596BFC28E5EE` (`alumno_id`),
  CONSTRAINT `FK_E56D596B6D5BDFE1` FOREIGN KEY (`tarea_id`) REFERENCES `tarea` (`id`),
  CONSTRAINT `FK_E56D596BFC28E5EE` FOREIGN KEY (`alumno_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega`
--

LOCK TABLES `entrega` WRITE;
/*!40000 ALTER TABLE `entrega` DISABLE KEYS */;
INSERT INTO `entrega` VALUES
(7,'2025-12-22 16:04:15','asgsdgbsdfb',10,57,'https://drive.google.com/drive/folders/1w7-lVfgAcYjL3phW6RIEjjWXnfluH09t?usp=sharing');
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
  PRIMARY KEY (`id`),
  KEY `IDX_9472C78A298137A7` (`centro_id`),
  CONSTRAINT `FK_9472C78A298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `festivo`
--

LOCK TABLES `festivo` WRITE;
/*!40000 ALTER TABLE `festivo` DISABLE KEYS */;
INSERT INTO `festivo` VALUES
(4,'Navidad','2025-12-22',NULL,'2026-01-06'),
(5,'Semana Santa','2026-03-28',NULL,'2026-04-05');
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
(5,'Desarrollo de Aplicaciones Web','2025/2026',3,3,1,'1º DAW'),
(6,'Desarrollo de Aplicaciones Web','2024/2025',3,3,2,'2º DAW'),
(7,'Desarrollo de Aplicaciones Multiplataforma','2025/2026',4,3,1,'1º DAM'),
(8,'Desarrollo de Aplicaciones Multiplataforma','2024/2025',4,3,2,'2º DAM');
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
(98,1,'08:30:00','09:30:00','Aula 101',23),
(99,1,'09:30:00','10:30:00','Aula 101',23),
(100,1,'10:30:00','11:30:00','Aula 101',24),
(101,1,'11:30:00','12:30:00','Aula 101',24),
(102,1,'12:30:00','13:30:00','Aula 101',25),
(103,1,'13:30:00','14:30:00','Aula 101',25),
(104,2,'08:30:00','09:30:00','Aula 101',23),
(105,2,'09:30:00','10:30:00','Aula 101',23),
(106,2,'10:30:00','11:30:00','Aula 101',25),
(107,2,'11:30:00','12:30:00','Aula 101',25),
(108,2,'12:30:00','13:30:00','Aula 101',26),
(109,2,'13:30:00','14:30:00','Aula 101',26),
(110,3,'08:30:00','09:30:00','Aula 101',23),
(111,3,'09:30:00','10:30:00','Aula 101',23),
(112,3,'10:30:00','11:30:00','Aula 101',26),
(113,3,'11:30:00','12:30:00','Aula 101',26),
(114,3,'12:30:00','13:30:00','Aula 101',27),
(115,3,'13:30:00','14:30:00','Aula 101',27),
(116,4,'08:30:00','09:30:00','Aula 101',26),
(117,4,'09:30:00','10:30:00','Aula 101',26),
(118,4,'10:30:00','11:30:00','Aula 101',27),
(119,4,'11:30:00','12:30:00','Aula 101',27),
(120,4,'12:30:00','13:30:00','Aula 101',28),
(121,4,'13:30:00','14:30:00','Aula 101',28),
(122,5,'08:30:00','09:30:00','Aula 101',26),
(123,5,'09:30:00','10:30:00','Aula 101',26),
(124,5,'10:30:00','11:30:00','Aula 101',27),
(125,5,'11:30:00','12:30:00','Aula 101',27),
(126,5,'12:30:00','13:30:00','Aula 101',24),
(127,5,'13:30:00','14:30:00','Aula 101',28),
(128,1,'08:30:00','09:30:00','Aula 102',29),
(129,1,'09:30:00','10:30:00','Aula 102',29),
(130,1,'10:30:00','11:30:00','Aula 102',30),
(131,1,'11:30:00','12:30:00','Aula 102',30),
(132,1,'12:30:00','13:30:00','Aula 102',31),
(133,1,'13:30:00','14:30:00','Aula 102',31),
(134,2,'08:30:00','09:30:00','Aula 102',29),
(135,2,'09:30:00','10:30:00','Aula 102',29),
(136,2,'10:30:00','11:30:00','Aula 102',30),
(137,2,'11:30:00','12:30:00','Aula 102',30),
(138,2,'12:30:00','13:30:00','Aula 102',31),
(139,2,'13:30:00','14:30:00','Aula 102',31),
(140,3,'08:30:00','09:30:00','Aula 102',29),
(141,3,'09:30:00','10:30:00','Aula 102',29),
(142,3,'10:30:00','11:30:00','Aula 102',30),
(143,3,'11:30:00','12:30:00','Aula 102',30),
(144,3,'12:30:00','13:30:00','Aula 102',32),
(145,3,'13:30:00','14:30:00','Aula 102',32),
(146,4,'08:30:00','09:30:00','Aula 102',30),
(147,4,'09:30:00','10:30:00','Aula 102',30),
(148,4,'10:30:00','11:30:00','Aula 102',32),
(149,4,'11:30:00','12:30:00','Aula 102',32),
(150,4,'12:30:00','13:30:00','Aula 102',33),
(151,4,'13:30:00','14:30:00','Aula 102',33),
(152,5,'08:30:00','09:30:00','Aula 102',32),
(153,5,'09:30:00','10:30:00','Aula 102',32),
(154,5,'10:30:00','11:30:00','Aula 102',33),
(155,5,'11:30:00','12:30:00','Aula 102',33),
(156,5,'12:30:00','13:30:00','Aula 102',29),
(157,1,'15:00:00','16:00:00','Aula 103',34),
(158,1,'16:00:00','17:00:00','Aula 103',34),
(159,1,'17:00:00','18:00:00','Aula 103',35),
(160,1,'18:00:00','19:00:00','Aula 103',35),
(161,1,'19:00:00','20:00:00','Aula 103',36),
(162,1,'20:00:00','21:00:00','Aula 103',36),
(163,2,'15:00:00','16:00:00','Aula 103',34),
(164,2,'16:00:00','17:00:00','Aula 103',34),
(165,2,'17:00:00','18:00:00','Aula 103',36),
(166,2,'18:00:00','19:00:00','Aula 103',36),
(167,2,'19:00:00','20:00:00','Aula 103',37),
(168,2,'20:00:00','21:00:00','Aula 103',37),
(169,3,'15:00:00','16:00:00','Aula 103',34),
(170,3,'16:00:00','17:00:00','Aula 103',34),
(171,3,'17:00:00','18:00:00','Aula 103',37),
(172,3,'18:00:00','19:00:00','Aula 103',37),
(173,3,'19:00:00','20:00:00','Aula 103',38),
(174,3,'20:00:00','21:00:00','Aula 103',38),
(175,4,'15:00:00','16:00:00','Aula 103',37),
(176,4,'16:00:00','17:00:00','Aula 103',37),
(177,4,'17:00:00','18:00:00','Aula 103',38),
(178,4,'18:00:00','19:00:00','Aula 103',38),
(179,4,'19:00:00','20:00:00','Aula 103',39),
(180,4,'20:00:00','21:00:00','Aula 103',39),
(181,5,'15:00:00','16:00:00','Aula 103',37),
(182,5,'16:00:00','17:00:00','Aula 103',37),
(183,5,'17:00:00','18:00:00','Aula 103',38),
(184,5,'18:00:00','19:00:00','Aula 103',38),
(185,5,'19:00:00','20:00:00','Aula 103',35),
(186,5,'20:00:00','21:00:00','Aula 103',39),
(187,1,'15:00:00','16:00:00','Aula 104',40),
(188,1,'16:00:00','17:00:00','Aula 104',40),
(189,1,'17:00:00','18:00:00','Aula 104',41),
(190,1,'18:00:00','19:00:00','Aula 104',41),
(191,1,'19:00:00','20:00:00','Aula 104',42),
(192,1,'20:00:00','21:00:00','Aula 104',42),
(193,2,'15:00:00','16:00:00','Aula 104',40),
(194,2,'16:00:00','17:00:00','Aula 104',40),
(195,2,'17:00:00','18:00:00','Aula 104',41),
(196,2,'18:00:00','19:00:00','Aula 104',41),
(197,2,'19:00:00','20:00:00','Aula 104',42),
(198,2,'20:00:00','21:00:00','Aula 104',42),
(199,3,'15:00:00','16:00:00','Aula 104',40),
(200,3,'16:00:00','17:00:00','Aula 104',40),
(201,3,'17:00:00','18:00:00','Aula 104',41),
(202,3,'18:00:00','19:00:00','Aula 104',41),
(203,3,'19:00:00','20:00:00','Aula 104',43),
(204,3,'20:00:00','21:00:00','Aula 104',43),
(205,4,'15:00:00','16:00:00','Aula 104',43),
(206,4,'16:00:00','17:00:00','Aula 104',43),
(207,4,'17:00:00','18:00:00','Aula 104',44),
(208,4,'18:00:00','19:00:00','Aula 104',44),
(209,4,'19:00:00','20:00:00','Aula 104',45),
(210,4,'20:00:00','21:00:00','Aula 104',45),
(211,5,'15:00:00','16:00:00','Aula 104',44),
(212,5,'16:00:00','17:00:00','Aula 104',44),
(213,5,'17:00:00','18:00:00','Aula 104',42),
(214,5,'18:00:00','19:00:00','Aula 104',43),
(215,5,'19:00:00','20:00:00','Aula 104',45);
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
  PRIMARY KEY (`id`),
  KEY `IDX_D179FDFDE52BD977` (`profesor_id`),
  KEY `IDX_D179FDFDC07F55F5` (`modulo_id`),
  KEY `IDX_D179FDFD9C833003` (`grupo_id`),
  CONSTRAINT `FK_D179FDFD9C833003` FOREIGN KEY (`grupo_id`) REFERENCES `grupo` (`id`),
  CONSTRAINT `FK_D179FDFDC07F55F5` FOREIGN KEY (`modulo_id`) REFERENCES `modulo` (`id`),
  CONSTRAINT `FK_D179FDFDE52BD977` FOREIGN KEY (`profesor_id`) REFERENCES `usuario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imparticion`
--

LOCK TABLES `imparticion` WRITE;
/*!40000 ALTER TABLE `imparticion` DISABLE KEYS */;
INSERT INTO `imparticion` VALUES
(23,50,35,5),
(24,51,36,5),
(25,52,37,5),
(26,53,38,5),
(27,54,39,5),
(28,55,40,5),
(29,56,41,6),
(30,50,42,6),
(31,51,43,6),
(32,52,44,6),
(33,53,45,6),
(34,52,23,7),
(35,53,24,7),
(36,54,25,7),
(37,55,26,7),
(38,56,27,7),
(39,50,28,7),
(40,51,29,8),
(41,52,30,8),
(42,53,31,8),
(43,54,32,8),
(44,56,33,8),
(45,56,34,8);
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
(1,'Tema 1','20251228_entornos-desarrollo-tema-1.pdf','2025-12-28 10:43:11',24),
(2,'Tema 1','20251228_fol-tema-1.pdf','2025-12-28 10:50:10',28);
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
(41,57,5),
(42,58,5),
(43,59,5),
(44,60,5),
(45,61,5),
(46,62,6),
(47,63,6),
(48,64,6),
(49,65,6),
(50,66,6),
(51,67,7),
(52,68,7),
(53,69,7),
(54,70,7),
(55,71,7),
(56,72,8),
(57,73,8),
(58,74,8),
(59,75,8),
(60,76,8);
/*!40000 ALTER TABLE `matricula` ENABLE KEYS */;
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
(23,'Bases de datos','0001',4,1,6),
(24,'Entornos de desarrollo','0002',4,1,3),
(25,'Lenguajes de marcas','0003',4,1,4),
(26,'Programación','0004',4,1,8),
(27,'Sistemas informáticos','0005',4,1,6),
(28,'FOL','0006',4,1,3),
(29,'Acceso a datos','0007',4,2,6),
(30,'Desarrollo de interfaces','0008',4,2,6),
(31,'Programación multimedia','0009',4,2,5),
(32,'Servicios y procesos','0010',4,2,5),
(33,'Sistemas de gestión','0011',4,2,5),
(34,'EIE','0012',4,2,3),
(35,'Bases de datos','0001',3,1,6),
(36,'Entornos de desarrollo','0002',3,1,3),
(37,'Lenguajes de marcas','0003',3,1,4),
(38,'Programación','0004',3,1,8),
(39,'Sistemas informáticos','0005',3,1,6),
(40,'FOL','0006',3,1,3),
(41,'Desarrollo Cliente','0013',3,2,7),
(42,'Desarrollo Servidor','0014',3,2,8),
(43,'Despliegue Apps','0015',3,2,4),
(44,'Diseño de Interfaces','0016',3,2,6),
(45,'EIE','0017',3,2,5);
/*!40000 ALTER TABLE `modulo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `noticia`
--

DROP TABLE IF EXISTS `noticia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `noticia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(255) NOT NULL,
  `contenido` longtext NOT NULL,
  `fecha_publicacion` datetime NOT NULL,
  `centro_id` int(11) NOT NULL,
  `autor_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_31205F96298137A7` (`centro_id`),
  KEY `IDX_31205F9614D45BBE` (`autor_id`),
  CONSTRAINT `FK_31205F9614D45BBE` FOREIGN KEY (`autor_id`) REFERENCES `usuario` (`id`),
  CONSTRAINT `FK_31205F96298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `noticia`
--

LOCK TABLES `noticia` WRITE;
/*!40000 ALTER TABLE `noticia` DISABLE KEYS */;
/*!40000 ALTER TABLE `noticia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personalizacion`
--

DROP TABLE IF EXISTS `personalizacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `personalizacion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `color_principal` varchar(7) DEFAULT NULL,
  `color_menu_lateral` varchar(7) DEFAULT NULL,
  `color_topbar` varchar(7) DEFAULT NULL,
  `fuente` varchar(255) DEFAULT NULL,
  `centro_id` int(11) DEFAULT NULL,
  `color_fondo` varchar(7) DEFAULT NULL,
  `color_texto` varchar(7) DEFAULT NULL,
  `color_menu_activo` varchar(7) DEFAULT NULL,
  `color_borde_activo` varchar(7) DEFAULT NULL,
  `color_iconos_top` varchar(7) DEFAULT NULL,
  `horario_cabecera_bg` varchar(7) DEFAULT NULL,
  `horario_cabecera_texto` varchar(7) DEFAULT NULL,
  `horario_tarjeta_bg` varchar(7) DEFAULT NULL,
  `horario_tarjeta_borde` varchar(7) DEFAULT NULL,
  `color_logo_area` varchar(7) DEFAULT NULL,
  `color_texto_sidebar` varchar(7) DEFAULT NULL,
  `color_texto_boton` varchar(7) DEFAULT NULL,
  `color_badge_bg` varchar(7) DEFAULT NULL,
  `color_badge_texto` varchar(7) DEFAULT NULL,
  `color_menu_header` varchar(7) DEFAULT NULL,
  `color_btn_secundario_bg` varchar(7) DEFAULT NULL,
  `color_btn_secundario_text` varchar(7) DEFAULT NULL,
  `color_btn_danger_bg` varchar(7) DEFAULT NULL,
  `color_btn_danger_text` varchar(7) DEFAULT NULL,
  `horario_festivo_bg` varchar(7) DEFAULT NULL,
  `horario_festivo_texto` varchar(7) DEFAULT NULL,
  `color_menu_hover` varchar(7) DEFAULT NULL,
  `color_texto_hover` varchar(7) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_A6EC3EF3298137A7` (`centro_id`),
  CONSTRAINT `FK_A6EC3EF3298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personalizacion`
--

LOCK TABLES `personalizacion` WRITE;
/*!40000 ALTER TABLE `personalizacion` DISABLE KEYS */;
INSERT INTO `personalizacion` VALUES
(1,'#0d6efd','#d1d1d1','#dedede','Inter',3,'#f2f2f2','#1f2937','#ff5959','#ebebeb','#64748b','#212529','#ffffff','#e0f2fe','#0ea5e9','#ff0000','#454545','#ffffff','#ff0000','#ff0000','#36383a','#ffc35c','#ffffff','#dc3838','#ffffff','#dc3545','#ffffff','#ff6b6b','#545454'),
(2,'#0d6efd','#f2cd8c','#f2cd8c','Inter',4,'#f2f2f2','#1f2937','#473f3e','#ebebeb','#64748b','#212529','#ffffff','#e0f2fe','#0ea5e9','#c2c2c2','#5a5b5e','#ffffff','#e2e8f0','#1e293b','#36383a','#ffc35c','#ffffff','#dc3545','#ffffff','#dc3545','#ffffff','#334155','#ffffff'),
(3,'#0d6efd','#3e3b6d','#88b2d5','Google Sans',NULL,'#f2f2f2','#1f2937','#88b2d5','#454545','#454545','#212529','#ffffff','#e0f2fe','#0ea5e9','#c2c2c2','#d1d1d1','#ffffff','#e2e8f0','#1e293b','#ffffff','#ffc35c','#ffffff','#dc3545','#ffffff','#dc3545','#ffffff','#a2c0d7','#454545'),
(4,'#6610f2','#111111','#ffffff','Inter',NULL,'#f4f4f4','#1f2937','#6610f2','#ffffff','#6610f2','#212529','#ffffff','#e0e7ff','#6366f1','#000000','#a0a0a0','#ffffff','#e2e8f0','#1e293b','#6c757d','#6c757d','#ffffff','#dc3545','#ffffff','#dc3545','#ffffff','#334155','#ffffff');
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
  PRIMARY KEY (`id`),
  KEY `IDX_3CA053665396730A` (`imparticion_id`),
  CONSTRAINT `FK_3CA053665396730A` FOREIGN KEY (`imparticion_id`) REFERENCES `imparticion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tarea`
--

LOCK TABLES `tarea` WRITE;
/*!40000 ALTER TABLE `tarea` DISABLE KEYS */;
INSERT INTO `tarea` VALUES
(9,'Examen T5','<div>Examen T5 Examen T5 Examen T5 Examen T5 Examen T5 Examen T5</div>','2025-12-23 12:30:00',1,24,'2025-12-23 10:30:00','examen'),
(10,'Ejercicios T2','<div>Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2 Ejercicios T2&nbsp;</div>','2025-12-24 16:01:00',1,24,'2025-12-22 16:01:00','tarea'),
(11,'Ejercicios T3','<div>Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3 Ejercicios T3</div>','2025-12-24 16:02:00',1,24,'2025-12-22 16:02:00','tarea'),
(12,'Ejercicios T1','<div>Ejercicios T1 Ejercicios T1 Ejercicios T1 Ejercicios T1</div>','2025-12-24 17:50:00',1,23,'2025-12-23 17:50:00','tarea');
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_IDENTIFIER_EMAIL` (`email`),
  KEY `IDX_2265B05D298137A7` (`centro_id`),
  CONSTRAINT `FK_2265B05D298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES
(49,'admin@loggex.com','[\"ROLE_ADMIN\"]','$2y$13$2Jljtnj7wPTQAWD6AEW59O7SKhJ9l2IJuxEYZRqDCeacmVV6Aw55K','David','Duque Díaz','admin',NULL,'c7ea53844ba2bb780d716155eb9c34498d6bf505.jpg'),
(50,'alberto@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$GU7YaDFM1IofnCHCqtGfde7C/ETEFO8jkSp73i7I0v4FRZTQTPtJq','Alberto','Núñez Papo','profesor',3,'35aedb388479dbcea7f406764fab3f8508ca7009.jpg'),
(51,'joaquin@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$yCPpgazE03gBjonimhMknOslPIqA0dR6856dzvov7HQQYsttSBXJu','Joaquín','Suarez Mañueco','profesor',3,'d53a3bcbd4852069b8eabdc09cea7f6b76119e36.jpg'),
(52,'jose@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$ZgGQ0vW/l/gcq21/KO/7RedTfu1/ZU4Tfpy1mdJGCWkt2dSj2fI.6','José','Pérez Cambriano','profesor',3,'120d7b849b6cf5897d2c2c8c31af7f5776f57e25.jpg'),
(53,'walter@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$OOx6cBcguY8ltLR89NJRh.Qtqp72M1APAMHH4IU0Zua6wJlluiAVO','Walter','Donovan Yupanky','profesor',3,'f4c9a4458b819ecbfe8829d5ab7a202e5e12e677.jpg'),
(54,'clara@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$8VLephkdOwaGB7a7yAYA1.DtvJwu37wc15TMeAzGBHMlFp1PNPnAS','Clara','Gutiérrez Mira','profesor',3,'e63758981329e99969202e3b7cee1e694f93a2d1.jpg'),
(55,'sara@eag.com','[\"ROLE_PROFESOR\",\"ROLE_ADMIN\"]','$2y$13$cSLKFuyGmUrJv/OwIiykk.0slJzhSwm1vHHPeXuIU.9ZbcFGgu/xq','Sara','Alberti Marizza','admin',3,'438efc2c1de4294ac2e3bf134777ef6069eb8934.jpg'),
(56,'maria@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$/8r.QIUMGYWWr8aXJXCfau4wmx7NCNCMqo250jQFPjGlT.BjabfGi','María','Cordero Acosta','profesor',3,'afd1b2acb3a8c8c5c0ed24b089896c4b6ee3908b.jpg'),
(57,'vega.ferrer@alvarez.es','[\"ROLE_ALUMNO\"]','$2y$13$God9dDDd0jN8pANHweaR0.AQfm3w4rz/p39nAYBDFpmHH0WPHiqzq','Daniel','Rosario Gálvez','alumno',3,'avatar-placeholder.png'),
(58,'javier.coronado@yahoo.es','[\"ROLE_ALUMNO\"]','$2y$13$OEk6NniM8mcZiVcW3yJtSOiLGBzLIucbB5oAxnJIkj0/BAqc7J63G','Noa','Figueroa Negrón','alumno',3,'avatar-placeholder.png'),
(59,'tello.adam@torres.es','[\"ROLE_ALUMNO\"]','$2y$13$1ThREXZhftidvwXR3NBVDePCo.lHG1tfdsOsnnzqL7dMDWM7ui68q','Celia','Maldonado Treviño','alumno',3,'avatar-placeholder.png'),
(60,'uaguirre@estrada.com.es','[\"ROLE_ALUMNO\"]','$2y$13$BLtX/l3Sy55bSNIM5VfDXesj8te7lk6Iy71xdfFKTNkVR9tAnYPY.','Saúl','Ortega Regalado','alumno',3,'avatar-placeholder.png'),
(61,'marc59@hotmail.com','[\"ROLE_ALUMNO\"]','$2y$13$btchZ3ChU1Ujcadu7IWU4uthWlz86VbsfkXHZ3a5BYHeBQxTzcPK.','Guillermo','Baca Heredia','alumno',3,'avatar-placeholder.png'),
(62,'correa.mariacarmen@hotmail.com','[\"ROLE_ALUMNO\"]','$2y$13$AbwRR6McTGXozobYeH9eleBYdKdWjo/S3a5VpSBJJBXYBNC0KCuLS','Rosa María','Partida Cortez','alumno',3,'avatar-placeholder.png'),
(63,'escobar.arnau@hotmail.es','[\"ROLE_ALUMNO\"]','$2y$13$sGQa65iAvDcXYf3oqD48D.0kLg6wq7TT2915CeiFFEKsRwgislD8u','Aurora','Soler Solano','alumno',3,'avatar-placeholder.png'),
(64,'hsedillo@pereira.es','[\"ROLE_ALUMNO\"]','$2y$13$mlZcuTyli1xgjxCamR2LNe5InMngraJjM3YAE9LqwjFRYCJF33zbe','Biel','Colunga Casillas','alumno',3,'avatar-placeholder.png'),
(65,'ainara.montero@castellano.es','[\"ROLE_ALUMNO\"]','$2y$13$9j/m78a7YvBMeL/LYWrpguF2MA.SAZuu5H2mN0BlJexJsw2zzRpDG','Fernando','Domenech Ordóñez','alumno',3,'avatar-placeholder.png'),
(66,'rodrigo08@gmail.com','[\"ROLE_ALUMNO\"]','$2y$13$54Zyude4z5xv1ddZM6i7p.8nk3z3D4EFi/uBHr5nJJBz6Le5XLRhW','Paula','Castellanos Rosas','alumno',3,'avatar-placeholder.png'),
(67,'hnino@munoz.com.es','[\"ROLE_ALUMNO\"]','$2y$13$VKic4BlrmRfh/BBsqW12iurh4iODOGhVMGDICoRrO3mDs3H6xnJbi','Izan','Briseño Villarreal','alumno',3,'avatar-placeholder.png'),
(68,'munguia.ariadna@hispavista.com','[\"ROLE_ALUMNO\"]','$2y$13$kQhkGcigWjkEsYSqDprPtO1ZQJZRravcqkljYaOlYPfsOnujUSkV2','Jorge','Elizondo Castaño','alumno',3,'avatar-placeholder.png'),
(69,'ariadna34@abeyta.es','[\"ROLE_ALUMNO\"]','$2y$13$KvVKTqKjcXVf2wQLZD8v1u/YfzdabNkRiy1emP7sQRHPLiOwevcv.','Helena','Tejada Amaya','alumno',3,'avatar-placeholder.png'),
(70,'plucero@live.com','[\"ROLE_ALUMNO\"]','$2y$13$j8ClxeqluN9PGl6Mpw/7SOnKT0X/MLKUAZmg/oA37oVu051kcsssK','Álvaro','Centeno Santiago','alumno',3,'avatar-placeholder.png'),
(71,'nerea66@hispavista.com','[\"ROLE_ALUMNO\"]','$2y$13$pQ0E17PbWw0EXR90fYW.jORKfmlOYKe4DywAc5hu2sVvEDfiClhbq','Alba','Segura Domínguez','alumno',3,'avatar-placeholder.png'),
(72,'saparicio@roybal.es','[\"ROLE_ALUMNO\"]','$2y$13$U1uMjiUf/gaQ8v4xHDyX0.pyvwtFQA1QoHYCtcFKB95TrY3lQ2MnS','Aaron','Carbonell Betancourt','alumno',3,'avatar-placeholder.png'),
(73,'gallegos.rosamaria@navarro.org','[\"ROLE_ALUMNO\"]','$2y$13$hmxh/0aLjWLJQqAWq.moNOjTHJ/53T3kcIgPgkg23tnlWlRJVrgDm','Ángel','Cotto Ozuna','alumno',3,'avatar-placeholder.png'),
(74,'vergara.gael@renteria.net','[\"ROLE_ALUMNO\"]','$2y$13$/z8G3WSXViQh4PiNLEQoJuVYeRVJYnajG9ex8Tl.HZ0FsnaJU.KQ2','Saúl','Cavazos Gutiérrez','alumno',3,'avatar-placeholder.png'),
(75,'jordi.oliva@pascual.es','[\"ROLE_ALUMNO\"]','$2y$13$7Rvh5NW3eOpPGR2Sl6/CLeXwNclsGv/ZAE/IalqchjqBxxnJ9ke6y','Marina','Lozano Varela','alumno',3,'avatar-placeholder.png'),
(76,'rey.omar@verduzco.com.es','[\"ROLE_ALUMNO\"]','$2y$13$AweRu9/TW0l/KEzzpgOBVO09Qopl3l2684Fi1sMJwKwm5/je7ttCa','Laia','Delarosa Montez','alumno',3,'avatar-placeholder.png'),
(77,'pepe@iestech.com','[\"ROLE_PROFESOR\",\"ROLE_ADMIN\"]','$2y$13$7OivdXwRW2aOHtTiLw96wO8/p7hY4BATQTpAp0Ve/o/BRYAd0G.ni','Theodore','Robert Bundy','admin',4,'f0dc3678d4d52bf22d2ebcdfd9cd28e4f1b99cb6.jpg');
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

-- Dump completed on 2025-12-28  9:56:04
