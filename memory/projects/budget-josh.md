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

## État au 2 septembre 2026 — lot 9 validé localement

Le commit `6f2b563` ajoute les dépenses récurrentes mensuelles (API protégée, migration SQL idempotente et script CLI), l'export CSV compatible Excel de toutes les dépenses par budget, et la finition UX mobile/Objectifs avec icônes SVG. Les tests Playwright passent à 34/34 et les vérifications de syntaxe PHP/JavaScript sont propres. La base locale a été sauvegardée avant migration et le Cron récurrent a été testé en simulation puis en génération contrôlée, sans données de test conservées.

Le commit est prêt à être poussé sur `origin/master`. Après push, synchroniser cPanel avec `Update from Remote`, puis `Deploy HEAD Commit`. La migration lot 9 et le Cron de production doivent être exécutés après le déploiement, avec la sauvegarde de production déjà réalisée par l'utilisateur. Ne jamais considérer ce commit comme déployé avant vérification du SHA affiché par cPanel et un smoke test de production.

### Déploiement confirmé

Le 2 septembre 2026, `cdecd02` a été poussé sur GitHub et déployé par cPanel. Le SHA affiché par cPanel est `cdecd021a01b8cc09aa75e73657ecb4910bdb10d`. La migration lot 9 a été appliquée avec succès (`MIGRATION_OK`) et le Cron des dépenses récurrentes a été ajouté à 20h heure serveur. Son `--dry-run` de production répond sans erreur et ne trouve actuellement aucune occurrence due.

Le 2 septembre 2026, l'export CSV a été remplacé localement par un fichier `.xls` compatible Excel et mis en forme : titre, date, colonnes par budget, montants numériques et totaux. Le test de téléchargement passe ; commit `13bab6e`. Push et déploiement restent différés.
