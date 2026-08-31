# Budget Josh

## Vision

Application personnelle qui remplace le tableur de Josh et relie budgets, analyse financière et planification d’objectifs dans une PWA mobile en français.

## Architecture

- Frontend : HTML, CSS et JavaScript natifs.
- Backend : endpoints PHP avec PDO et requêtes préparées.
- Données : MySQL/MariaDB.
- PWA : manifest, Service Worker, cache et file hors connexion.
- Push : Push API, Notifications API, VAPID, `minishlink/web-push`, abonnements MySQL et Cron o2switch.
- Tests : Playwright sur 320×568, 360×800, 390×844 et 430×932, plus Axe.

## Flux Objectifs actif

`goal_tracks` représente l’objectif global. `goal_tasks` représente ses étapes datées et reste la cible des liaisons financières. Les cartes de la page résument l’illustration, la progression, le délai et la prochaine action. Un clic ouvre un tiroir qui montre le parcours, permet de terminer ou rouvrir une étape, et affiche une question de challenge.

Les champs de cadrage ajoutés par le lot 6 sont facultatifs afin de préserver toutes les données historiques : illustration, motivation, définition de la réussite, moyens et obstacles.

## Notifications

Le centre interne matérialise les rappels hebdomadaires, J−7 et J−1. Le Cron CLI quotidien envoie les Push dus. Le bouton « Tester maintenant » envoie un Push immédiat au seul abonnement du navigateur courant et permet de diagnostiquer le circuit sans attendre une échéance.

## Déploiement

Toujours exporter la base de production avant la migration. Appliquer les migrations dans l’ordre, installer les dépendances Composer, déployer les fichiers, configurer VAPID hors Git, puis exécuter le Cron en `--dry-run`. Vérifier ensuite un vrai abonnement et un vrai Push depuis un téléphone.
