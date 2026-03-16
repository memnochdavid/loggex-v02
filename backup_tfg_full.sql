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
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencia`
--

LOCK TABLES `asistencia` WRITE;
/*!40000 ALTER TABLE `asistencia` DISABLE KEYS */;
INSERT INTO `asistencia` VALUES
(45,'2026-01-15','F',28,57,'12:30:00','caca caca modificado','2026-02-04 11:01:39','2026-03-08 10:03:25',0,NULL),
(46,'2026-01-16','P',28,61,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(47,'2026-01-16','P',28,58,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(48,'2026-01-16','P',28,59,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(49,'2026-01-16','P',28,60,'13:30:00','','2026-02-04 11:04:22','2026-02-04 11:04:22',0,NULL),
(50,'2026-01-16','J',28,57,'13:30:00','tonto, has justificado','2026-02-04 11:04:22','2026-02-04 11:06:25',0,NULL),
(51,'2026-02-05','P',28,61,'12:30:00','','2026-02-12 11:14:33','2026-02-12 11:14:33',0,NULL),
(52,'2026-02-05','P',28,58,'12:30:00','','2026-02-12 11:14:33','2026-02-12 11:14:33',0,NULL),
(53,'2026-02-05','P',28,59,'12:30:00','','2026-02-12 11:14:33','2026-02-12 11:14:33',0,NULL),
(54,'2026-02-05','P',28,60,'12:30:00','','2026-02-12 11:14:33','2026-02-12 11:14:33',0,NULL),
(55,'2026-02-05','F',28,57,'12:30:00','Djdjshs','2026-02-12 11:14:33','2026-02-12 11:14:33',0,NULL),
(56,'2026-02-05','P',28,61,'13:30:00','','2026-02-12 11:15:33','2026-02-12 11:15:33',0,NULL),
(57,'2026-02-05','P',28,58,'13:30:00','','2026-02-12 11:15:33','2026-02-12 11:15:33',0,NULL),
(58,'2026-02-05','P',28,59,'13:30:00','','2026-02-12 11:15:33','2026-02-12 11:15:33',0,NULL),
(59,'2026-02-05','P',28,60,'13:30:00','','2026-02-12 11:15:33','2026-02-12 11:15:33',0,NULL),
(60,'2026-02-05','F',28,57,'13:30:00','Eres mongolo','2026-02-12 11:15:33','2026-02-12 11:15:33',0,NULL),
(61,'2026-02-12','F',28,61,'12:30:00','','2026-02-12 16:55:20','2026-02-12 21:42:52',0,NULL),
(62,'2026-02-12','F',28,58,'12:30:00','','2026-02-12 16:55:20','2026-02-17 08:44:50',0,NULL),
(63,'2026-02-12','P',28,59,'12:30:00','','2026-02-12 16:55:20','2026-02-12 16:55:20',0,NULL),
(64,'2026-02-12','P',28,60,'12:30:00','','2026-02-12 16:55:20','2026-02-12 16:55:20',0,NULL),
(65,'2026-02-12','F',28,57,'12:30:00','','2026-02-12 16:55:20','2026-02-18 11:21:53',0,NULL),
(66,'2026-02-12','P',28,61,'13:30:00','','2026-02-12 21:41:14','2026-02-12 21:41:14',0,NULL),
(67,'2026-02-12','P',28,58,'13:30:00','','2026-02-12 21:41:14','2026-02-12 21:41:14',0,NULL),
(68,'2026-02-12','P',28,59,'13:30:00','','2026-02-12 21:41:14','2026-02-12 21:41:14',0,NULL),
(69,'2026-02-12','P',28,60,'13:30:00','','2026-02-12 21:41:14','2026-02-12 21:41:14',0,NULL),
(70,'2026-02-12','F',28,57,'13:30:00','','2026-02-12 21:41:14','2026-02-12 21:41:14',0,NULL),
(71,'2026-01-15','P',28,61,'12:30:00','','2026-02-17 08:47:23','2026-02-17 08:47:23',0,NULL),
(72,'2026-01-15','P',28,58,'12:30:00','','2026-02-17 08:47:23','2026-02-17 08:47:23',0,NULL),
(73,'2026-01-15','P',28,59,'12:30:00','','2026-02-17 08:47:23','2026-02-17 08:47:23',0,NULL),
(74,'2026-01-15','P',28,60,'12:30:00','','2026-02-17 08:47:23','2026-02-17 08:47:23',0,NULL),
(75,'2026-03-05','P',28,61,'12:30:00','','2026-03-08 10:02:23','2026-03-08 10:02:23',0,NULL),
(76,'2026-03-05','P',28,58,'12:30:00','','2026-03-08 10:02:23','2026-03-08 10:02:23',0,NULL),
(77,'2026-03-05','P',28,59,'12:30:00','','2026-03-08 10:02:23','2026-03-08 10:02:23',0,NULL),
(78,'2026-03-05','P',28,60,'12:30:00','','2026-03-08 10:02:23','2026-03-08 10:02:23',0,NULL),
(79,'2026-03-05','F',28,57,'12:30:00','','2026-03-08 10:02:23','2026-03-08 10:02:23',0,NULL),
(80,'2026-03-06','P',28,61,'13:30:00','','2026-03-08 10:02:38','2026-03-08 10:02:38',0,NULL),
(81,'2026-03-06','P',28,58,'13:30:00','','2026-03-08 10:02:38','2026-03-08 10:02:38',0,NULL),
(82,'2026-03-06','P',28,59,'13:30:00','','2026-03-08 10:02:38','2026-03-08 10:02:38',0,NULL),
(83,'2026-03-06','P',28,60,'13:30:00','','2026-03-08 10:02:38','2026-03-08 10:02:38',0,NULL),
(84,'2026-03-06','F',28,57,'13:30:00','','2026-03-08 10:02:38','2026-03-08 10:02:38',0,NULL),
(85,'2026-01-22','P',28,61,'12:30:00','','2026-03-08 10:03:30','2026-03-08 10:03:30',0,NULL),
(86,'2026-01-22','P',28,58,'12:30:00','','2026-03-08 10:03:30','2026-03-08 10:03:30',0,NULL),
(87,'2026-01-22','P',28,59,'12:30:00','','2026-03-08 10:03:30','2026-03-08 10:03:30',0,NULL),
(88,'2026-01-22','P',28,60,'12:30:00','','2026-03-08 10:03:30','2026-03-08 10:03:30',0,NULL),
(89,'2026-01-22','F',28,57,'12:30:00','','2026-03-08 10:03:30','2026-03-08 10:03:30',0,NULL),
(90,'2026-01-23','P',28,61,'13:30:00','','2026-03-08 10:03:35','2026-03-08 10:03:35',0,NULL),
(91,'2026-01-23','P',28,58,'13:30:00','','2026-03-08 10:03:35','2026-03-08 10:03:35',0,NULL),
(92,'2026-01-23','P',28,59,'13:30:00','','2026-03-08 10:03:35','2026-03-08 10:03:35',0,NULL),
(93,'2026-01-23','P',28,60,'13:30:00','','2026-03-08 10:03:35','2026-03-08 10:03:35',0,NULL),
(94,'2026-01-23','F',28,57,'13:30:00','','2026-03-08 10:03:35','2026-03-08 10:03:35',0,NULL),
(95,'2026-01-29','P',28,61,'12:30:00','','2026-03-08 10:03:42','2026-03-08 10:03:42',0,NULL),
(96,'2026-01-29','P',28,58,'12:30:00','','2026-03-08 10:03:42','2026-03-08 10:03:42',0,NULL),
(97,'2026-01-29','P',28,59,'12:30:00','','2026-03-08 10:03:42','2026-03-08 10:03:42',0,NULL),
(98,'2026-01-29','P',28,60,'12:30:00','','2026-03-08 10:03:42','2026-03-08 10:03:42',0,NULL),
(99,'2026-01-29','F',28,57,'12:30:00','','2026-03-08 10:03:42','2026-03-08 10:03:42',0,NULL),
(100,'2026-01-30','P',28,61,'13:30:00','','2026-03-08 10:03:47','2026-03-08 10:03:47',0,NULL),
(101,'2026-01-30','P',28,58,'13:30:00','','2026-03-08 10:03:47','2026-03-08 10:03:47',0,NULL),
(102,'2026-01-30','P',28,59,'13:30:00','','2026-03-08 10:03:47','2026-03-08 10:03:47',0,NULL),
(103,'2026-01-30','P',28,60,'13:30:00','','2026-03-08 10:03:47','2026-03-08 10:03:47',0,NULL),
(104,'2026-01-30','F',28,57,'13:30:00','','2026-03-08 10:03:47','2026-03-08 10:03:47',0,NULL),
(105,'2025-12-18','P',28,61,'12:30:00','','2026-03-08 10:03:59','2026-03-08 10:03:59',0,NULL),
(106,'2025-12-18','P',28,58,'12:30:00','','2026-03-08 10:03:59','2026-03-08 10:03:59',0,NULL),
(107,'2025-12-18','P',28,59,'12:30:00','','2026-03-08 10:03:59','2026-03-08 10:03:59',0,NULL),
(108,'2025-12-18','P',28,60,'12:30:00','','2026-03-08 10:03:59','2026-03-08 10:03:59',0,NULL),
(109,'2025-12-18','F',28,57,'12:30:00','','2026-03-08 10:03:59','2026-03-08 10:03:59',0,NULL),
(110,'2025-12-11','P',28,61,'12:30:00','','2026-03-08 10:04:06','2026-03-08 10:04:06',0,NULL),
(111,'2025-12-11','P',28,58,'12:30:00','','2026-03-08 10:04:06','2026-03-08 10:04:06',0,NULL),
(112,'2025-12-11','P',28,59,'12:30:00','','2026-03-08 10:04:06','2026-03-08 10:04:06',0,NULL),
(113,'2025-12-11','P',28,60,'12:30:00','','2026-03-08 10:04:06','2026-03-08 10:04:06',0,NULL),
(114,'2025-12-11','F',28,57,'12:30:00','','2026-03-08 10:04:06','2026-03-08 10:04:06',0,NULL),
(115,'2025-12-12','P',28,61,'13:30:00','','2026-03-08 10:04:11','2026-03-08 10:04:11',0,NULL),
(116,'2025-12-12','P',28,58,'13:30:00','','2026-03-08 10:04:11','2026-03-08 10:04:11',0,NULL),
(117,'2025-12-12','P',28,59,'13:30:00','','2026-03-08 10:04:11','2026-03-08 10:04:11',0,NULL),
(118,'2025-12-12','P',28,60,'13:30:00','','2026-03-08 10:04:11','2026-03-08 10:04:11',0,NULL),
(119,'2025-12-12','F',28,57,'13:30:00','','2026-03-08 10:04:11','2026-03-08 10:04:11',0,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calificacion`
--

