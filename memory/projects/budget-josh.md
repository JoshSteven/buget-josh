# Budget Josh

## Mode de collaboration demandé

Le propriétaire est chef de projet digital et apprend progressivement l’architecture web. Il souhaite un accompagnement pédagogique, pas une exécution opaque :

- commencer chaque lot par une revue courte du besoin, du flux utilisateur et des couches concernées ;
- relever les logiques manquantes, incohérences UX, risques de données, dépendances et cas limites avant de modifier ;
- séparer les corrections indispensables des améliorations facultatives et des extensions de périmètre ;
- expliquer simplement les actions backend, frontend, base de données, tests et déploiement ;
- demander confirmation avant une décision qui change le produit, le schéma ou les données ;
- terminer par une preuve (tests, audit ou vérification visuelle) et les limites restantes.

## Vision

Application personnelle qui remplace le tableur de Josh et relie budgets, analyse financière et planification d’objectifs dans une PWA mobile en français.

## Architecture

- Frontend : HTML, CSS et JavaScript natifs.
- Backend : endpoints PHP avec PDO et requêtes préparées.
- Données : MySQL/MariaDB.
- PWA : manifest, Service Worker, cache et file hors connexion.
- Push : Push API, Notifications API, VAPID, `minishlink/web-push`, abonnements MySQL et Cron o2switch.
- Navigation : barre inférieure fixe sur mobile (icône + libellé court, zone sûre) et navigation 4 boutons horizontale sur desktop, partagée par les quatre écrans.
- Tests : Playwright sur 320×568, 360×800, 390×844 et 430×932, plus Axe.

## Flux Objectifs actif

`goal_tracks` représente l’objectif global. `goal_tasks` représente ses étapes datées et reste la cible des liaisons financières. Les cartes de la page résument l’illustration, la progression, le délai et la prochaine action. Un clic ouvre un tiroir qui montre le parcours, permet de terminer ou rouvrir une étape, et affiche une question de challenge.

Les champs de cadrage ajoutés par le lot 6 sont facultatifs afin de préserver toutes les données historiques : illustration, motivation, définition de la réussite, moyens et obstacles.

## Notifications

Le centre interne matérialise les rappels hebdomadaires, J−7, J−1, et désormais un rappel **quotidien** pointé sur l'action à échéance la plus proche (lot 7, 31 août 2026). Le Cron CLI tourne à 20h heure serveur (le serveur o2switch est en heure de Paris CEST/CET, pas en UTC) pour viser 18h GMT. Le bouton « Tester maintenant » envoie un Push immédiat au seul abonnement du navigateur courant et permet de diagnostiquer le circuit sans attendre une échéance — confirmé fonctionnel de bout en bout sur téléphone le 31 août 2026 (obstacle rencontré : blocage anti-spam Chrome Android, levé par "Effacer et réinitialiser" les données du site).

## Déploiement

Toujours exporter la base de production avant la migration. Appliquer les migrations dans l’ordre, installer les dépendances Composer, déployer les fichiers, configurer VAPID hors Git, puis exécuter le Cron en `--dry-run`. Vérifier ensuite un vrai abonnement et un vrai Push depuis un téléphone.

Le workflow quotidien est documenté dans `memory/PROJECT_STATUS.md` : revue avant code, lot cohérent, tests/audit, diff relu, commit puis push. Le `pull` intervient ensuite seulement si nécessaire pour resynchroniser ou contrôler l’état distant ; il n’est pas imposé avant chaque tâche. Pour Budget Josh, le déploiement passe par GitHub puis cPanel Git Version Control (`Update from Remote`, puis `Deploy HEAD Commit`). Les projets dont le cPanel est configuré en SSH suivent le remote SSH, après vérification de la cible.
