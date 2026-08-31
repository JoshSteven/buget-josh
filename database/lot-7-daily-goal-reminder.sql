-- Lot 7 — Rappel quotidien "où en êtes-vous avec vos objectifs ?"
-- Ajoute le type 'daily' à goal_reminders.reminder_type. Idempotente MySQL/MariaDB
-- (même précaution de collation que le lot 5 : ne rien supposer, ALTER direct suffit
-- ici car on étend un ENUM existant, pas une clé étrangère).

SET @db := DATABASE();

SET @has_daily := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goal_reminders' AND COLUMN_NAME='reminder_type'
    AND COLUMN_TYPE LIKE '%''daily''%'
);
SET @sql := IF(@has_daily=0,
  "ALTER TABLE `goal_reminders` MODIFY `reminder_type` ENUM('weekly','j7','j1','daily') NOT NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
