-- Lot 13 : nouveau type de budget « tontine » (épargne). Repéré par un nom et une date, comme un Projet,
-- mais sans dîme. Décision de Josh du 24 novembre 2026 : la tontine est le seul cas sans dîme, sans option.
-- Idempotent (MySQL 8 et MariaDB). Appliqué par bin/migrate.php après la sauvegarde automatique.

SET @db := DATABASE();

-- 1. Retirer la contrainte de cohérence des dates, quel que soit son nom.
SET @drops := (SELECT GROUP_CONCAT(CONCAT('DROP CONSTRAINT `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='budgets' AND CONSTRAINT_TYPE='CHECK');
SET @sql := IF(@drops IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `budgets` ', @drops));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Ajouter le type.
ALTER TABLE `budgets` MODIFY `kind` enum('grace','project','tontine') COLLATE utf8mb4_unicode_ci NOT NULL;

-- 3. Remettre la contrainte : une Grâce a un mois, un Projet ou une Tontine a une date.
ALTER TABLE `budgets` ADD CONSTRAINT `valid_budget_date` CHECK (
  (`kind` = 'grace' AND `period_month` IS NOT NULL AND `project_date` IS NULL)
  OR (`kind` IN ('project','tontine') AND `project_date` IS NOT NULL AND `period_month` IS NULL)
);