LOCK TABLES `calificacion` WRITE;
/*!40000 ALTER TABLE `calificacion` DISABLE KEYS */;
INSERT INTO `calificacion` VALUES
(7,8,'lo has hecho muy bien',7,'2026-02-01 08:05:15',NULL,0,NULL),
(8,5,'vaya puta mierda',8,'2026-02-05 14:01:55','2026-02-05 14:01:55',0,NULL),
(9,8,'Mola',9,'2026-02-18 10:51:14','2026-02-18 10:51:14',0,NULL);
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
-- Table structure for table `comunicado`
--

DROP TABLE IF EXISTS `comunicado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `comunicado` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(255) NOT NULL,
  `contenido` longtext NOT NULL,
  `global` tinyint(4) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `autor_id` int(11) NOT NULL,
  `centro_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_B5F8831014D45BBE` (`autor_id`),
  KEY `IDX_B5F88310298137A7` (`centro_id`),
  CONSTRAINT `FK_B5F8831014D45BBE` FOREIGN KEY (`autor_id`) REFERENCES `usuario` (`id`),
  CONSTRAINT `FK_B5F88310298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comunicado`
--

LOCK TABLES `comunicado` WRITE;
/*!40000 ALTER TABLE `comunicado` DISABLE KEYS */;
INSERT INTO `comunicado` VALUES
(8,'Comunicado de Prueba','Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s.',0,'2026-02-15 12:07:05','2026-02-15 12:07:05',0,NULL,55,3),
(10,'Nuevo comunicado 666','Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 Nuevo comunicado 666 ',0,'2026-02-15 15:02:53','2026-02-15 15:02:53',0,NULL,55,3),
(11,'Comunicado GLOBAL','Me tenéis que obedecer, porque soy el SUPERADMIN.',0,'2026-02-15 15:13:28','2026-02-18 11:58:51',1,'2026-02-18 11:58:51',49,NULL),
(12,'echo \"drop table comunicado\"','chúpamela',0,'2026-02-17 09:41:35','2026-02-17 09:43:41',1,'2026-02-17 09:43:41',55,3),
(13,'Comunicado GLOBAL','Me tenéis que obedecer, porque soy el SUPERADMIN.',1,'2026-02-18 11:59:09','2026-02-18 11:59:09',0,NULL,49,NULL);
/*!40000 ALTER TABLE `comunicado` ENABLE KEYS */;
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
('DoctrineMigrations\\Version20260205050601','2026-02-05 05:10:54',86),
('DoctrineMigrations\\Version20260205100000',NULL,NULL),
('DoctrineMigrations\\Version20260312174017','2026-03-12 17:46:11',80);
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega`
--

