-- Lot 14 : dépenses « au fur et à mesure » (essence, football…). Chaque dépense garde un montant prévu,
-- et chaque passage (montant, date) est enregistré à part. Les dépenses existantes restent « En une fois ».
-- Idempotent (MySQL 8 et MariaDB). Appliqué par bin/migrate.php après la sauvegarde automatique.

SET @db := DATABASE();

-- 1. Dépenses : type de suivi et montant habituel d'un passage.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='tracking');
SET @sql := IF(@has=0, 'ALTER TABLE `entries` ADD COLUMN `tracking` enum(''single'',''gradual'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''single'' AFTER `status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='usual_amount');
SET @sql := IF(@has=0, 'ALTER TABLE `entries` ADD COLUMN `usual_amount` decimal(12,2) DEFAULT NULL AFTER `tracking`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Récurrences : même choix, repris par chaque dépense générée.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='recurring_expenses' AND COLUMN_NAME='tracking');
SET @sql := IF(@has=0, 'ALTER TABLE `recurring_expenses` ADD COLUMN `tracking` enum(''single'',''gradual'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''single'' AFTER `note`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='recurring_expenses' AND COLUMN_NAME='usual_amount');
SET @sql := IF(@has=0, 'ALTER TABLE `recurring_expenses` ADD COLUMN `usual_amount` decimal(12,2) DEFAULT NULL AFTER `tracking`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Les passages. Ils disparaissent avec leur dépense (donc avec son budget).
-- entry_id reprend exactement le jeu de caractères de entries.id : en production la table entries est
-- en latin1 (et non en utf8mb4 comme en local), et une clé étrangère exige deux colonnes identiques.
SET @cs := (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='id');
SET @co := (SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='id');
SET @sql := CONCAT(
  'CREATE TABLE IF NOT EXISTS `entry_consumptions` (',
  '`id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,',
  '`entry_id` char(36) CHARACTER SET ', @cs, ' COLLATE ', @co, ' NOT NULL,',
  '`amount` decimal(12,2) NOT NULL,',
  '`consumed_on` date NOT NULL,',
  '`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,',
  'PRIMARY KEY (`id`),',
  'KEY `consumption_entry` (`entry_id`),',
  'CONSTRAINT `fk_consumption_entry` FOREIGN KEY (`entry_id`) REFERENCES `entries` (`id`) ON DELETE CASCADE',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
