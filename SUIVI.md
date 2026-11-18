# Budget Josh : suivi

Mis à jour le 18 novembre 2026. Les règles et l'architecture sont dans `CONTEXTE.md`.

## 1. État des lieux

| Élément | État |
|---|---|
| Production | Lot 11 déployé le 18 novembre (`6173386`) : sauvegarde SQL faite, `composer install` (6 paquets), migration lot 11 appliquée, dry-run du Cron sans erreur. Contrôle externe : cache v14 servi, `export-excel.php` protégé (302 vers la connexion). |
| Local | À jour avec la production. Clé SSH dédiée `id_ed25519_budgetjosh_o2switch` créée sur le PC, à autoriser dans cPanel. |
| Qualité locale | 46 tests Playwright verts (dont Axe sur 5 pages), lint PHP et JS propres. |
| Migrations | Lots 2 à 11 appliqués en production. Aucune en attente. |

### Lots livrés
| Lot | Contenu | Production |
|---|---|---|
| 1a à 9 | Notes, natures, annulation, Tableau de bord et plafonds, Objectifs datés, liaisons, hors connexion, rappels et Web Push, authentification, récurrences | Oui |
| 10 | Liste des récurrences visible, rangée des budgets stable, modification sans changement, coche ronde des objectifs, thème premium sans vert, logo jOSH budget | Oui (`57b97e1`) |
| 11 | Voir ci-dessous | Oui (`6173386`) |

## 2. Lot 11 : récurrences mensuelles, en-tête d'actions, vrai Excel

Demandes de Josh (18 novembre) : une récurrence doit s'appliquer à chaque mois et pas à un budget choisi, sa suppression doit être confirmée, l'écran ordinateur doit être organisé comme une application, et l'ancien Excel était illisible.

| Sujet | Ce qui a changé | Preuve |
|---|---|---|
| Récurrences | Plus de choix de budget. Chaque occurrence va dans la Grâce de son mois ; si la Grâce n'existe pas, elle attend et arrive dès sa création. Service commun `recurring-service.php` (Cron, création d'une Grâce, création d'une récurrence). | Test : Grâce mars 2027 absente = attente ; création = 1 dépense prévue au 5 mars ; avril absent = nouvelle attente, sans doublon |
| Suppression | Feuille de confirmation au style de l'application (« Supprimer la récurrence » / « Garder ») à la place de la fenêtre grise du navigateur | Test : Garder annule, Supprimer efface ; contrôle visuel 375 px |
| Sécurité des données | `delete-budget.php` ne supprime plus les récurrences du budget supprimé (risque réel avec l'ancien rattachement) | Lecture du code et test |
| En-tête Budgets | Récurrences, Excel et Quitter en icônes en haut à droite ; un seul gros bouton « Créer un budget » | Captures 375 px et ordinateur |
| Ordinateur | Deux colonnes dès 1000 px : liste à gauche, budget ouvert à droite, message d'attente si rien n'est choisi | Capture ordinateur |
| Excel | Vrai `.xlsx` (PhpSpreadsheet) : Synthèse, Dépenses (filtres), Par catégorie et nature, Récurrences. Annulées barrées et exclues. | Fichier relu : totaux identiques au Tableau de bord (reçu 390 000, réalisé 44 500, prévu 31 000, engagé 314 500 F CFA en local) ; export refusé sans session |

Défauts de l'ancien Excel, pour mémoire : fausse extension `.xls` (avertissement à l'ouverture), annulées additionnées dans les totaux, catégorie absente, une colonne par budget presque vide, formules cassées au-delà de 21 budgets.

### Mise en production du lot 11 (dans cet ordre)
1. **Sauvegarde SQL** de la base de production (phpMyAdmin, export).
2. Push GitHub, puis dans cPanel `Update from Remote` et `Deploy HEAD Commit`.
3. Terminal cPanel, dans le dossier du site : `composer install --no-dev --optimize-autoloader` (composer global du serveur, pas de `composer.phar` dans le dossier) (nouvelle bibliothèque PhpSpreadsheet ; sans elle, le bouton Excel renvoie une erreur).
4. Appliquer `database/lot-11-recurring-monthly.sql` (phpMyAdmin ou terminal).
5. `php -q cron-recurring-expenses.php --dry-run` : doit répondre sans erreur avec `waiting_for_grace`.
6. Smoke test : connexion, bouton Excel (le fichier s'ouvre sans avertissement), fenêtre Récurrences.

### Données de production
La table `recurring_expenses` était vide en production au déploiement : aucune dépense récurrente mal placée à corriger.

## 3. Environnement de test local
- Serveur `php -S 127.0.0.1:8080` avec le PHP 8.3 de Laragon (`.claude/launch.json`, extensions passées en `-d` car ce PHP n'a pas de `php.ini`).
- Composer : `D:\laragon\bin\composer\composer.phar`, lancé avec ce même PHP et les extensions zip, gd, fileinfo.
- Mot de passe local de test : celui de `tests/global-setup.js`, posé sur la base `budget_josh`, jamais en production.
- Sauvegardes locales : `database/backup_local_avant_lot10_2026-11-18.sql` et `database/backup_local_avant_lot11_2026-11-18.sql`.

## 4. À vérifier hors de l'ordinateur
- Rendu sur le téléphone de Josh et icône de l'application (réinstaller si l'ancienne persiste).
- Réception réelle d'un Push et passage du Cron des rappels.
- Ouverture du `.xlsx` dans Excel, sur ordinateur et sur téléphone.
