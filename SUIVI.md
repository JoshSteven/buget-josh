# Budget Josh : suivi

Mis à jour le 18 novembre 2026. Les règles et l'architecture sont dans `CONTEXTE.md`.

## 1. État des lieux

| Élément | État |
|---|---|
| Production | **`b7071c4`, déployé le 18 novembre par le premier `npm run deploy`** : 56 tests verts avant envoi, sauvegarde `budget-josh-deploy-20261118-193705.sql.gz`, suivi des migrations créé, lot 12 appliqué (7 dîmes sur 7 reliées à leur paiement), Cron de sauvegarde de nuit ajouté, site en ligne et API protégée. |
| Local | **Lot 13 (Tontine) terminé et commité, pas encore déployé** : l'IP de la box a changé (154.66.162.121), à autoriser dans cPanel > Autorisation SSH avant `npm run deploy`. |
| Qualité locale | 58 tests Playwright verts sur la base de test séparée (dont Axe sur 5 pages), lint PHP et JS propres. |
| Migrations | Lots 2 à 12 appliqués en production, suivis dans `schema_migrations`. |
| Accès SSH | Alias `budgetjosh` (clé `id_ed25519_budgetjosh_o2switch` autorisée dans cPanel, IP 102.180.15.235 autorisée dans le pare-feu o2switch). Serveur roux.o2switch.net, PHP 8.3.36, composer et mysqldump disponibles. |

### Lots livrés
| Lot | Contenu | Production |
|---|---|---|
| 1a à 9 | Notes, natures, annulation, Tableau de bord et plafonds, Objectifs datés, liaisons, hors connexion, rappels et Web Push, authentification, récurrences | Oui |
| 10 | Récurrences visibles, rangée des budgets stable, coche ronde des objectifs, thème premium sans vert, logo jOSH budget | Oui (`57b97e1`) |
| 11 | Récurrences sur chaque Grâce mensuelle, confirmation de suppression, en-tête d'actions, deux colonnes sur ordinateur, vrai export `.xlsx` | Oui (`6173386`) ; table des récurrences vide en production, rien à corriger |
| Fondations | Voir section 2 | Oui (`b7071c4`) |
| 12 | Modifier un budget complètement : paiements reçus modifiables, ajout, suppression, dîme qui suit (option A). Migration `lot-12-payment-tithe-link.sql` (relie chaque dîme à son paiement ; les deux dîmes locales ont été reliées) | Oui (`b7071c4`) |
| 13 | Budget Tontine (épargne) : nom + date, jamais de dîme, repère « Tontine · sans dîme ». Migration `lot-13-tontine.sql` (type ajouté, contrainte de dates mise à jour) | **Non**, attend l'autorisation de la nouvelle IP |

## 2. Lot Fondations (validé par Josh le 18 novembre)

Suite à l'audit global : garder PHP/MySQL/o2switch, mais remettre de l'ordre avant les prochaines fonctionnalités.

| Point | Ce qui a été fait | Preuve |
|---|---|---|
| 1. Moteur de calcul unique | `lib/budget-totals.php` ; l'API le renvoie (`totals`), le Tableau de bord et l'export Excel l'utilisent | Test : totaux serveur = détail des dépenses, annulées exclues ; Tableau de bord = totaux serveur |
| 2. Socle PHP commun | `lib/bootstrap.php` ; 10 connexions dupliquées remplacées ; `api.php` réécrit lisiblement avec validation (montants positifs, dates réelles, budget existant) | Test : montants 0, négatif ou texte refusés, 31 février refusé |
| 3. Écran Budgets lisible | `budgets.js` + `assets/budgets.css` remplacent `app-v6.js`, `budget-enhancements.js`, `draft-flow.js` | 53 tests ; contrôle visuel 375 px et ordinateur |
| 4. Base de test séparée | `budget_josh_test` recréée à chaque `npm test` (structure + données fictives) | Les tests ne touchent plus la base de développement |
| 5. Sauvegarde et migrations | `bin/backup-database.php` (gzip, 14 conservées), `bin/migrate.php` (suivi, arrêt à la première erreur), Cron de nuit installé au premier déploiement | Essais sur la base de test : nouvelle migration appliquée une seule fois, migration cassée = arrêt |
| 6. Contrôle d'origine | `budgetRequireSameOrigin()` sur toutes les API et la connexion | Test : requête venant d'un autre site = 403 |
| Déploiement en une commande | `npm run deploy` / `npm run deploy:simuler` (`deploy.ps1` + `bin/remote-deploy.sh`) | Simulation réelle sur o2switch réussie, sans modification |

Défauts trouvés et corrigés en route : la feuille « Nouvelle dépense » était effacée par tout rechargement de l'écran et, sur téléphone, restait invisible (piégée par l'animation de la carte) ; aucun bouton d'enregistrement sur ordinateur sans le bouton « Sauvegarder » de la carte.

### Premier déploiement : fait le 18 novembre
`npm run deploy`. Effets en production : nouveaux fichiers, sauvegarde `deploy`, création de `schema_migrations` (historique marqué), migration lot 12 (colonne `entries.payment_id` et rattachement des dîmes existantes), ajout du Cron de sauvegarde de 2 h 30.

Point connu : un test (« modifier une dépense ou un projet sans rien changer ») est parfois interrompu par une fermeture du navigateur de test, toujours en 2e position, jamais seul ; la seconde tentative le fait passer et il est signalé « flaky ».

## 3. Prochains lots
Constat au déploiement : 3 récurrences attendent la Grâce de novembre (pas encore créée) et 7 rappels d'objectifs sont en attente côté Cron.

1. **Notifications intelligentes** (proposition validée sur le principe) : un rappel par jour à l'heure choisie, silencieux si Josh a déjà avancé, rappels d'étapes en retard (aujourd'hui ignorées, d'où l'absence totale de notifications), calendrier J-2, jour J, J+1, J+3 puis hebdomadaire, boutons « Fait » et « Décaler » sur Android, écran Réglages des notifications, Cron horaire.

## 4. Environnement local
- Serveur de développement : `php -S 127.0.0.1:8080` (PHP 8.3 de Laragon, configuration `.claude/launch.json`) sur la base `budget_josh`.
- Tests : `npm test` démarre seul son serveur sur le port 8081 et la base `budget_josh_test`.
- Composer : `D:\laragon\bin\composer\composer.phar` avec le PHP 8.3 de Laragon.
- Sauvegardes locales : `database/backup_local_avant_lot10_2026-11-18.sql`, `database/backup_local_avant_lot11_2026-11-18.sql`.

## 5. À vérifier hors de l'ordinateur
- Rendu sur le téléphone de Josh et icône de l'application (réinstaller si l'ancienne persiste).
- Réception réelle d'un Push et passage du Cron des rappels.
- Ouverture du `.xlsx` dans Excel, sur ordinateur et sur téléphone.
