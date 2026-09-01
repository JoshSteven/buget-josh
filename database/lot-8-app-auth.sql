-- Lot 8 — Authentification applicative (remplace le Basic Auth cPanel)
-- Faire un export SQL avant exécution. Migration idempotente MySQL/MariaDB.
--
-- Aucune clé étrangère vers les tables existantes ici : pas de piège de collation
-- comme au lot 5, ces trois tables sont autonomes.

-- Identifiant unique de l'application. Une seule ligne (id=1), jamais plus.
-- Le mot de passe n'est stocké que sous forme de hash password_hash().
CREATE TABLE IF NOT EXISTS `app_credentials` (
  `id` tinyint unsigned NOT NULL DEFAULT 1,
  `password_hash` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions « appareil de confiance ». On ne stocke que le SHA-256 du jeton :
-- une fuite de la base ne permet donc pas de rejouer une session.
CREATE TABLE IF NOT EXISTS `app_sessions` (
  `token_hash` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `app_session_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tentatives de connexion échouées, pour le verrouillage temporaire par IP.
-- L'IP n'est jamais stockée en clair.
CREATE TABLE IF NOT EXISTS `app_login_attempts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ip_hash` char(64) NOT NULL,
  `attempted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `app_attempt_lookup` (`ip_hash`,`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
