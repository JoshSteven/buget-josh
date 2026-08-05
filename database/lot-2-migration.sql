-- Lot 2 — Pilotage
-- À exécuter une seule fois sur la base active, après export SQL de sauvegarde.
-- Les clauses IF NOT EXISTS rendent la migration rejouable sur MariaDB/MySQL récents.

ALTER TABLE `entries`
  ADD COLUMN IF NOT EXISTS `note` varchar(300) DEFAULT NULL AFTER `label`,
  ADD COLUMN IF NOT EXISTS `nature` varchar(40) DEFAULT NULL AFTER `bucket`;

ALTER TABLE `entries`
  MODIFY `status` enum('planned','realised','cancelled') NOT NULL;

CREATE TABLE IF NOT EXISTS `budget_limits` (
  `bucket` enum('priority','dogs') NOT NULL,
  `mode` enum('fixed','percent') NOT NULL DEFAULT 'fixed',
  `limit_value` decimal(12,2) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
