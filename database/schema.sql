-- Structure de référence de la base Budget Josh (sans aucune donnée), état après le lot 13.
-- Sert à créer la base de test (tests/reset-test-db.php). Les migrations restent la référence pour la production.
SET FOREIGN_KEY_CHECKS=0;

/*!50503 SET NAMES utf8mb4 */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `annual_goal_months` (
  `annual_goal_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal_month` char(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`annual_goal_id`,`goal_month`),
  CONSTRAINT `fk_annual_month_goal` FOREIGN KEY (`annual_goal_id`) REFERENCES `annual_goals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `annual_goals` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `area` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goal_year` smallint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_credentials` (
  `id` tinyint unsigned NOT NULL DEFAULT '1',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_login_attempts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ip_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `app_attempt_lookup` (`ip_hash`,`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_sessions` (
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `app_session_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_limits` (
  `bucket` enum('priority','dogs') COLLATE utf8mb4_unicode_ci NOT NULL,
  `mode` enum('fixed','percent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixed',
  `limit_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_payments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `label` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_payment_budget` (`budget_id`),
  CONSTRAINT `fk_payment_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budgets` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('grace','project','tontine') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_month` char(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `valid_budget_date` CHECK (((`kind` = 'grace') and (`period_month` is not null) and (`project_date` is null)) or ((`kind` in ('project','tontine')) and (`project_date` is not null) and (`period_month` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entries` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `label` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bucket` enum('income','priority','dogs','tithe') COLLATE utf8mb4_unicode_ci NOT NULL,
  `nature` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goal_task_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('planned','realised','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entry_date` date NOT NULL,
  `source` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'personal',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_entry_budget` (`budget_id`),
  KEY `entries_payment` (`payment_id`),
  KEY `entries_goal_task_fk` (`goal_task_id`),
  CONSTRAINT `entries_goal_task_fk` FOREIGN KEY (`goal_task_id`) REFERENCES `goal_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_entry_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goal_reminders` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reminder_type` enum('weekly','j7','j1','daily') COLLATE utf8mb4_unicode_ci NOT NULL,
  `due_date` date NOT NULL,
  `read_at` datetime DEFAULT NULL,
  `push_sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `goal_reminder_once` (`task_id`,`reminder_type`,`due_date`),
  KEY `goal_reminder_due` (`due_date`,`push_sent_at`),
  CONSTRAINT `goal_reminder_task_fk` FOREIGN KEY (`task_id`) REFERENCES `goal_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goal_tasks` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `track_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal_month` char(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_date` date DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('planned','realised') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_task_track` (`track_id`),
  CONSTRAINT `fk_task_track` FOREIGN KEY (`track_id`) REFERENCES `goal_tracks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goal_tracks` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon_key` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'target',
  `motivation` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `success_definition` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resources` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `obstacles` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goals` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('financial','life') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `funded_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `target_month` char(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_goals` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal_month` char(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `annual_goal_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('planned','realised') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_monthly_annual` (`annual_goal_id`),
  CONSTRAINT `fk_monthly_annual` FOREIGN KEY (`annual_goal_id`) REFERENCES `annual_goals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_encoding` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aes128gcm',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_endpoint_hash` (`endpoint_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_expense_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recurring_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `occurrence_date` date NOT NULL,
  `entry_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recurring_once` (`recurring_id`,`occurrence_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_expenses` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `label` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `bucket` enum('priority','dogs') COLLATE utf8mb4_unicode_ci NOT NULL,
  `nature` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frequency` enum('monthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `start_date` date NOT NULL,
  `day_of_month` tinyint unsigned NOT NULL,
  `next_date` date NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `recurring_due` (`active`,`next_date`),
  KEY `recurring_budget` (`budget_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS=1;
