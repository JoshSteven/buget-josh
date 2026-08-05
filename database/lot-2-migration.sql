-- Lot 2 — Pilotage
-- À exécuter une seule fois sur la base active, après export SQL de sauvegarde.
-- Compatible MySQL et MariaDB : `ADD COLUMN IF NOT EXISTS` n'est pas supporté par
-- MySQL réel (seulement par MariaDB), donc on vérifie via information_schema
-- avec du SQL préparé plutôt que de compter sur IF NOT EXISTS pour les colonnes.

SET @db := DATABASE();

SET @has_note := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='note');
SET @sql := IF(@has_note=0, 'ALTER TABLE `entries` ADD COLUMN `note` varchar(300) DEFAULT NULL AFTER `label`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_nature := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='nature');
SET @sql := IF(@has_nature=0, 'ALTER TABLE `entries` ADD COLUMN `nature` varchar(40) DEFAULT NULL AFTER `bucket`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `entries`
  MODIFY `status` enum('planned','realised','cancelled') NOT NULL;

CREATE TABLE IF NOT EXISTS `budget_limits` (
  `bucket` enum('priority','dogs') NOT NULL,
  `mode` enum('fixed','percent') NOT NULL DEFAULT 'fixed',
  `limit_value` decimal(12,2) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
