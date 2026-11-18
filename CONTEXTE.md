# Budget Josh : contexte de référence

Mis à jour le 18 novembre 2026. Ce fichier fait foi pour le produit, les règles et l'architecture. L'avancée, le lot en cours et les points en attente sont dans `SUIVI.md`. Ces deux fichiers remplacent toutes les anciennes mémoires (`PROJECT_MEMORY*.md`, `memory/`, `OBJECTIVES_NOTIFICATIONS.md`), dont l'historique reste dans Git.

## 1. Produit

PWA personnelle de Josh, en français, pensée d'abord pour le téléphone. Elle remplace son ancien tableur Excel et relie trois choses : ses budgets, l'analyse de ses dépenses et la planification de ses objectifs.

| Élément | Référence |
|---|---|
| Local | `D:\laragon\www\buget-josh` (Laragon, PHP 8.2 local, MySQL 8.4) |
| Production | `https://depensesjosh.brightlightmind.online` (o2switch, PHP 8.3) |
| Base de production | `sc1tijo0515_depenses_budgetjosh` |
| Dépôt | `github.com/JoshSteven/buget-josh`, branche `master`, public |
| Déploiement | cPanel Git Version Control : `Update from Remote` puis `Deploy HEAD Commit` |

Les données de production sont les vraies finances personnelles de Josh depuis le 29 juillet 2026.

## 2. Navigation (validée)

1. **Mes budgets** (`index.php`) : saisie et suivi des budgets.
2. **Mes objectifs** (`objectives-v2.php`) : objectifs et étapes datées.
3. **Lier mes dépenses** (`liaison.php`) : lien facultatif dépense vers étape.
4. **Tableau de bord** (`pilotage.php`) : reçu, réalisé, prévu, disponibles, plafonds.

Téléphone : barre fixe en bas à 4 icônes avec libellés courts et zone sûre iOS/Android. Ordinateur : 4 boutons horizontaux dans l'en-tête. La navigation est injectée par `mobile-motion.js`.

Écran Budgets (lot 11) : actions secondaires en icônes dans l'en-tête (Récurrences, Excel, Quitter), seul « Créer un budget » reste en gros bouton. À partir de 1000 px, deux colonnes façon iPad : liste des budgets à gauche, budget ouvert à droite.

## 3. Règles métier

### Budgets
- Deux types : **Grâce** (mensuelle : la Grâce de juillet est le salaire reçu fin juin) et **Projet / consultance**. Aucun budget avant juin 2026.
- Chaque paiement reçu crée automatiquement une **dîme de 10 %** (bucket `tithe`), affichée dans Priorités.
- Chaque dépense appartient à un budget et à une catégorie : **Priorités** (`priority`, plus `tithe`) ou **Petits chiens** (`dogs`).
- Statuts : `planned` (prévue), `realised` (réalisée), `cancelled` (annulée). Une dépense annulée reste visible mais est **exclue de tous les totaux**.
- Une seule carte de budget est ouverte à la fois. Aucun budget n'est ouvert automatiquement au chargement.
- Disponible réel = reçu moins réalisé. Disponible engagé = reçu moins réalisé moins prévu.

### Nature analytique (facultative)
- Deuxième niveau libre et indépendant de la catégorie. **Ne jamais coder de correspondance nature vers catégorie.**
- 14 natures : Foi / générosité, Charges essentielles, Famille, Transport, Outils professionnels, Épargne / engagements financiers, Dettes / remboursements, Plaisir / alimentation, Loisirs, Télécoms / connectivité, Abonnements numériques, Équipement / matériel, Santé / bien-être, Autre.

### Dépenses récurrentes
- **Décision de Josh (18 novembre 2026) : une récurrence n'appartient à aucun budget précis.** Elle comporte libellé, montant, catégorie, date de départ (qui fixe le jour du mois), nature et note facultatives.
- Chaque mois, l'occurrence est ajoutée comme dépense **prévue** dans la **Grâce de ce mois**. Si cette Grâce n'existe pas encore, la récurrence attend. Les budgets Projet ne reçoivent jamais de récurrence.
- La génération (`recurring-service.php`) est déclenchée à trois moments : création d'une Grâce (ou changement de son mois), création d'une récurrence, et Cron quotidien de 20 h. Le suivi `recurring_expense_runs` empêche tout doublon.
- Pause : plus rien n'est ajouté. Suppression : confirmation obligatoire ; les dépenses déjà créées restent. Supprimer une Grâce ne supprime plus aucune récurrence et permet de regénérer ses occurrences si elle est recréée.
- L'ancienne colonne `recurring_expenses.budget_id` est conservée (facultative depuis `lot-11-recurring-monthly.sql`) mais n'est plus utilisée.

### Export Excel
- Vrai fichier `.xlsx` produit côté serveur par `export-excel.php` (PhpSpreadsheet, via Composer), protégé par `budgetRequireAuthPage()`.
- Quatre onglets : Synthèse (une ligne par budget), Dépenses (une ligne par dépense, filtres), Par catégorie (et par nature), Récurrences. Annulées visibles mais barrées et exclues de tous les totaux.