LOCK TABLES `entrega` WRITE;
/*!40000 ALTER TABLE `entrega` DISABLE KEYS */;
INSERT INTO `entrega` VALUES
(7,'2025-12-22 16:04:15','asgsdgbsdfb',10,57,'https://drive.google.com/drive/folders/1w7-lVfgAcYjL3phW6RIEjjWXnfluH09t?usp=sharing','2026-02-01 08:05:15',NULL,0,NULL,NULL),
(8,'2026-02-05 13:31:55','fuck you',13,57,'https://www.youtube.com/watch?v=dQw4w9WgXcQ','2026-02-05 13:31:55','2026-02-05 13:31:55',0,NULL,NULL),
(9,'2026-02-18 10:50:18','hecho',15,57,'https://www.youtube.com/watch?v=dQw4w9WgXcQ','2026-02-18 10:50:18','2026-02-18 10:50:18',0,NULL,NULL);
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
  `fecha_inicio` date DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
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
(5,'1º DAW','2025/2026',3,3,1,'1º DAW',NULL,'2026-02-15 11:52:32',0,NULL,'2025-09-01','2026-06-05'),
(6,'2º DAW','2024/2025',3,3,2,'2º DAW',NULL,'2026-02-12 16:52:56',0,NULL,'2025-09-01','2026-03-04'),
(7,'1º DAM','2025/2026',4,3,1,'1º DAM',NULL,'2026-02-12 16:53:09',0,NULL,'2025-09-01','2026-06-05'),
(8,'2º DAM','2024/2025',4,3,2,'2º DAM',NULL,'2026-02-12 16:53:17',0,NULL,'2025-09-01','2026-03-04');
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
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
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
(42,'0GP/41L+3SzAjjnoePE3U21SM3FtbDZQWUc3bDhOS0dXUGdINHRQeVhmTzJ6ZlNaYWtabndwUDQxSFhuZEVwZEI1RlpsUmVGQU85c2xKbjU=','2026-02-10 06:51:09',1,57,50),
(43,'Ne6Y7Vf91ImU41CMYstpiHUvTWsya0JlTnZ2N1hQeFE4aFVma2xuV3BSZ1p1dU1qUVcrYkQ2MTh5TDA9','2026-02-10 06:54:13',1,55,49),
(44,'sTsREUlWkHxUTnRseVyrDFBFWUZvUERPY3lrVVhGbFdvUmdDQkE9PQ==','2026-02-10 15:02:05',1,50,55),
(45,'F3je3qDtJNTFNIx9ZdQXEWcwZ1UvcWEwa2pEUCtnZ21NNEVIb3c9PQ==','2026-02-10 15:02:38',1,49,55),
(46,'T150MlREW0H8xTPj8BMH4klIQWMzZGpXa3VrbitpckNoMWFaM2c9PQ==','2026-02-10 17:49:42',1,55,49),
(47,'oQ7b/HM4SrB/7tt9tsER6E1jNWhlQ3BwM0NkM0F5QjFVV1FtcXJ6OXMxcmNaQTJ0QUozREo5MEN3SU09','2026-02-10 17:50:00',1,55,49),
(48,'nX9/AanonymWActMYrpC3G0zV1hNVzZ3amszN0RxUGtXWXkxbnc9PQ==','2026-02-12 09:41:02',1,57,55),
(49,'GledBZiIe+2zYi6VXhkdQ0V0V2dxUFBycldqQXo0ZUsxbGVJQ1E9PQ==','2026-02-12 09:41:43',1,50,55),
(50,'xIIAVRiMdeEoVsJwobe+IEpzVVRUelhtS3NtS3hjSXhna09tNFJsZ0JvT1dxWE1nMHB2dVV6WnNDcXNFcVZhNVljbnFYZ1E5c0k2dWRvbkM=','2026-02-14 19:08:46',1,57,55),
(51,'j+NxpJp8242V5t+4pydEEzNjaVRpZDRWb053S2hRMUVvb1BES2JxdWV2SXFsWE5mU2VFcFhpZzJQT3c9','2026-02-14 19:08:58',1,55,57),
(52,'ifuuao88cNnWWb2nK8RONzc5RSt0eWI1bnZUWTNOc0loODFRYXc9PQ==','2026-02-18 11:36:29',1,55,49),
(53,'Az+x8Fa4/hvQ+1YUFDyyOWduTVM3YnFqRkV2YkRQY3VsMjlvZmc9PQ==','2026-02-18 11:59:37',1,55,49),
(54,'BGmGVRsvQgpezJq3Z2DtTXQvWkRQcGRyNmZMVFBPZDRlQjV2ZlE9PQ==','2026-03-07 13:04:31',0,55,52);
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
  `events_sidebar_bg_color` varchar(11) NOT NULL,
  `events_sidebar_title_color` varchar(7) NOT NULL,
  `sidebar_accordion_header_bg_color` varchar(7) NOT NULL,
  `sidebar_accordion_header_text_color` varchar(7) NOT NULL,
  `sidebar_accordion_content_bg_color` varchar(7) NOT NULL,
  `sidebar_accordion_content_text_color` varchar(7) NOT NULL,
  `widget_bg_color` varchar(7) NOT NULL,
  `widget_header_bg_color` varchar(7) NOT NULL,
  `widget_header_text_color` varchar(7) NOT NULL,
  `widget_border_color` varchar(7) NOT NULL,
  `widget_item_text_color` varchar(7) NOT NULL,
  `widget_item_hover_bg_color` varchar(7) NOT NULL,
  `widget_icon_color` varchar(7) NOT NULL,
  `view_background_color` varchar(7) NOT NULL,
  `border_radius` varchar(20) NOT NULL,
  `show_lottie` tinyint(4) NOT NULL,
  `enable_draggable_modal` tinyint(4) NOT NULL,
  `sidebar_opacity` int(11) NOT NULL,
  `header_footer_opacity` int(11) NOT NULL,
  `input_bg_color` varchar(7) NOT NULL,
  `input_text_color` varchar(7) NOT NULL,
  `input_border_color` varchar(7) NOT NULL,
  `input_focus_border_color` varchar(7) NOT NULL,
  `input_focus_shadow_color` varchar(7) NOT NULL,
  `animated_background` varchar(50) DEFAULT NULL,
  `elements_opacity` int(11) NOT NULL,
  `elements_blur` int(11) NOT NULL,
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
(1,'#6366f1','#623c9a',3,'#f1f5f9','#94a3b8','#6366f1','#334155','#603e93','#f8fafc','#38316d','#ffffff','#433e70','#ffffff','#ffffff','#f8fafc','#1e293b','2026-02-01 10:25:33','2026-03-16 14:13:29',0,NULL,'#475569','#0f172a','#64748b','#6366f1','#ffffff','#1e293b','#94a3b8','#1e293b','#cbd5e1','#0f172a','#94a3b8','#4338ca','#cbd5e1','#312e81','#cbd5e1','#5d51db','#ffffff','#312e81','#ffffff','#6366f1','#ffffff','#475569','#ffffff','#334155','#ffffff',10,10,10,10,10,10,10,10,'#312e81','#818cf8','#1e1b4b','10px','#221d49','#ffffff','#1e293b','#cbd5e1','#f1f5f9','#1e293b','#ffffff','#0f172a','#cbd5e1','#1e293b','#ef4444','#ffffff','#b91c1c','#ffffff','{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}','#2d394e','#ffffff','#94a3b8','#1e293b','#334155','#312e81','#6366f1','#f1f5f9','#94a3b8','#6366f1','#ffffff','#1e293b','#ffffff','#1e2943','#6366f1','#ffffff','#334155','#f1f5f9','#1e293b','#2d275d','#ffffff','#1e293b','#334155','#f8fafc','#94a3b8','transparent','#f8fafc','#52406d','#ffffff','#221d49','#94a3b8','#232037','#221d49','#e0e7ff','#334155','#cbd5e1','#334155','#818cf8','#001657','0.75rem',1,1,0,30,'#314059','#ffffff','#919191','#676565','#948f8f','waves',40,3),
(4,'#5c94f0','#1e293b',NULL,'#334155','#64748b','#62b767','#5c94f0','#1e293b','#ffffff','#334155','#ffffff','#334155','#ffffff','#ffffff','#ffffff','#608fd2','2026-03-07 15:52:21','2026-03-13 22:39:38',0,NULL,'#5c94f0','#f0f0f0','#8ab7ff','#62b767','#ffffff','#ff0000','#ffffff','#5c94f0','#ffffff','#e6e6e6','#000000','#62b767','#ffffff','#5c94f0','#ffffff','#7dcf82','#ffffff','#81df88','#ffffff','#94bdff','#ffffff','#3884ff','#ffffff','#96aaca','#ffffff',10,10,10,10,10,10,10,10,'#5c94f0','#ffffff','#eef2ff','auto','#5c94f0','#ffffff','#f0f0f0','#46505d','#ffffff','#5c94f0','#ffffff','#e6e6e6','#000000','#c7c7c7','#ff0000','#ffffff','#b30000','#ffffff','{\"words\":[],\"spacing\":\"0.5rem\",\"casing\":\"original\",\"alignment\":\"center\"}','#e0e7ff','#363030','#585e65','#e5f2ff','#f1f5f9','#e0e7ff','#6366f1','#334155','#64748b','#f75e5e','#ffffff','#5c94f0','#ffffff','#f8fafc','#62b767','#ffffff','#828282','#ffffff','#f1f5f9','#77a9f8','#ffffff','#e0fdff','#e0fdff','#000000','#000000','#ededed','#000000','#2b3950','#ffffff','#1e293b','#ffffff','#f5f5f5','#5c94f0','#ffffff','#e2e8f0','#334155','#f1f5f9','#ff0000','#f6f6f4','1.5rem',1,0,100,100,'#ffffff','#334155','#e2e8f0','#6366f1','#e0e7ff',NULL,0,0);
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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
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
(14,'caca de asignatura 2','dgsdfghdfh','2026-02-11 00:41:00',1,28,NULL,'tarea','2026-02-03 23:42:19','2026-02-18 10:38:15',1,'2026-02-18 10:38:15','ejerciciosTipoExamen2-698287db093f7.pdf'),
(15,'Nueva tarea','Cosa de fol','2026-02-18 10:30:00',1,28,NULL,'tarea','2026-02-18 10:48:43','2026-02-18 10:52:25',0,NULL,NULL),
(16,'Fol Tema 3','subo un archivo de prueba','2026-03-16 16:44:00',1,28,NULL,'tarea','2026-03-07 15:44:57','2026-03-07 15:44:57',0,NULL,'pdf-de-prueba-69ac47f9d5f9d.pdf');
/*!40000 ALTER TABLE `tarea` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tema`
--

DROP TABLE IF EXISTS `tema`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tema` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `configuracion` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`configuracion`)),
  `es_predefinido` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `centro_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_61E3A538298137A7` (`centro_id`),
  CONSTRAINT `FK_61E3A538298137A7` FOREIGN KEY (`centro_id`) REFERENCES `centro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=100008 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tema`
--

LOCK TABLES `tema` WRITE;
/*!40000 ALTER TABLE `tema` DISABLE KEYS */;
INSERT INTO `tema` VALUES
(2,'Default','{\"primaryColor\": \"#6366f1\", \"secondaryColor\": \"#64748b\", \"sidebarColor\": \"#1e293b\", \"sidebarActiveColor\": \"#334155\", \"sidebarActiveTextColor\": \"#ffffff\", \"sidebarHoverColor\": \"#334155\", \"sidebarHoverTextColor\": \"#ffffff\", \"sidebarAccordionHeaderBgColor\": \"#1e293b\", \"sidebarAccordionHeaderTextColor\": \"#ffffff\", \"sidebarAccordionContentBgColor\": \"#0f172a\", \"sidebarAccordionContentTextColor\": \"#cbd5e1\", \"textMainColor\": \"#334155\", \"textSecondaryColor\": \"#64748b\", \"specialTextColor\": \"#ffffff\", \"buttonPrimaryColor\": \"#6366f1\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#ffffff\", \"buttonSecondaryTextColor\": \"#334155\", \"headerFooterColor\": \"#1e293b\", \"headerFooterTextColor\": \"#ffffff\", \"scrollbarThumbColor\": \"#cbd5e1\", \"scrollbarTrackColor\": \"#f1f5f9\", \"scrollbarHoverColor\": \"#94a3b8\", \"scrollbarWidth\": \"12px\", \"calendarSelectedBgColor\": \"#6366f1\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#f1f5f9\", \"calendarWeekendTextColor\": \"#64748b\", \"timetableHeaderBgColor\": \"#f1f5f9\", \"timetableHeaderTextColor\": \"#334155\", \"timetableHoursBgColor\": \"#f8fafc\", \"timetableHoursTextColor\": \"#64748b\", \"timetableSelectedHeaderBg\": \"#e0e7ff\", \"timetableSelectedHeaderText\": \"#4338ca\", \"timetableSelectedCellBg\": \"#eef2ff\", \"datatableHeaderBgColor\": \"#f8fafc\", \"datatableHeaderTextColor\": \"#64748b\", \"datatableHeaderHoverBgColor\": \"#f1f5f9\", \"datatableHeaderHoverTextColor\": \"#334155\", \"datatableHeaderActiveBgColor\": \"#e2e8f0\", \"datatableHeaderActiveTextColor\": \"#1e293b\", \"datatablePaginationBgColor\": \"#f8fafc\", \"datatablePaginationTextColor\": \"#64748b\", \"datatablePaginationButtonBgColor\": \"#ffffff\", \"datatablePaginationButtonTextColor\": \"#64748b\", \"datatablePaginationButtonHoverBgColor\": \"#f1f5f9\", \"datatablePaginationButtonHoverTextColor\": \"#334155\", \"datatablePaginationButtonActiveBgColor\": \"#e2e8f0\", \"datatablePaginationButtonActiveTextColor\": \"#1e293b\", \"accordionHeaderBgColor\": \"#f8fafc\", \"accordionHeaderTextColor\": \"#64748b\", \"accordionHeaderActiveBgColor\": \"#f1f5f9\", \"accordionHeaderActiveTextColor\": \"#334155\", \"accordionContentBgColor\": \"#ffffff\", \"accordionContentTextColor\": \"#334155\", \"modalHeaderBgColor\": \"#ffffff\", \"modalHeaderTextColor\": \"#334155\", \"modalBodyBgColor\": \"#ffffff\", \"modalBodyTextColor\": \"#334155\", \"modalFooterBgColor\": \"#f8fafc\", \"modalCloseButtonBgColor\": \"#ffffff\", \"modalCloseButtonTextColor\": \"#64748b\", \"modalCloseButtonHoverBgColor\": \"#f1f5f9\", \"modalCloseButtonHoverTextColor\": \"#334155\", \"userCardBgColor\": \"#1e293b\", \"userCardTextColor\": \"#ffffff\", \"userCardTextSecondaryColor\": \"#cbd5e1\", \"chatSidebarBgColor\": \"#ffffff\", \"chatItemHoverBgColor\": \"#f1f5f9\", \"chatItemActiveBgColor\": \"#e0e7ff\", \"chatItemActiveBorderColor\": \"#6366f1\", \"chatItemTextMainColor\": \"#334155\", \"chatItemTextSecondaryColor\": \"#64748b\", \"chatBadgeBgColor\": \"#6366f1\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#1e293b\", \"chatHeaderTextColor\": \"#ffffff\", \"chatContainerBgColor\": \"#f8fafc\", \"chatInputAreaBgColor\": \"#ffffff\", \"chatBubbleSentBgColor\": \"#6366f1\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#ffffff\", \"chatBubbleReceivedTextColor\": \"#334155\", \"eventCardBgColor\": \"#ffffff\", \"eventCardBorderColor\": \"#e2e8f0\", \"eventCardTitleColor\": \"#334155\", \"eventCardMetaColor\": \"#64748b\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#334155\", \"widgetBgColor\": \"#ffffff\", \"widgetHeaderBgColor\": \"#ffffff\", \"widgetHeaderTextColor\": \"#334155\", \"widgetBorderColor\": \"#e2e8f0\", \"widgetItemTextColor\": \"#334155\", \"widgetItemHoverBgColor\": \"#f1f5f9\", \"widgetIconColor\": \"#6366f1\", \"viewBackgroundColor\": \"#ffffff\"}',1,'2026-02-11 16:22:00','2026-02-11 16:22:00',NULL),
(3,'Rojo','{\"primaryColor\": \"#ef4444\", \"secondaryColor\": \"#7f1d1d\", \"sidebarColor\": \"#7f1d1d\", \"sidebarActiveColor\": \"#991b1b\", \"sidebarActiveTextColor\": \"#ffffff\", \"sidebarHoverColor\": \"#991b1b\", \"sidebarHoverTextColor\": \"#ffffff\", \"sidebarAccordionHeaderBgColor\": \"#7f1d1d\", \"sidebarAccordionHeaderTextColor\": \"#ffffff\", \"sidebarAccordionContentBgColor\": \"#450a0a\", \"sidebarAccordionContentTextColor\": \"#fca5a5\", \"textMainColor\": \"#450a0a\", \"textSecondaryColor\": \"#7f1d1d\", \"specialTextColor\": \"#ffffff\", \"buttonPrimaryColor\": \"#ef4444\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#ffffff\", \"buttonSecondaryTextColor\": \"#7f1d1d\", \"headerFooterColor\": \"#7f1d1d\", \"headerFooterTextColor\": \"#ffffff\", \"scrollbarThumbColor\": \"#fca5a5\", \"scrollbarTrackColor\": \"#fef2f2\", \"scrollbarHoverColor\": \"#f87171\", \"scrollbarWidth\": \"12px\", \"calendarSelectedBgColor\": \"#ef4444\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#fef2f2\", \"calendarWeekendTextColor\": \"#7f1d1d\", \"timetableHeaderBgColor\": \"#fef2f2\", \"timetableHeaderTextColor\": \"#7f1d1d\", \"timetableHoursBgColor\": \"#fff1f2\", \"timetableHoursTextColor\": \"#991b1b\", \"timetableSelectedHeaderBg\": \"#fee2e2\", \"timetableSelectedHeaderText\": \"#b91c1c\", \"timetableSelectedCellBg\": \"#fef2f2\", \"datatableHeaderBgColor\": \"#fef2f2\", \"datatableHeaderTextColor\": \"#7f1d1d\", \"datatableHeaderHoverBgColor\": \"#fee2e2\", \"datatableHeaderHoverTextColor\": \"#450a0a\", \"datatableHeaderActiveBgColor\": \"#fecaca\", \"datatableHeaderActiveTextColor\": \"#450a0a\", \"datatablePaginationBgColor\": \"#fef2f2\", \"datatablePaginationTextColor\": \"#7f1d1d\", \"datatablePaginationButtonBgColor\": \"#ffffff\", \"datatablePaginationButtonTextColor\": \"#7f1d1d\", \"datatablePaginationButtonHoverBgColor\": \"#fee2e2\", \"datatablePaginationButtonHoverTextColor\": \"#450a0a\", \"datatablePaginationButtonActiveBgColor\": \"#fecaca\", \"datatablePaginationButtonActiveTextColor\": \"#450a0a\", \"accordionHeaderBgColor\": \"#fef2f2\", \"accordionHeaderTextColor\": \"#7f1d1d\", \"accordionHeaderActiveBgColor\": \"#fee2e2\", \"accordionHeaderActiveTextColor\": \"#450a0a\", \"accordionContentBgColor\": \"#ffffff\", \"accordionContentTextColor\": \"#450a0a\", \"modalHeaderBgColor\": \"#ffffff\", \"modalHeaderTextColor\": \"#450a0a\", \"modalBodyBgColor\": \"#ffffff\", \"modalBodyTextColor\": \"#450a0a\", \"modalFooterBgColor\": \"#fef2f2\", \"modalCloseButtonBgColor\": \"#ffffff\", \"modalCloseButtonTextColor\": \"#7f1d1d\", \"modalCloseButtonHoverBgColor\": \"#fee2e2\", \"modalCloseButtonHoverTextColor\": \"#450a0a\", \"userCardBgColor\": \"#7f1d1d\", \"userCardTextColor\": \"#ffffff\", \"userCardTextSecondaryColor\": \"#fca5a5\", \"chatSidebarBgColor\": \"#ffffff\", \"chatItemHoverBgColor\": \"#fef2f2\", \"chatItemActiveBgColor\": \"#fee2e2\", \"chatItemActiveBorderColor\": \"#ef4444\", \"chatItemTextMainColor\": \"#450a0a\", \"chatItemTextSecondaryColor\": \"#7f1d1d\", \"chatBadgeBgColor\": \"#ef4444\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#7f1d1d\", \"chatHeaderTextColor\": \"#ffffff\", \"chatContainerBgColor\": \"#fff1f2\", \"chatInputAreaBgColor\": \"#ffffff\", \"chatBubbleSentBgColor\": \"#ef4444\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#ffffff\", \"chatBubbleReceivedTextColor\": \"#450a0a\", \"eventCardBgColor\": \"#ffffff\", \"eventCardBorderColor\": \"#fecaca\", \"eventCardTitleColor\": \"#7f1d1d\", \"eventCardMetaColor\": \"#991b1b\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#7f1d1d\", \"widgetBgColor\": \"#ffffff\", \"widgetHeaderBgColor\": \"#ef4444\", \"widgetHeaderTextColor\": \"#ffffff\", \"widgetBorderColor\": \"#fecaca\", \"widgetItemTextColor\": \"#450a0a\", \"widgetItemHoverBgColor\": \"#fef2f2\", \"widgetIconColor\": \"#ef4444\", \"viewBackgroundColor\": \"#fff5f5\", \"borderRadius\": \"0.5rem\", \"showLottie\": true, \"enableDraggableModal\": true, \"showAnimatedBackground\": false, \"sidebarOpacity\": 100, \"headerFooterOpacity\": 100, \"inputBgColor\": \"#ffffff\", \"inputTextColor\": \"#450a0a\", \"inputBorderColor\": \"#fecaca\", \"inputFocusBorderColor\": \"#ef4444\", \"inputFocusShadowColor\": \"#fee2e2\", \"itemsPerPageUsuarios\": 10, \"itemsPerPageCentros\": 10, \"itemsPerPageCiclos\": 10, \"itemsPerPageGrupos\": 10, \"itemsPerPageModulos\": 10, \"itemsPerPageMatriculas\": 10, \"itemsPerPageImparticiones\": 10, \"itemsPerPageHorarios\": 10}',1,'2026-02-11 16:22:00','2026-03-13 23:14:23',NULL),
(4,'Morado','{\"primaryColor\": \"#8b5cf6\", \"secondaryColor\": \"#5b21b6\", \"sidebarColor\": \"#4c1d95\", \"sidebarActiveColor\": \"#5b21b6\", \"sidebarActiveTextColor\": \"#ffffff\", \"sidebarHoverColor\": \"#5b21b6\", \"sidebarHoverTextColor\": \"#ffffff\", \"sidebarAccordionHeaderBgColor\": \"#4c1d95\", \"sidebarAccordionHeaderTextColor\": \"#ffffff\", \"sidebarAccordionContentBgColor\": \"#2e1065\", \"sidebarAccordionContentTextColor\": \"#c4b5fd\", \"textMainColor\": \"#2e1065\", \"textSecondaryColor\": \"#5b21b6\", \"specialTextColor\": \"#ffffff\", \"buttonPrimaryColor\": \"#8b5cf6\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#ffffff\", \"buttonSecondaryTextColor\": \"#5b21b6\", \"headerFooterColor\": \"#4c1d95\", \"headerFooterTextColor\": \"#ffffff\", \"scrollbarThumbColor\": \"#c4b5fd\", \"scrollbarTrackColor\": \"#f5f3ff\", \"scrollbarHoverColor\": \"#a78bfa\", \"scrollbarWidth\": \"12px\", \"calendarSelectedBgColor\": \"#8b5cf6\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#f5f3ff\", \"calendarWeekendTextColor\": \"#5b21b6\", \"timetableHeaderBgColor\": \"#f5f3ff\", \"timetableHeaderTextColor\": \"#5b21b6\", \"timetableHoursBgColor\": \"#faf5ff\", \"timetableHoursTextColor\": \"#6d28d9\", \"timetableSelectedHeaderBg\": \"#ede9fe\", \"timetableSelectedHeaderText\": \"#7c3aed\", \"timetableSelectedCellBg\": \"#f5f3ff\", \"datatableHeaderBgColor\": \"#f5f3ff\", \"datatableHeaderTextColor\": \"#5b21b6\", \"datatableHeaderHoverBgColor\": \"#ede9fe\", \"datatableHeaderHoverTextColor\": \"#2e1065\", \"datatableHeaderActiveBgColor\": \"#ddd6fe\", \"datatableHeaderActiveTextColor\": \"#2e1065\", \"datatablePaginationBgColor\": \"#f5f3ff\", \"datatablePaginationTextColor\": \"#5b21b6\", \"datatablePaginationButtonBgColor\": \"#ffffff\", \"datatablePaginationButtonTextColor\": \"#5b21b6\", \"datatablePaginationButtonHoverBgColor\": \"#ede9fe\", \"datatablePaginationButtonHoverTextColor\": \"#2e1065\", \"datatablePaginationButtonActiveBgColor\": \"#ddd6fe\", \"datatablePaginationButtonActiveTextColor\": \"#2e1065\", \"accordionHeaderBgColor\": \"#f5f3ff\", \"accordionHeaderTextColor\": \"#5b21b6\", \"accordionHeaderActiveBgColor\": \"#ede9fe\", \"accordionHeaderActiveTextColor\": \"#2e1065\", \"accordionContentBgColor\": \"#ffffff\", \"accordionContentTextColor\": \"#2e1065\", \"modalHeaderBgColor\": \"#ffffff\", \"modalHeaderTextColor\": \"#2e1065\", \"modalBodyBgColor\": \"#ffffff\", \"modalBodyTextColor\": \"#2e1065\", \"modalFooterBgColor\": \"#f5f3ff\", \"modalCloseButtonBgColor\": \"#ffffff\", \"modalCloseButtonTextColor\": \"#5b21b6\", \"modalCloseButtonHoverBgColor\": \"#ede9fe\", \"modalCloseButtonHoverTextColor\": \"#2e1065\", \"userCardBgColor\": \"#4c1d95\", \"userCardTextColor\": \"#ffffff\", \"userCardTextSecondaryColor\": \"#c4b5fd\", \"chatSidebarBgColor\": \"#ffffff\", \"chatItemHoverBgColor\": \"#f5f3ff\", \"chatItemActiveBgColor\": \"#ede9fe\", \"chatItemActiveBorderColor\": \"#8b5cf6\", \"chatItemTextMainColor\": \"#2e1065\", \"chatItemTextSecondaryColor\": \"#5b21b6\", \"chatBadgeBgColor\": \"#8b5cf6\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#4c1d95\", \"chatHeaderTextColor\": \"#ffffff\", \"chatContainerBgColor\": \"#faf5ff\", \"chatInputAreaBgColor\": \"#ffffff\", \"chatBubbleSentBgColor\": \"#8b5cf6\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#ffffff\", \"chatBubbleReceivedTextColor\": \"#2e1065\", \"eventCardBgColor\": \"#ffffff\", \"eventCardBorderColor\": \"#ddd6fe\", \"eventCardTitleColor\": \"#4c1d95\", \"eventCardMetaColor\": \"#5b21b6\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#4c1d95\", \"widgetBgColor\": \"#ffffff\", \"widgetHeaderBgColor\": \"#8b5cf6\", \"widgetHeaderTextColor\": \"#ffffff\", \"widgetBorderColor\": \"#ddd6fe\", \"widgetItemTextColor\": \"#2e1065\", \"widgetItemHoverBgColor\": \"#f5f3ff\", \"widgetIconColor\": \"#8b5cf6\", \"viewBackgroundColor\": \"#faf5ff\", \"borderRadius\": \"0.5rem\", \"showLottie\": true, \"enableDraggableModal\": true, \"showAnimatedBackground\": false, \"sidebarOpacity\": 100, \"headerFooterOpacity\": 100, \"inputBgColor\": \"#ffffff\", \"inputTextColor\": \"#2e1065\", \"inputBorderColor\": \"#ddd6fe\", \"inputFocusBorderColor\": \"#8b5cf6\", \"inputFocusShadowColor\": \"#ede9fe\", \"itemsPerPageUsuarios\": 10, \"itemsPerPageCentros\": 10, \"itemsPerPageCiclos\": 10, \"itemsPerPageGrupos\": 10, \"itemsPerPageModulos\": 10, \"itemsPerPageMatriculas\": 10, \"itemsPerPageImparticiones\": 10, \"itemsPerPageHorarios\": 10}',1,'2026-02-11 16:22:00','2026-03-13 23:14:23',NULL),
(5,'Azul','{\"primaryColor\": \"#3b82f6\", \"secondaryColor\": \"#1e3a8a\", \"sidebarColor\": \"#172554\", \"sidebarActiveColor\": \"#1e3a8a\", \"sidebarActiveTextColor\": \"#ffffff\", \"sidebarHoverColor\": \"#1e3a8a\", \"sidebarHoverTextColor\": \"#ffffff\", \"sidebarAccordionHeaderBgColor\": \"#172554\", \"sidebarAccordionHeaderTextColor\": \"#ffffff\", \"sidebarAccordionContentBgColor\": \"#1e3a8a\", \"sidebarAccordionContentTextColor\": \"#93c5fd\", \"textMainColor\": \"#172554\", \"textSecondaryColor\": \"#1e40af\", \"specialTextColor\": \"#ffffff\", \"buttonPrimaryColor\": \"#3b82f6\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#ffffff\", \"buttonSecondaryTextColor\": \"#1e3a8a\", \"headerFooterColor\": \"#172554\", \"headerFooterTextColor\": \"#ffffff\", \"scrollbarThumbColor\": \"#93c5fd\", \"scrollbarTrackColor\": \"#eff6ff\", \"scrollbarHoverColor\": \"#60a5fa\", \"scrollbarWidth\": \"12px\", \"calendarSelectedBgColor\": \"#3b82f6\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#eff6ff\", \"calendarWeekendTextColor\": \"#1e3a8a\", \"timetableHeaderBgColor\": \"#eff6ff\", \"timetableHeaderTextColor\": \"#1e3a8a\", \"timetableHoursBgColor\": \"#f0f9ff\", \"timetableHoursTextColor\": \"#1d4ed8\", \"timetableSelectedHeaderBg\": \"#dbeafe\", \"timetableSelectedHeaderText\": \"#2563eb\", \"timetableSelectedCellBg\": \"#eff6ff\", \"datatableHeaderBgColor\": \"#eff6ff\", \"datatableHeaderTextColor\": \"#1e3a8a\", \"datatableHeaderHoverBgColor\": \"#dbeafe\", \"datatableHeaderHoverTextColor\": \"#172554\", \"datatableHeaderActiveBgColor\": \"#bfdbfe\", \"datatableHeaderActiveTextColor\": \"#172554\", \"datatablePaginationBgColor\": \"#eff6ff\", \"datatablePaginationTextColor\": \"#1e3a8a\", \"datatablePaginationButtonBgColor\": \"#ffffff\", \"datatablePaginationButtonTextColor\": \"#1e3a8a\", \"datatablePaginationButtonHoverBgColor\": \"#dbeafe\", \"datatablePaginationButtonHoverTextColor\": \"#172554\", \"datatablePaginationButtonActiveBgColor\": \"#bfdbfe\", \"datatablePaginationButtonActiveTextColor\": \"#172554\", \"accordionHeaderBgColor\": \"#eff6ff\", \"accordionHeaderTextColor\": \"#1e3a8a\", \"accordionHeaderActiveBgColor\": \"#dbeafe\", \"accordionHeaderActiveTextColor\": \"#172554\", \"accordionContentBgColor\": \"#ffffff\", \"accordionContentTextColor\": \"#172554\", \"modalHeaderBgColor\": \"#ffffff\", \"modalHeaderTextColor\": \"#172554\", \"modalBodyBgColor\": \"#ffffff\", \"modalBodyTextColor\": \"#172554\", \"modalFooterBgColor\": \"#eff6ff\", \"modalCloseButtonBgColor\": \"#ffffff\", \"modalCloseButtonTextColor\": \"#1e3a8a\", \"modalCloseButtonHoverBgColor\": \"#dbeafe\", \"modalCloseButtonHoverTextColor\": \"#172554\", \"userCardBgColor\": \"#172554\", \"userCardTextColor\": \"#ffffff\", \"userCardTextSecondaryColor\": \"#93c5fd\", \"chatSidebarBgColor\": \"#ffffff\", \"chatItemHoverBgColor\": \"#eff6ff\", \"chatItemActiveBgColor\": \"#dbeafe\", \"chatItemActiveBorderColor\": \"#3b82f6\", \"chatItemTextMainColor\": \"#172554\", \"chatItemTextSecondaryColor\": \"#1e3a8a\", \"chatBadgeBgColor\": \"#3b82f6\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#172554\", \"chatHeaderTextColor\": \"#ffffff\", \"chatContainerBgColor\": \"#f0f9ff\", \"chatInputAreaBgColor\": \"#ffffff\", \"chatBubbleSentBgColor\": \"#3b82f6\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#ffffff\", \"chatBubbleReceivedTextColor\": \"#172554\", \"eventCardBgColor\": \"#ffffff\", \"eventCardBorderColor\": \"#bfdbfe\", \"eventCardTitleColor\": \"#1e3a8a\", \"eventCardMetaColor\": \"#1e40af\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#1e3a8a\", \"widgetBgColor\": \"#ffffff\", \"widgetHeaderBgColor\": \"#3b82f6\", \"widgetHeaderTextColor\": \"#ffffff\", \"widgetBorderColor\": \"#bfdbfe\", \"widgetItemTextColor\": \"#172554\", \"widgetItemHoverBgColor\": \"#eff6ff\", \"widgetIconColor\": \"#3b82f6\", \"viewBackgroundColor\": \"#eff6ff\", \"borderRadius\": \"0.5rem\", \"showLottie\": true, \"enableDraggableModal\": true, \"showAnimatedBackground\": false, \"sidebarOpacity\": 100, \"headerFooterOpacity\": 100, \"inputBgColor\": \"#ffffff\", \"inputTextColor\": \"#172554\", \"inputBorderColor\": \"#bfdbfe\", \"inputFocusBorderColor\": \"#3b82f6\", \"inputFocusShadowColor\": \"#dbeafe\", \"itemsPerPageUsuarios\": 10, \"itemsPerPageCentros\": 10, \"itemsPerPageCiclos\": 10, \"itemsPerPageGrupos\": 10, \"itemsPerPageModulos\": 10, \"itemsPerPageMatriculas\": 10, \"itemsPerPageImparticiones\": 10, \"itemsPerPageHorarios\": 10}',1,'2026-02-11 16:22:00','2026-03-13 23:14:23',NULL),
(6,'Verde','{\"primaryColor\": \"#10b981\", \"secondaryColor\": \"#064e3b\", \"sidebarColor\": \"#064e3b\", \"sidebarActiveColor\": \"#065f46\", \"sidebarActiveTextColor\": \"#ffffff\", \"sidebarHoverColor\": \"#065f46\", \"sidebarHoverTextColor\": \"#ffffff\", \"sidebarAccordionHeaderBgColor\": \"#064e3b\", \"sidebarAccordionHeaderTextColor\": \"#ffffff\", \"sidebarAccordionContentBgColor\": \"#022c22\", \"sidebarAccordionContentTextColor\": \"#6ee7b7\", \"textMainColor\": \"#022c22\", \"textSecondaryColor\": \"#065f46\", \"specialTextColor\": \"#ffffff\", \"buttonPrimaryColor\": \"#10b981\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#ffffff\", \"buttonSecondaryTextColor\": \"#064e3b\", \"headerFooterColor\": \"#064e3b\", \"headerFooterTextColor\": \"#ffffff\", \"scrollbarThumbColor\": \"#6ee7b7\", \"scrollbarTrackColor\": \"#ecfdf5\", \"scrollbarHoverColor\": \"#34d399\", \"scrollbarWidth\": \"12px\", \"calendarSelectedBgColor\": \"#10b981\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#ecfdf5\", \"calendarWeekendTextColor\": \"#064e3b\", \"timetableHeaderBgColor\": \"#ecfdf5\", \"timetableHeaderTextColor\": \"#064e3b\", \"timetableHoursBgColor\": \"#f0fdf4\", \"timetableHoursTextColor\": \"#047857\", \"timetableSelectedHeaderBg\": \"#d1fae5\", \"timetableSelectedHeaderText\": \"#059669\", \"timetableSelectedCellBg\": \"#ecfdf5\", \"datatableHeaderBgColor\": \"#ecfdf5\", \"datatableHeaderTextColor\": \"#064e3b\", \"datatableHeaderHoverBgColor\": \"#d1fae5\", \"datatableHeaderHoverTextColor\": \"#022c22\", \"datatableHeaderActiveBgColor\": \"#a7f3d0\", \"datatableHeaderActiveTextColor\": \"#022c22\", \"datatablePaginationBgColor\": \"#ecfdf5\", \"datatablePaginationTextColor\": \"#064e3b\", \"datatablePaginationButtonBgColor\": \"#ffffff\", \"datatablePaginationButtonTextColor\": \"#064e3b\", \"datatablePaginationButtonHoverBgColor\": \"#d1fae5\", \"datatablePaginationButtonHoverTextColor\": \"#022c22\", \"datatablePaginationButtonActiveBgColor\": \"#a7f3d0\", \"datatablePaginationButtonActiveTextColor\": \"#022c22\", \"accordionHeaderBgColor\": \"#ecfdf5\", \"accordionHeaderTextColor\": \"#064e3b\", \"accordionHeaderActiveBgColor\": \"#d1fae5\", \"accordionHeaderActiveTextColor\": \"#022c22\", \"accordionContentBgColor\": \"#ffffff\", \"accordionContentTextColor\": \"#022c22\", \"modalHeaderBgColor\": \"#ffffff\", \"modalHeaderTextColor\": \"#022c22\", \"modalBodyBgColor\": \"#ffffff\", \"modalBodyTextColor\": \"#022c22\", \"modalFooterBgColor\": \"#ecfdf5\", \"modalCloseButtonBgColor\": \"#ffffff\", \"modalCloseButtonTextColor\": \"#064e3b\", \"modalCloseButtonHoverBgColor\": \"#d1fae5\", \"modalCloseButtonHoverTextColor\": \"#022c22\", \"userCardBgColor\": \"#064e3b\", \"userCardTextColor\": \"#ffffff\", \"userCardTextSecondaryColor\": \"#6ee7b7\", \"chatSidebarBgColor\": \"#ffffff\", \"chatItemHoverBgColor\": \"#ecfdf5\", \"chatItemActiveBgColor\": \"#d1fae5\", \"chatItemActiveBorderColor\": \"#10b981\", \"chatItemTextMainColor\": \"#022c22\", \"chatItemTextSecondaryColor\": \"#064e3b\", \"chatBadgeBgColor\": \"#10b981\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#064e3b\", \"chatHeaderTextColor\": \"#ffffff\", \"chatContainerBgColor\": \"#f0fdf4\", \"chatInputAreaBgColor\": \"#ffffff\", \"chatBubbleSentBgColor\": \"#10b981\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#ffffff\", \"chatBubbleReceivedTextColor\": \"#022c22\", \"eventCardBgColor\": \"#ffffff\", \"eventCardBorderColor\": \"#a7f3d0\", \"eventCardTitleColor\": \"#064e3b\", \"eventCardMetaColor\": \"#065f46\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#064e3b\", \"widgetBgColor\": \"#ffffff\", \"widgetHeaderBgColor\": \"#10b981\", \"widgetHeaderTextColor\": \"#ffffff\", \"widgetBorderColor\": \"#a7f3d0\", \"widgetItemTextColor\": \"#022c22\", \"widgetItemHoverBgColor\": \"#ecfdf5\", \"widgetIconColor\": \"#10b981\", \"viewBackgroundColor\": \"#f0fdf4\", \"borderRadius\": \"0.5rem\", \"showLottie\": true, \"enableDraggableModal\": true, \"showAnimatedBackground\": false, \"sidebarOpacity\": 100, \"headerFooterOpacity\": 100, \"inputBgColor\": \"#ffffff\", \"inputTextColor\": \"#022c22\", \"inputBorderColor\": \"#a7f3d0\", \"inputFocusBorderColor\": \"#10b981\", \"inputFocusShadowColor\": \"#d1fae5\", \"itemsPerPageUsuarios\": 10, \"itemsPerPageCentros\": 10, \"itemsPerPageCiclos\": 10, \"itemsPerPageGrupos\": 10, \"itemsPerPageModulos\": 10, \"itemsPerPageMatriculas\": 10, \"itemsPerPageImparticiones\": 10, \"itemsPerPageHorarios\": 10}',1,'2026-02-11 16:22:00','2026-03-13 23:14:23',NULL),
(100002,'Tema XP','{\"primaryColor\":\"#5c94f0\",\"secondaryColor\":\"#608fd2\",\"viewBackgroundColor\":\"#f6f6f4\",\"borderRadius\":\"1.5rem\",\"showLottie\":true,\"enableDraggableModal\":false,\"sidebarColor\":\"#1e293b\",\"sidebarActiveColor\":\"#334155\",\"sidebarActiveTextColor\":\"#ffffff\",\"sidebarHoverColor\":\"#334155\",\"sidebarHoverTextColor\":\"#ffffff\",\"sidebarAccordionHeaderBgColor\":\"#2b3950\",\"sidebarAccordionHeaderTextColor\":\"#ffffff\",\"sidebarAccordionContentBgColor\":\"#1e293b\",\"sidebarAccordionContentTextColor\":\"#ffffff\",\"textMainColor\":\"#334155\",\"textSecondaryColor\":\"#64748b\",\"specialTextColor\":\"#ffffff\",\"buttonPrimaryColor\":\"#62b767\",\"buttonPrimaryTextColor\":\"#ffffff\",\"buttonSecondaryColor\":\"#5c94f0\",\"buttonSecondaryTextColor\":\"#ffffff\",\"headerFooterColor\":\"#1e293b\",\"headerFooterTextColor\":\"#ffffff\",\"scrollbarThumbColor\":\"#5c94f0\",\"scrollbarTrackColor\":\"#f0f0f0\",\"scrollbarHoverColor\":\"#8ab7ff\",\"scrollbarWidth\":\"auto\",\"calendarSelectedBgColor\":\"#62b767\",\"calendarSelectedTextColor\":\"#ffffff\",\"calendarWeekendBgColor\":\"#ff0000\",\"calendarWeekendTextColor\":\"#ffffff\",\"timetableHeaderBgColor\":\"#5c94f0\",\"timetableHeaderTextColor\":\"#ffffff\",\"timetableHoursBgColor\":\"#e6e6e6\",\"timetableHoursTextColor\":\"#000000\",\"timetableSelectedHeaderBg\":\"#5c94f0\",\"timetableSelectedHeaderText\":\"#ffffff\",\"timetableSelectedCellBg\":\"#eef2ff\",\"datatableHeaderBgColor\":\"#62b767\",\"datatableHeaderTextColor\":\"#ffffff\",\"datatableHeaderHoverBgColor\":\"#7dcf82\",\"datatableHeaderHoverTextColor\":\"#ffffff\",\"datatableHeaderActiveBgColor\":\"#81df88\",\"datatableHeaderActiveTextColor\":\"#ffffff\",\"datatablePaginationBgColor\":\"#5c94f0\",\"datatablePaginationTextColor\":\"#ffffff\",\"datatablePaginationButtonBgColor\":\"#94bdff\",\"datatablePaginationButtonTextColor\":\"#ffffff\",\"datatablePaginationButtonHoverBgColor\":\"#3884ff\",\"datatablePaginationButtonHoverTextColor\":\"#ffffff\",\"datatablePaginationButtonActiveBgColor\":\"#96aaca\",\"datatablePaginationButtonActiveTextColor\":\"#ffffff\",\"accordionHeaderBgColor\":\"#5c94f0\",\"accordionHeaderTextColor\":\"#ffffff\",\"accordionHeaderActiveBgColor\":\"#77a9f8\",\"accordionHeaderActiveTextColor\":\"#ffffff\",\"accordionContentBgColor\":\"#f0f0f0\",\"accordionContentTextColor\":\"#46505d\",\"modalHeaderBgColor\":\"#5c94f0\",\"modalHeaderTextColor\":\"#ffffff\",\"modalBodyBgColor\":\"#e6e6e6\",\"modalBodyTextColor\":\"#000000\",\"modalFooterBgColor\":\"#c7c7c7\",\"modalCloseButtonBgColor\":\"#ff0000\",\"modalCloseButtonTextColor\":\"#ffffff\",\"modalCloseButtonHoverBgColor\":\"#b30000\",\"modalCloseButtonHoverTextColor\":\"#ffffff\",\"userCardBgColor\":\"#e0e7ff\",\"userCardTextColor\":\"#363030\",\"userCardTextSecondaryColor\":\"#585e65\",\"chatSidebarBgColor\":\"#e5f2ff\",\"chatItemHoverBgColor\":\"#f1f5f9\",\"chatItemActiveBgColor\":\"#e0e7ff\",\"chatItemActiveBorderColor\":\"#6366f1\",\"chatItemTextMainColor\":\"#334155\",\"chatItemTextSecondaryColor\":\"#64748b\",\"chatBadgeBgColor\":\"#f75e5e\",\"chatBadgeTextColor\":\"#ffffff\",\"chatHeaderBgColor\":\"#5c94f0\",\"chatHeaderTextColor\":\"#ffffff\",\"chatContainerBgColor\":\"#f8fafc\",\"chatInputAreaBgColor\":\"#f1f5f9\",\"chatBubbleSentBgColor\":\"#62b767\",\"chatBubbleSentTextColor\":\"#ffffff\",\"chatBubbleReceivedBgColor\":\"#828282\",\"chatBubbleReceivedTextColor\":\"#ffffff\",\"eventCardBgColor\":\"#e0fdff\",\"eventCardBorderColor\":\"#e0fdff\",\"eventCardTitleColor\":\"#000000\",\"eventCardMetaColor\":\"#000000\",\"eventsSidebarBgColor\":\"#ededed\",\"eventsSidebarTitleColor\":\"#000000\",\"widgetBgColor\":\"#f5f5f5\",\"widgetHeaderBgColor\":\"#5c94f0\",\"widgetHeaderTextColor\":\"#ffffff\",\"widgetBorderColor\":\"#e2e8f0\",\"widgetItemTextColor\":\"#334155\",\"widgetItemHoverBgColor\":\"#f1f5f9\",\"widgetIconColor\":\"#ff0000\",\"itemsPerPageUsuarios\":10,\"itemsPerPageCentros\":10,\"itemsPerPageCiclos\":10,\"itemsPerPageGrupos\":10,\"itemsPerPageModulos\":10,\"itemsPerPageMatriculas\":10,\"itemsPerPageImparticiones\":10,\"itemsPerPageHorarios\":10,\"nameTitleConfig\":{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}}',0,'2026-03-08 09:56:42','2026-03-08 09:56:42',3),
(100005,'Morado Future','{\"primaryColor\":\"#6366f1\",\"secondaryColor\":\"#1e293b\",\"viewBackgroundColor\":\"#30234d\",\"borderRadius\":\"0.75rem\",\"showLottie\":true,\"enableDraggableModal\":true,\"showAnimatedBackground\":true,\"sidebarColor\":\"#623c9a\",\"sidebarActiveColor\":\"#38316d\",\"sidebarActiveTextColor\":\"#ffffff\",\"sidebarHoverColor\":\"#433e70\",\"sidebarHoverTextColor\":\"#ffffff\",\"sidebarOpacity\":0,\"sidebarAccordionHeaderBgColor\":\"#52406d\",\"sidebarAccordionHeaderTextColor\":\"#ffffff\",\"sidebarAccordionContentBgColor\":\"#221d49\",\"sidebarAccordionContentTextColor\":\"#94a3b8\",\"textMainColor\":\"#f1f5f9\",\"textSecondaryColor\":\"#94a3b8\",\"specialTextColor\":\"#f1f5f9\",\"buttonPrimaryColor\":\"#6366f1\",\"buttonPrimaryTextColor\":\"#ffffff\",\"buttonSecondaryColor\":\"#334155\",\"buttonSecondaryTextColor\":\"#f8fafc\",\"headerFooterColor\":\"#603e93\",\"headerFooterTextColor\":\"#f8fafc\",\"headerFooterOpacity\":25,\"scrollbarThumbColor\":\"#475569\",\"scrollbarTrackColor\":\"#0f172a\",\"scrollbarHoverColor\":\"#64748b\",\"scrollbarWidth\":\"10px\",\"calendarSelectedBgColor\":\"#6366f1\",\"calendarSelectedTextColor\":\"#ffffff\",\"calendarWeekendBgColor\":\"#1e293b\",\"calendarWeekendTextColor\":\"#94a3b8\",\"timetableHeaderBgColor\":\"#1e293b\",\"timetableHeaderTextColor\":\"#cbd5e1\",\"timetableHoursBgColor\":\"#0f172a\",\"timetableHoursTextColor\":\"#94a3b8\",\"timetableSelectedHeaderBg\":\"#312e81\",\"timetableSelectedHeaderText\":\"#818cf8\",\"timetableSelectedCellBg\":\"#1e1b4b\",\"datatableHeaderBgColor\":\"#4338ca\",\"datatableHeaderTextColor\":\"#cbd5e1\",\"datatableHeaderHoverBgColor\":\"#5d51db\",\"datatableHeaderHoverTextColor\":\"#ffffff\",\"datatableHeaderActiveBgColor\":\"#312e81\",\"datatableHeaderActiveTextColor\":\"#ffffff\",\"datatablePaginationBgColor\":\"#312e81\",\"datatablePaginationTextColor\":\"#cbd5e1\",\"datatablePaginationButtonBgColor\":\"#6366f1\",\"datatablePaginationButtonTextColor\":\"#ffffff\",\"datatablePaginationButtonHoverBgColor\":\"#475569\",\"datatablePaginationButtonHoverTextColor\":\"#ffffff\",\"datatablePaginationButtonActiveBgColor\":\"#334155\",\"datatablePaginationButtonActiveTextColor\":\"#ffffff\",\"accordionHeaderBgColor\":\"#312e81\",\"accordionHeaderTextColor\":\"#ffffff\",\"accordionHeaderActiveBgColor\":\"#4338ca\",\"accordionHeaderActiveTextColor\":\"#ffffff\",\"accordionContentBgColor\":\"#1e293b\",\"accordionContentTextColor\":\"#cbd5e1\",\"modalHeaderBgColor\":\"#1e293b\",\"modalHeaderTextColor\":\"#ffffff\",\"modalBodyBgColor\":\"#0f172a\",\"modalBodyTextColor\":\"#cbd5e1\",\"modalFooterBgColor\":\"#1e293b\",\"modalCloseButtonBgColor\":\"#ef4444\",\"modalCloseButtonTextColor\":\"#ffffff\",\"modalCloseButtonHoverBgColor\":\"#b91c1c\",\"modalCloseButtonHoverTextColor\":\"#ffffff\",\"userCardBgColor\":\"#2d394e\",\"userCardTextColor\":\"#ffffff\",\"userCardTextSecondaryColor\":\"#94a3b8\",\"chatSidebarBgColor\":\"#1e293b\",\"chatItemHoverBgColor\":\"#334155\",\"chatItemActiveBgColor\":\"#312e81\",\"chatItemActiveBorderColor\":\"#6366f1\",\"chatItemTextMainColor\":\"#f1f5f9\",\"chatItemTextSecondaryColor\":\"#94a3b8\",\"chatBadgeBgColor\":\"#6366f1\",\"chatBadgeTextColor\":\"#ffffff\",\"chatHeaderBgColor\":\"#1e293b\",\"chatHeaderTextColor\":\"#ffffff\",\"chatContainerBgColor\":\"#1e2943\",\"chatInputAreaBgColor\":\"#1e293b\",\"chatBubbleSentBgColor\":\"#6366f1\",\"chatBubbleSentTextColor\":\"#ffffff\",\"chatBubbleReceivedBgColor\":\"#334155\",\"chatBubbleReceivedTextColor\":\"#f1f5f9\",\"inputBgColor\":\"#314059\",\"inputTextColor\":\"#ffffff\",\"inputBorderColor\":\"#919191\",\"inputFocusBorderColor\":\"#676565\",\"inputFocusShadowColor\":\"#948f8f\",\"eventCardBgColor\":\"#1e293b\",\"eventCardBorderColor\":\"#334155\",\"eventCardTitleColor\":\"#f8fafc\",\"eventCardMetaColor\":\"#94a3b8\",\"eventsSidebarBgColor\":\"transparent\",\"eventsSidebarTitleColor\":\"#f8fafc\",\"widgetBgColor\":\"#232037\",\"widgetHeaderBgColor\":\"#221d49\",\"widgetHeaderTextColor\":\"#e0e7ff\",\"widgetBorderColor\":\"#334155\",\"widgetItemTextColor\":\"#cbd5e1\",\"widgetItemHoverBgColor\":\"#334155\",\"widgetIconColor\":\"#818cf8\",\"itemsPerPageUsuarios\":10,\"itemsPerPageCentros\":10,\"itemsPerPageCiclos\":10,\"itemsPerPageGrupos\":10,\"itemsPerPageModulos\":10,\"itemsPerPageMatriculas\":10,\"itemsPerPageImparticiones\":10,\"itemsPerPageHorarios\":10,\"nameTitleConfig\":{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}}',0,'2026-03-13 23:06:45','2026-03-13 23:06:45',3),
(100006,'Terra Future','{\"primaryColor\": \"#d4845a\", \"secondaryColor\": \"#1a1614\", \"viewBackgroundColor\": \"#201a17\", \"borderRadius\": \"0.625rem\", \"showLottie\": true, \"enableDraggableModal\": true, \"showAnimatedBackground\": true, \"sidebarColor\": \"#2a2220\", \"sidebarActiveColor\": \"#3d2e28\", \"sidebarActiveTextColor\": \"#f0c8a8\", \"sidebarHoverColor\": \"#352a25\", \"sidebarHoverTextColor\": \"#f5dcc8\", \"sidebarOpacity\": 0, \"sidebarAccordionHeaderBgColor\": \"#3a2d27\", \"sidebarAccordionHeaderTextColor\": \"#f0c8a8\", \"sidebarAccordionContentBgColor\": \"#1e1815\", \"sidebarAccordionContentTextColor\": \"#a89080\", \"textMainColor\": \"#ede0d4\", \"textSecondaryColor\": \"#a89080\", \"specialTextColor\": \"#f5dcc8\", \"buttonPrimaryColor\": \"#d4845a\", \"buttonPrimaryTextColor\": \"#ffffff\", \"buttonSecondaryColor\": \"#352a25\", \"buttonSecondaryTextColor\": \"#ede0d4\", \"headerFooterColor\": \"#2a2220\", \"headerFooterTextColor\": \"#f5dcc8\", \"headerFooterOpacity\": 20, \"scrollbarThumbColor\": \"#5a4840\", \"scrollbarTrackColor\": \"#151210\", \"scrollbarHoverColor\": \"#7a6458\", \"scrollbarWidth\": \"8px\", \"calendarSelectedBgColor\": \"#d4845a\", \"calendarSelectedTextColor\": \"#ffffff\", \"calendarWeekendBgColor\": \"#1e1815\", \"calendarWeekendTextColor\": \"#a89080\", \"timetableHeaderBgColor\": \"#1e1815\", \"timetableHeaderTextColor\": \"#c4a890\", \"timetableHoursBgColor\": \"#151210\", \"timetableHoursTextColor\": \"#a89080\", \"timetableSelectedHeaderBg\": \"#3d2e28\", \"timetableSelectedHeaderText\": \"#f0c8a8\", \"timetableSelectedCellBg\": \"#2a1f1a\", \"datatableHeaderBgColor\": \"#3a2d27\", \"datatableHeaderTextColor\": \"#c4a890\", \"datatableHeaderHoverBgColor\": \"#4a3830\", \"datatableHeaderHoverTextColor\": \"#f5dcc8\", \"datatableHeaderActiveBgColor\": \"#2a2018\", \"datatableHeaderActiveTextColor\": \"#f0c8a8\", \"datatablePaginationBgColor\": \"#2a2018\", \"datatablePaginationTextColor\": \"#c4a890\", \"datatablePaginationButtonBgColor\": \"#d4845a\", \"datatablePaginationButtonTextColor\": \"#ffffff\", \"datatablePaginationButtonHoverBgColor\": \"#4a3830\", \"datatablePaginationButtonHoverTextColor\": \"#f5dcc8\", \"datatablePaginationButtonActiveBgColor\": \"#352a25\", \"datatablePaginationButtonActiveTextColor\": \"#f0c8a8\", \"accordionHeaderBgColor\": \"#3a2d27\", \"accordionHeaderTextColor\": \"#f0c8a8\", \"accordionHeaderActiveBgColor\": \"#4a3830\", \"accordionHeaderActiveTextColor\": \"#f5dcc8\", \"accordionContentBgColor\": \"#1e1815\", \"accordionContentTextColor\": \"#c4a890\", \"modalHeaderBgColor\": \"#2a2220\", \"modalHeaderTextColor\": \"#f5dcc8\", \"modalBodyBgColor\": \"#201a17\", \"modalBodyTextColor\": \"#ede0d4\", \"modalFooterBgColor\": \"#2a2220\", \"modalCloseButtonBgColor\": \"#c0392b\", \"modalCloseButtonTextColor\": \"#ffffff\", \"modalCloseButtonHoverBgColor\": \"#962d22\", \"modalCloseButtonHoverTextColor\": \"#ffffff\", \"userCardBgColor\": \"#2a2220\", \"userCardTextColor\": \"#f5dcc8\", \"userCardTextSecondaryColor\": \"#a89080\", \"chatSidebarBgColor\": \"#1e1815\", \"chatItemHoverBgColor\": \"#352a25\", \"chatItemActiveBgColor\": \"#3d2e28\", \"chatItemActiveBorderColor\": \"#d4845a\", \"chatItemTextMainColor\": \"#ede0d4\", \"chatItemTextSecondaryColor\": \"#a89080\", \"chatBadgeBgColor\": \"#d4845a\", \"chatBadgeTextColor\": \"#ffffff\", \"chatHeaderBgColor\": \"#2a2220\", \"chatHeaderTextColor\": \"#f5dcc8\", \"chatContainerBgColor\": \"#1a1614\", \"chatInputAreaBgColor\": \"#2a2220\", \"chatBubbleSentBgColor\": \"#d4845a\", \"chatBubbleSentTextColor\": \"#ffffff\", \"chatBubbleReceivedBgColor\": \"#352a25\", \"chatBubbleReceivedTextColor\": \"#ede0d4\", \"inputBgColor\": \"#2a2220\", \"inputTextColor\": \"#ede0d4\", \"inputBorderColor\": \"#5a4840\", \"inputFocusBorderColor\": \"#d4845a\", \"inputFocusShadowColor\": \"#3a2d27\", \"eventCardBgColor\": \"#2a2220\", \"eventCardBorderColor\": \"#3a2d27\", \"eventCardTitleColor\": \"#f5dcc8\", \"eventCardMetaColor\": \"#a89080\", \"eventsSidebarBgColor\": \"transparent\", \"eventsSidebarTitleColor\": \"#f5dcc8\", \"widgetBgColor\": \"#241e1b\", \"widgetHeaderBgColor\": \"#2a2220\", \"widgetHeaderTextColor\": \"#f0c8a8\", \"widgetBorderColor\": \"#3a2d27\", \"widgetItemTextColor\": \"#c4a890\", \"widgetItemHoverBgColor\": \"#352a25\", \"widgetIconColor\": \"#d4845a\", \"itemsPerPageUsuarios\": 10, \"itemsPerPageCentros\": 10, \"itemsPerPageCiclos\": 10, \"itemsPerPageGrupos\": 10, \"itemsPerPageModulos\": 10, \"itemsPerPageMatriculas\": 10, \"itemsPerPageImparticiones\": 10, \"itemsPerPageHorarios\": 10}',0,'2026-03-13 23:10:38','2026-03-13 23:16:15',NULL),
(100007,'total transparencia morado','{\"primaryColor\":\"#6366f1\",\"secondaryColor\":\"#1e293b\",\"viewBackgroundColor\":\"#001657\",\"borderRadius\":\"0.75rem\",\"showLottie\":true,\"enableDraggableModal\":true,\"animatedBackground\":\"particles\",\"elementsOpacity\":43,\"sidebarColor\":\"#623c9a\",\"sidebarActiveColor\":\"#38316d\",\"sidebarActiveTextColor\":\"#ffffff\",\"sidebarHoverColor\":\"#433e70\",\"sidebarHoverTextColor\":\"#ffffff\",\"sidebarOpacity\":0,\"sidebarAccordionHeaderBgColor\":\"#52406d\",\"sidebarAccordionHeaderTextColor\":\"#ffffff\",\"sidebarAccordionContentBgColor\":\"#221d49\",\"sidebarAccordionContentTextColor\":\"#94a3b8\",\"textMainColor\":\"#f1f5f9\",\"textSecondaryColor\":\"#94a3b8\",\"specialTextColor\":\"#f1f5f9\",\"buttonPrimaryColor\":\"#6366f1\",\"buttonPrimaryTextColor\":\"#ffffff\",\"buttonSecondaryColor\":\"#334155\",\"buttonSecondaryTextColor\":\"#f8fafc\",\"headerFooterColor\":\"#603e93\",\"headerFooterTextColor\":\"#f8fafc\",\"headerFooterOpacity\":30,\"scrollbarThumbColor\":\"#475569\",\"scrollbarTrackColor\":\"#0f172a\",\"scrollbarHoverColor\":\"#64748b\",\"scrollbarWidth\":\"10px\",\"calendarSelectedBgColor\":\"#6366f1\",\"calendarSelectedTextColor\":\"#ffffff\",\"calendarWeekendBgColor\":\"#1e293b\",\"calendarWeekendTextColor\":\"#94a3b8\",\"timetableHeaderBgColor\":\"#1e293b\",\"timetableHeaderTextColor\":\"#cbd5e1\",\"timetableHoursBgColor\":\"#0f172a\",\"timetableHoursTextColor\":\"#94a3b8\",\"timetableSelectedHeaderBg\":\"#312e81\",\"timetableSelectedHeaderText\":\"#818cf8\",\"timetableSelectedCellBg\":\"#1e1b4b\",\"datatableHeaderBgColor\":\"#4338ca\",\"datatableHeaderTextColor\":\"#cbd5e1\",\"datatableHeaderHoverBgColor\":\"#5d51db\",\"datatableHeaderHoverTextColor\":\"#ffffff\",\"datatableHeaderActiveBgColor\":\"#312e81\",\"datatableHeaderActiveTextColor\":\"#ffffff\",\"datatablePaginationBgColor\":\"#312e81\",\"datatablePaginationTextColor\":\"#cbd5e1\",\"datatablePaginationButtonBgColor\":\"#6366f1\",\"datatablePaginationButtonTextColor\":\"#ffffff\",\"datatablePaginationButtonHoverBgColor\":\"#475569\",\"datatablePaginationButtonHoverTextColor\":\"#ffffff\",\"datatablePaginationButtonActiveBgColor\":\"#334155\",\"datatablePaginationButtonActiveTextColor\":\"#ffffff\",\"accordionHeaderBgColor\":\"#221d49\",\"accordionHeaderTextColor\":\"#ffffff\",\"accordionHeaderActiveBgColor\":\"#2d275d\",\"accordionHeaderActiveTextColor\":\"#ffffff\",\"accordionContentBgColor\":\"#1e293b\",\"accordionContentTextColor\":\"#cbd5e1\",\"modalHeaderBgColor\":\"#1e293b\",\"modalHeaderTextColor\":\"#ffffff\",\"modalBodyBgColor\":\"#0f172a\",\"modalBodyTextColor\":\"#cbd5e1\",\"modalFooterBgColor\":\"#1e293b\",\"modalCloseButtonBgColor\":\"#ef4444\",\"modalCloseButtonTextColor\":\"#ffffff\",\"modalCloseButtonHoverBgColor\":\"#b91c1c\",\"modalCloseButtonHoverTextColor\":\"#ffffff\",\"userCardBgColor\":\"#2d394e\",\"userCardTextColor\":\"#ffffff\",\"userCardTextSecondaryColor\":\"#94a3b8\",\"chatSidebarBgColor\":\"#1e293b\",\"chatItemHoverBgColor\":\"#334155\",\"chatItemActiveBgColor\":\"#312e81\",\"chatItemActiveBorderColor\":\"#6366f1\",\"chatItemTextMainColor\":\"#f1f5f9\",\"chatItemTextSecondaryColor\":\"#94a3b8\",\"chatBadgeBgColor\":\"#6366f1\",\"chatBadgeTextColor\":\"#ffffff\",\"chatHeaderBgColor\":\"#1e293b\",\"chatHeaderTextColor\":\"#ffffff\",\"chatContainerBgColor\":\"#1e2943\",\"chatInputAreaBgColor\":\"#1e293b\",\"chatBubbleSentBgColor\":\"#6366f1\",\"chatBubbleSentTextColor\":\"#ffffff\",\"chatBubbleReceivedBgColor\":\"#334155\",\"chatBubbleReceivedTextColor\":\"#f1f5f9\",\"inputBgColor\":\"#314059\",\"inputTextColor\":\"#ffffff\",\"inputBorderColor\":\"#919191\",\"inputFocusBorderColor\":\"#676565\",\"inputFocusShadowColor\":\"#948f8f\",\"eventCardBgColor\":\"#1e293b\",\"eventCardBorderColor\":\"#334155\",\"eventCardTitleColor\":\"#f8fafc\",\"eventCardMetaColor\":\"#94a3b8\",\"eventsSidebarBgColor\":\"transparent\",\"eventsSidebarTitleColor\":\"#f8fafc\",\"widgetBgColor\":\"#232037\",\"widgetHeaderBgColor\":\"#221d49\",\"widgetHeaderTextColor\":\"#e0e7ff\",\"widgetBorderColor\":\"#334155\",\"widgetItemTextColor\":\"#cbd5e1\",\"widgetItemHoverBgColor\":\"#334155\",\"widgetIconColor\":\"#818cf8\",\"itemsPerPageUsuarios\":10,\"itemsPerPageCentros\":10,\"itemsPerPageCiclos\":10,\"itemsPerPageGrupos\":10,\"itemsPerPageModulos\":10,\"itemsPerPageMatriculas\":10,\"itemsPerPageImparticiones\":10,\"itemsPerPageHorarios\":10,\"nameTitleConfig\":{\"words\":[{\"text\":\"Escuela\",\"color\":\"#ffffff\"},{\"text\":\"Arte\",\"color\":\"#ff0000\"},{\"text\":\"Granada\",\"color\":\"#ffffff\"}],\"spacing\":\"0.1rem\",\"casing\":\"lowercase\",\"alignment\":\"flex-end\"}}',0,'2026-03-16 12:37:27','2026-03-16 12:37:27',3);
/*!40000 ALTER TABLE `tema` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
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
(52,'jose@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$ZgGQ0vW/l/gcq21/KO/7RedTfu1/ZU4Tfpy1mdJGCWkt2dSj2fI.6','José','Pérez Cambriano','profesor',3,'/uploads/avatar/120d7b849b6cf5897d2c2c8c31af7f5776f57e25.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 995-95-6724','74681705S'),
(53,'walter@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$OOx6cBcguY8ltLR89NJRh.Qtqp72M1APAMHH4IU0Zua6wJlluiAVO','Walter','Donovan Yupanky','profesor',3,'/uploads/avatar/f4c9a4458b819ecbfe8829d5ab7a202e5e12e677.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'961 26 1798','03021239M'),
(54,'clara@eag.com','[\"ROLE_PROFESOR\"]','$2y$13$8VLephkdOwaGB7a7yAYA1.DtvJwu37wc15TMeAzGBHMlFp1PNPnAS','Clara','Gutiérrez Mira','profesor',3,'/uploads/avatar/e63758981329e99969202e3b7cee1e694f93a2d1.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 910-927672','70300626E'),
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
(77,'pepe@iestech.com','[\"ROLE_PROFESOR\",\"ROLE_ADMIN\"]','$2y$13$7OivdXwRW2aOHtTiLw96wO8/p7hY4BATQTpAp0Ve/o/BRYAd0G.ni','Theodore','Robert Bundy','admin',4,'/uploads/avatar/f0dc3678d4d52bf22d2ebcdfd9cd28e4f1b99cb6.jpg','2026-01-31 22:12:20','2026-01-31 23:41:56',0,NULL,'+34 900-59-7119','48507053F');
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

-- Dump completed on 2026-03-16 14:14:48
