-- Lot 9 — Modèles de dépenses récurrentes mensuelles
-- Faire une sauvegarde SQL avant exécution. À appliquer après les lots précédents.

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id char(36) NOT NULL,
  budget_id char(36) NOT NULL,
  label varchar(180) NOT NULL,
  amount decimal(12,2) NOT NULL,
  bucket enum('priority','dogs') NOT NULL,
  nature varchar(40) DEFAULT NULL,
  note varchar(300) DEFAULT NULL,
  frequency enum('monthly') NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  day_of_month tinyint unsigned NOT NULL,
  next_date date NOT NULL,
  active tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY recurring_due (active,next_date),
  KEY recurring_budget (budget_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_expense_runs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  recurring_id char(36) NOT NULL,
  occurrence_date date NOT NULL,
  entry_id char(36) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY recurring_once (recurring_id,occurrence_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
