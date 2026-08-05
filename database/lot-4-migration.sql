-- Lot 4 — Liaison dépense / objectif
-- Faire un export SQL avant exécution. À exécuter après lot-2-migration.sql
-- (dépend de la colonne `nature`, déjà ajoutée par le lot 2).
-- Compatible MySQL et MariaDB : voir la note dans lot-2-migration.sql sur
-- IF NOT EXISTS pour ADD COLUMN.

SET @db := DATABASE();

SET @has_link := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='goal_task_id');
SET @sql := IF(@has_link=0, 'ALTER TABLE `entries` ADD COLUMN `goal_task_id` char(36) DEFAULT NULL AFTER `nature`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='entries' AND CONSTRAINT_NAME='entries_goal_task_fk');
SET @sql := IF(@has_fk=0, 'ALTER TABLE `entries` ADD CONSTRAINT `entries_goal_task_fk` FOREIGN KEY (`goal_task_id`) REFERENCES `goal_tasks` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
