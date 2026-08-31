-- Lot 6 — Planification visuelle des objectifs
-- Faire un export SQL avant exécution. Migration idempotente MySQL/MariaDB.

SET @db := DATABASE();

SET @has_icon := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='icon_key');
SET @sql := IF(@has_icon=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `icon_key` varchar(32) NOT NULL DEFAULT ''target'' AFTER `category`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_motivation := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='motivation');
SET @sql := IF(@has_motivation=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `motivation` varchar(300) DEFAULT NULL AFTER `icon_key`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_success := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='success_definition');
SET @sql := IF(@has_success=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `success_definition` varchar(300) DEFAULT NULL AFTER `motivation`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_resources := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='resources');
SET @sql := IF(@has_resources=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `resources` varchar(500) DEFAULT NULL AFTER `success_definition`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_obstacles := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='obstacles');
SET @sql := IF(@has_obstacles=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `obstacles` varchar(500) DEFAULT NULL AFTER `resources`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
