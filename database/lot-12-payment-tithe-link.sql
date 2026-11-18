-- Lot 12 : relier chaque dîme au paiement qui l'a créée, pour qu'elle suive une correction de montant.
-- Idempotent (MySQL 8 et MariaDB). Appliqué par bin/migrate.php, après la sauvegarde automatique du déploiement.

SET @db := DATABASE();

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND COLUMN_NAME='payment_id');
SET @sql := IF(@has_col=0, 'ALTER TABLE `entries` ADD COLUMN `payment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `budget_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='entries' AND INDEX_NAME='entries_payment');
SET @sql := IF(@has_idx=0, 'ALTER TABLE `entries` ADD KEY `entries_payment` (`payment_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rattachement des dîmes existantes : même budget, même date que le paiement, montant = 10 % arrondi.
UPDATE entries e
JOIN budget_payments p ON p.budget_id = e.budget_id
  AND e.entry_date = DATE(p.payment_date)
  AND e.amount = ROUND(p.amount * 0.1)
SET e.payment_id = p.id
WHERE e.bucket = 'tithe' AND e.payment_id IS NULL;

-- Budgets à un seul paiement et une seule dîme encore libre (dîme corrigée à la main par le passé) : on les relie.
UPDATE entries e
JOIN (
  SELECT budget_id, MIN(id) payment_id FROM budget_payments GROUP BY budget_id HAVING COUNT(*) = 1
) one ON one.budget_id = e.budget_id
SET e.payment_id = one.payment_id
WHERE e.bucket = 'tithe' AND e.payment_id IS NULL
  AND (SELECT COUNT(*) FROM (SELECT budget_id FROM entries WHERE bucket = 'tithe' AND payment_id IS NULL) t WHERE t.budget_id = e.budget_id) = 1;
