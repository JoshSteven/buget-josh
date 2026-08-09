-- Lot 5 — Objectifs à échéance et notifications
-- Faire un export SQL avant exécution. Migration idempotente MySQL/MariaDB.

SET @db := DATABASE();

SET @has_category := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tracks' AND COLUMN_NAME='category');
SET @sql := IF(@has_category=0, 'ALTER TABLE `goal_tracks` ADD COLUMN `category` varchar(80) DEFAULT NULL AFTER `title`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_target := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tasks' AND COLUMN_NAME='target_date');
SET @sql := IF(@has_target=0, 'ALTER TABLE `goal_tasks` ADD COLUMN `target_date` date DEFAULT NULL AFTER `goal_month`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Les anciennes actions restent intactes et reçoivent une échéance ajustable.
UPDATE goal_tasks
SET target_date=LAST_DAY(CONCAT(goal_month,'-01'))
WHERE target_date IS NULL AND goal_month REGEXP '^[0-9]{4}-[0-9]{2}$';

-- goal_reminders.task_id doit avoir exactement la même collation que goal_tasks.id,
-- sinon MySQL/MariaDB refuse la clé étrangère (errno 150). On la lit dynamiquement
-- au lieu de la supposer, car elle diffère entre bases (ex. latin1_swedish_ci en
-- production contre utf8mb4_unicode_ci sur une base créée fraîchement en local).
SET @gt_collation := (SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_tasks' AND COLUMN_NAME='id');
SET @has_gr := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_reminders');
SET @sql := IF(@has_gr=0, CONCAT(
  'CREATE TABLE `goal_reminders` (',
  '`id` char(36) NOT NULL,',
  '`task_id` char(36) COLLATE ', @gt_collation, ' NOT NULL,',
  '`reminder_type` enum(''weekly'',''j7'',''j1'') NOT NULL,',
  '`due_date` date NOT NULL,',
  '`read_at` datetime DEFAULT NULL,',
  '`push_sent_at` datetime DEFAULT NULL,',
  '`created_at` timestamp NOT NULL DEFAULT current_timestamp(),',
  'PRIMARY KEY (`id`),',
  'UNIQUE KEY `goal_reminder_once` (`task_id`,`reminder_type`,`due_date`),',
  'KEY `goal_reminder_due` (`due_date`,`push_sent_at`),',
  'CONSTRAINT `goal_reminder_task_fk` FOREIGN KEY (`task_id`) REFERENCES `goal_tasks` (`id`) ON DELETE CASCADE',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` char(36) NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth_token` varchar(255) NOT NULL,
  `content_encoding` varchar(20) NOT NULL DEFAULT 'aes128gcm',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_endpoint_hash` (`endpoint_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