### Plafonds (Tableau de bord)
- Par catégorie, en montant fixe ou en pourcentage des revenus du périmètre choisi (`budget_limits`). Valeur nulle = plafond désactivé.
- Alerte préventive à 80 %, critique à partir de 100 %. Engagé = réalisé + prévu.

### Objectifs
- `goal_tracks` = objectif (titre, catégorie facultative, illustration `icon_key`, motivation, réussite attendue, moyens, obstacles : tous facultatifs).
- `goal_tasks` = étapes datées (`target_date`), statut `planned`/`realised`. Elles sont la cible des liaisons de dépenses (`entries.goal_task_id`, `ON DELETE SET NULL`).
- Progression = étapes terminées / étapes totales, jamais saisie à la main. Prochaine action = première étape non terminée par ordre de date.
- Plan ouvert dans un tiroir : en bas sur téléphone, sur le côté sur ordinateur.

### Rappels et notifications
- Rythme : point chaque lundi s'il reste plus de 7 jours, J-7, J-1, plus un rappel **quotidien** sur l'action la plus proche. Rien après l'échéance. Dédupliqués par étape, type et date.
- Centre de rappels interne + Web Push (VAPID, `minishlink/web-push`, table `push_subscriptions`) + Cron `cron-goal-reminders.php` à 20 h heure serveur (Paris), soit environ 18 h GMT.
- Bouton **Tester maintenant** : vrai Push immédiat vers l'appareil courant. Il prouve l'abonnement, VAPID et le Service Worker, pas le déclenchement du Cron.
- Clés VAPID : générées par `node generate-vapid-keys.cjs`, stockées dans `notification-secrets.php` (modèle versionné : `notification-secrets.example.php`). Bibliothèque installée sur le serveur par `composer install --no-dev`.
- Piège : le `--dry-run` du Cron des rappels s'arrête avant de charger la bibliothèque Push. Il ne prouve pas l'envoi.
- Piège Android : Chrome peut classer le site en « bloqué automatiquement ». Seul « Effacer et réinitialiser » les données du site lève ce blocage.

## 4. Architecture

- **Frontend** : HTML, CSS et JavaScript natifs, sans framework. Écran Budgets : **un seul fichier, `budgets.js`** (un état, un affichage, un écouteur) et sa feuille `assets/budgets.css`. Modules partagés : `recurring-expenses.js` (fenêtre des récurrences et feuille de confirmation `window.BudgetConfirm`), `mobile-motion.js` (navigation, logo, animations), `offline-sync.js` (hors connexion), `session-guard.js` (bouton Quitter). Thème commun `assets/theme.css`. GSAP et Lenis dans `assets/vendor/`.
- **Backend** : socle commun **`lib/bootstrap.php`** (connexion unique `budgetDb()`, réponses `budgetJson()`/`budgetFail()`, lecture validée `budgetAmount()`, `budgetDate()`, `budgetId()`…, contrôle d'origine), chargé par `auth.php`. **Moteur de calcul unique `lib/budget-totals.php`** : tous les totaux (reçu, réalisé, prévu, disponibles, catégories, natures) viennent de là, pour l'écran Budgets, le Tableau de bord et l'export. Endpoints : `api.php`, `recurring-api.php`, `goals-v2-api.php`, `links-api.php`, `limits-api.php`, `notifications-api.php`, `auth-api.php`, `export-excel.php`.
- **Outils en ligne de commande** (`bin/`, interdit au web) : `migrate.php` (migrations suivies dans `schema_migrations`), `backup-database.php` (sauvegarde gzip dans `~/backups/budget-josh`, 14 conservées par type), `remote-deploy.sh` (exécuté par `deploy.ps1`).
- **Données** : MySQL. Tables : `budgets`, `budget_payments`, `entries`, `recurring_expenses`, `recurring_expense_runs`, `budget_limits`, `goal_tracks`, `goal_tasks`, `goal_reminders`, `push_subscriptions`, `schema_migrations`, tables d'authentification. Structure de référence : `database/schema.sql`.
- **PWA** : `manifest.webmanifest`, `sw.js` (réseau d'abord, cache de secours, version à changer à chaque livraison visible), file d'écritures hors connexion dans `localStorage`. Scripts versionnés par `?v=<filemtime>`.
- **Tests** : Playwright, `npm test`. Ils démarrent leur propre serveur (port 8081) sur la base **`budget_josh_test`**, recréée à chaque lancement depuis `database/schema.sql` et des données fictives (`tests/fixtures.sql`). La base de développement `budget_josh` n'est jamais touchée. Une seconde tentative par test absorbe les fermetures inattendues du navigateur sous Windows.
- **Déploiement** : **`npm run deploy`** depuis le PC (tests, push GitHub, puis par SSH : dépôt cPanel, copie des fichiers, composer, sauvegarde, migrations, contrôle des Cron, vérification du site). `npm run deploy:simuler` ne modifie rien. Alias SSH `budgetjosh`, clé dédiée ; si la box change d'IP, l'ajouter dans cPanel > Autorisation SSH. Les boutons cPanel restent possibles en secours.

## 5. Sécurité (invariants)

- **Toute page ou API appelle `budgetRequireAuthPage()` ou `budgetRequireAuthApi()`** (`auth.php`). Depuis le lot 8 c'est la seule protection : mot de passe unique haché, session de 90 jours, jeton stocké en SHA-256, cookie `httpOnly`/`Secure`/`SameSite=Lax`, verrouillage après 8 essais par IP sur 15 minutes. Mot de passe posé par `php set-password.php` (CLI uniquement).
- `budgetNoStore()` désactive le cache (LiteSpeed) sur les réponses authentifiées.
- Jamais dans Git : `config.php`, `.env`, `notification-secrets.php`, clés privées, exports SQL.
- Le `.htaccess` racine n'est pas versionné. Il porte `DirectoryIndex index.php`, `Options -Indexes` et le blocage de `/vendor/` et des manifestes de dépendances. À vérifier après toute action de cPanel sur la « Confidentialité du répertoire » : sa perte ne produit aucune erreur visible.
- Toute nouvelle migration : fichier `database/lot-N-....sql`, idempotente, ajoutée aux exceptions `!database/...` de `.gitignore`, testée localement, et répercutée dans `database/schema.sql`. La sauvegarde de production avant migration est faite automatiquement par `npm run deploy`.
- Contrôle d'origine sur toutes les requêtes qui modifient des données (`budgetRequireSameOrigin()`), en plus du cookie `SameSite=Lax`.
- Sauvegarde automatique de la base chaque nuit à 2 h 30 (Cron installé par le premier `npm run deploy`).

## 6. Identité visuelle

**Décision du 18 novembre 2026 : abandon du vert.** Josh demande une application plus premium, dans l'esprit d'une application Apple, avec un nouveau logo. Il m'a laissé choisir la palette.

| Rôle | Valeur | Usage |
|---|---|---|
| Fond | `#F5F5F7` | Fond d'écran, gris clair Apple |
| Surface | `#FFFFFF` | Cartes, tiroirs, barres |
| Texte | `#1D1D1F` | Titres et montants |
| Texte secondaire | `#6E6E73` | Libellés, dates |
| Séparateur | `#E5E5EA` | Bordures fines |
| Accent (Priorités, actions, réalisé) | `#2456F5` bleu saphir | Boutons, état actif, coche validée |
| Petits chiens | `#C2700A` ambre | Catégorie secondaire |
| Alerte | `#D70015` | Suppression, dépassement de plafond |
| Logo / barre système | `#0B1B3A` bleu nuit | Icône d'application, `theme-color` |

- **Logo (choisi par Josh le 18 novembre, option B)** : fond bleu saphir `#2456F5`, grand « j » blanc dont le point est une pièce bleu nuit, « OSH » en petit indice en bas à droite (jOSH) et « budget » encore plus discret dessous. Source : `assets/brand/logo-b-josh.svg` (police Manrope intégrée). Icônes dérivées : `assets/logo.svg`, `icon-192/512.png`, `icon-maskable-*.png`, `apple-touch-icon.png`.
- Typographie : **Manrope** pour les titres (600 à 700), **Inter** pour le texte (16 px, interligne 1,5), toutes deux servies localement. Pas de SF Pro (licence).
- Style : surfaces blanches sur fond gris clair, coins arrondis généreux, ombres très douces, flou léger sur les barres, pas de taches décoratives ni de dégradés, `prefers-reduced-motion` respecté.
- Zones tactiles de 44 à 48 px. Montants en F CFA, interface en français, aucun tiret cadratin dans les textes.

## 7. Méthode de travail avec Josh

- Josh est chef de projet digital, pas développeur. Expliquer la couche touchée, l'outil utilisé et la preuve obtenue. Préférer schémas et parcours visuels aux longs textes.
- Avant le code : plan court et mini-revue (besoin, flux, données, risques, dépendances). Séparer correction nécessaire, amélioration optionnelle et changement de périmètre. Demander une décision quand le produit ou les données changent.
- Après le code : tests proportionnés, vérification visuelle au navigateur en 375 px puis en taille ordinateur, et liste de ce qui reste impossible à prouver localement (vrai téléphone, production, Push).
- Git : commit après chaque tâche cohérente, avec `CONTEXTE.md` et `SUIVI.md` à jour. Push à la fin d'un lot. Ne jamais mélanger les fichiers d'un autre intervenant.
- Déploiement : push GitHub, puis dans cPanel `Update from Remote` et `Deploy HEAD Commit`. Vérifier que le SHA affiché correspond, puis smoke test de l'URL (redirection vers `login.php` sans session).
