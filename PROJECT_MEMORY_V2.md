# Mémoire projet — Dépenses Josh (V2)

Dernière mise à jour : 2 septembre 2026. Remplace `PROJECT_MEMORY.md` (V1) comme référence active — la V1 reste disponible pour l'historique détaillé (diagnostics, journal pas-à-pas des correctifs), mais **c'est cette V2 qui doit guider le travail à partir de maintenant.**

## État courant — lot 9

- Commit local validé : `6f2b563` — récurrences mensuelles, export CSV compatible Excel, UX mobile et icônes SVG.
- Validation : 34/34 tests Playwright, lint PHP/JavaScript et diff propres.
- Migration locale appliquée après sauvegarde ; production sauvegardée mais migration lot 9 encore à exécuter après déploiement.
- Le commit n'est pas encore poussé ni déployé ; cPanel doit afficher ce SHA après `Update from Remote` puis `Deploy HEAD Commit`.

## État actuel — 31 août 2026 (référence prioritaire)

- `master` est la branche active et suit `origin/master`.
- La page **Mes objectifs** utilise des cartes illustrées et ouvre chaque plan dans un tiroir : en bas sur mobile, latéral sur ordinateur.
- Les étapes existantes restent dans `goal_tasks` et les liaisons de dépenses restent attachées à `entries.goal_task_id`.
- La progression est calculée depuis les statuts réels `planned`/`realised`, jamais saisie manuellement. La prochaine action est la première étape non terminée par ordre de date.
- `database/lot-6-goal-planning.sql` ajoute à `goal_tracks` les champs facultatifs `icon_key`, `motivation`, `success_definition`, `resources` et `obstacles`. La migration est idempotente et a été appliquée deux fois localement.
- Le tiroir affiche un parcours visuel, la réussite attendue, la motivation, les moyens, les obstacles et une question de challenge contextuelle.
- Le centre de rappels possède un bouton **Tester maintenant** : il envoie un vrai Push à l’appareil abonné sans attendre J−7/J−1. Les abonnements expirés sont supprimés automatiquement.
- Le Cron marque désormais chaque rappel seulement si au moins un appareil l’a réellement reçu et nettoie les abonnements expirés.
- Validation locale du lot : syntaxe PHP/JS, migration répétée, tests API, quatre tailles mobiles, accessibilité Axe, suite Playwright complète et audits de dépendances. Un vrai téléphone abonné reste nécessaire pour prouver la réception Push hors navigateur automatisé.

## Lot 8 — Authentification applicative, déployée le 1er septembre 2026

Le Basic Auth cPanel est **retiré**. L’accès repose désormais sur `auth.php` : mot de passe unique (`password_hash`), session de 90 jours dont le jeton n’est stocké qu’en SHA-256, cookie `httpOnly`/`Secure`/`SameSite=Lax`, verrouillage à 8 tentatives par IP sur 15 minutes, échec fermé si la base est indisponible. Le mot de passe se pose avec `php set-password.php` (CLI uniquement, 404 en HTTP) et n’a jamais transité par une page, un fichier ou Git.

Bénéfice collatéral : `manifest.webmanifest` répond enfin 200 (il renvoyait 401 sous Basic Auth), donc la PWA s’installe proprement.

Pièges rencontrés, tous vérifiés après coup en production :

- **Le `--dry-run` du Cron ne prouvait rien.** `cron-goal-reminders.php` sort ligne 27 alors que `vendor/autoload.php` n’est chargé qu’en ligne 38 : le mode test n’atteint jamais le chemin d’envoi réel. Toute vérification du Push doit se faire **sans** `--dry-run`.
- **Le listing de répertoires était actif** sur l’hébergement : `/vendor/` exposait toute l’arborescence et `vendor/composer/installed.json` (46 Ko) donnait la version exacte de chaque bibliothèque. Fermé par `Options -Indexes` + `RedirectMatch 403 ^/vendor/` dans le `.htaccess` racine.
- **`--exclude=.htaccess` sans barre oblique** excluait tout fichier `.htaccess` à n’importe quelle profondeur : `database/.htaccess` et `tests/.htaccess` n’auraient jamais été déployés. L’exclusion est désormais ancrée (`--exclude=/.htaccess`).
- **LiteSpeed Cache** tourne sur l’hébergement et aucun en-tête de cache n’était envoyé. `budgetNoStore()` pose maintenant `Cache-Control: private, no-store` et `X-LiteSpeed-Cache-Control: no-cache` sur toutes les réponses authentifiées.

Balayage final en production, sans session : les 5 pages renvoient 302 vers `login.php`, les 8 endpoints renvoient 401, `.git/`, `.cpanel.yml`, `database/`, `tests/`, `vendor/`, `composer.json` et `package.json` renvoient 403, `set-password.php` et `cron-goal-reminders.php` renvoient 404 (garde CLI), `config.php` et `notification-secrets.php` renvoient 200 avec un corps vide (exécutés par PHP, aucune fuite de source). Les assets de la PWA et `assets/vendor/` restent servis.

Tests : `globalSetup` Playwright ouvre une session avant la suite, sinon tout part en redirection. 33/33 passent.

## Mise à jour du 31 août 2026 (soirée) — déploiement rattrapé, Push vérifié, lot 7

- **Déploiement de production débloqué** : le dépôt GitHub était passé en privé sans que le remote Git cPanel (URL HTTPS sans jeton) ne puisse plus s'authentifier — la prod était restée figée sur le commit du 9 août pendant 3 semaines. Dépôt repassé en public, `Update from Remote` + `Deploy HEAD Commit` rejoués : prod à jour.
- **PHP relevé de 8.1 à 8.3** au niveau du compte cPanel (isolation par domaine désactivée par l'hébergeur, réglage global partagé par les 8 domaines du compte — vérifié sans risque, seul `brightmind.africa` a du contenu réel et tourne en Node.js). `nd_pdo_mysql` (variante native driver) reste actif, pas de régression. `composer install --no-dev` refait sur le serveur, `vendor/` à jour.
- **Web Push confirmé fonctionnel de bout en bout sur téléphone** (notification de test reçue). Blocage rencontré : Chrome Android classe parfois un site en "Automatiquement bloqué" (anti-spam), qui ne se lève qu'avec "Effacer et réinitialiser" les données du site, pas en changeant juste le réglage Autorisations.
- **Lot 7 — Rappel quotidien 18h GMT** (demande explicite) : nouveau type de rappel `daily`, une notification par jour pointée sur l'action à échéance la plus proche, même message que `weekly`. Migration `database/lot-7-daily-goal-reminder.sql`. Cron modifié de 08:00 à 20:00 heure serveur (le serveur o2switch tourne en heure de Paris CEST/CET, pas en UTC — vérifié via `date -u; date`), pour viser 18h GMT (décalage d'1h accepté aux changements d'heure saisonniers).
- **Icône de notification corrigée** : `sw.js` n'utilise plus `icon-192.png` comme `badge` (icône opaque sans transparence → Android l'affichait en carré plein). Cache bumpé en conséquence.
- Déployé et vérifié en production (commit `2300b15`, migration appliquée, `cron-goal-reminders.php --dry-run` propre).

## But

Application personnelle de gestion de budgets et d'objectifs, pensée d'abord pour téléphone, qui remplace un tableur Excel. Deux objectifs explicites de l'utilisateur pour cette phase :
1. Que l'usage sur téléphone soit confortable et intuitif.
2. Avoir un système qui prévient quand une limite d'usage est atteinte sur une catégorie (Petits chiens ou Priorités).

## Emplacements

- Développement Laragon : `D:\laragon\www\buget-josh`
- Sous-domaine de production : `https://depensesjosh.brightlightmind.online`
- Base de production : `sc1tijo0515_depenses_budgetjosh`
- Export SQL de sauvegarde : `database/sc1tijo0515_depenses_budgetjosh.sql` (fait par l'utilisateur avant chaque migration — pratique désormais actée, voir Lot 0)

Ne jamais enregistrer de mot de passe dans ce fichier.

## Stack

HTML/CSS/JS natif (sans framework) + PHP + MySQL. Local : Laragon. Production : o2switch/cPanel. **Déploiement via GitHub** (dépôt `JoshSteven/buget-josh`, public) + cPanel Git™ Version Control (`Update from Remote` puis `Deploy HEAD Commit`) — l'éditeur de fichiers cPanel est évité (son bouton "Enregistrer" déclenche un `confirm()` navigateur bloquant en automatisation). Vérifier après un déploiement que le HEAD Commit affiché correspond au commit poussé.

## Acquis de la V1 (prérequis — tout ceci fonctionne et ne doit pas régresser)

- Boucle de requêtes infinie éliminée à la racine (plus de scripts satellites à `MutationObserver`).
- Sauvegarde multi-lignes stable (le bug de perte de lignes était un symptôme de la boucle ci-dessus).
- Feuille de budget en cartes mobiles (une carte par budget, ordre chronologique, plus de tableau à défilement horizontal).
- Séparation visuelle nette Priorités (vert) / Petits chiens (orange).
- Édition du libellé + montant d'une ligne de dépense (bouton ✎, action `expense_update`).
- Édition du nom d'un objectif global (bouton ✎, action `track_update`).
- Mois par défaut d'un nouveau budget calculé dynamiquement (plus de valeur codée en dur).
- Vraie PWA : manifest + icônes + service worker réellement chargés depuis `index.php`.
- Protection par mot de passe (Basic Auth cPanel) sur tout le sous-domaine.
- Données de production = vraies données personnelles depuis le 29 juillet 2026 (plus des données de test).

## Limitations actuelles (à traiter)

1. ~~Pas de suppression/annulation d'une dépense mal saisie.~~ **RÉSOLU** (lot 1c, bouton Annuler/Restaurer).
2. **Page Objectifs peu intuitive sur mobile.** L'utilisateur confirme explicitement que la saisie y est inconfortable et compliquée sur téléphone — refonte nécessaire (lot 3).
3. ~~Aucune catégorisation analytique des dépenses~~ **RÉSOLU** (lot 1b, champ nature).
4. **Aucun système d'alerte de limite** sur les catégories (Petits chiens/Priorités) — prochain chantier, lot 2.
5. Doublon détecté dans `goal_tracks` : « Se former en QSE » créé deux fois à la même seconde le 4 août 2026 (bug de double-soumission probable). Pas encore de bouton de suppression pour un objectif global — à traiter avec le lot 3.

## Hiérarchie des dépenses — nature analytique (validée le 4 août 2026)

Niveau 1 (obligatoire, inchangé) : **Priorité** ou **Petit chien**.
Niveau 2 (optionnel) : **nature**, une étiquette libre et indépendante du niveau 1.

**Règle explicite de l'utilisateur : la nature n'est jamais rattachée à un bucket (Priorité/Petit chien) de façon fixe dans le code.** C'est à lui de décider, dépense par dépense. Ne jamais coder une correspondance nature→bucket en dur.

| Nature | Statut | Exemples réels chez l'utilisateur |
|---|---|---|
| Foi / générosité | confirmée | Liberalité (offrande), les deux Dîmes |
| Charges essentielles | confirmée | piaement ONEA |
| Famille | confirmée | Aissata, Maman |
| Transport | confirmée | Essence |
| Outils professionnels | confirmée | Larago license, Investissement nom de domaine, Diplome recuperé, Coursera plus |
| Épargne / engagements financiers | reprise du doc initial | Tontine |
| Dettes / remboursements | reprise du doc initial (distincte d'Épargne) | Lionel remboursement |
| Plaisir / alimentation | reprise du doc initial | Bierre Nephta, degue anita, Charcuterie, Dejeuner midi, Repas resto ouaga2k |
| Loisirs | reprise du doc initial | Jeu achat, Injustice 2 game, Marvel guardians game, paiement jeu bioshock, Sortie avec les collegues |
| Télécoms / connectivité | reprise du doc initial | Wifi, unités |
| Abonnements numériques | ajout proposé | Chat gpt go & plus, Abonement Claude, Abonnement spotify, Abonnement gpt go |
| Équipement / matériel | ajout proposé | achat carte memoire 128go |
| Santé / bien-être | ajout proposé, proactif | — |
| Autre | renommée (remplace "À préciser") | Cota Assad operation, paiements et abonement, Paiement divers |

## Feuille de route (Lots, ordre de travail)

| Lot | Contenu | Statut |
|---|---|---|
| 0 — Sécuriser | Export MySQL avant migration | **Fait**, pratique actée |
| 1a — Note facultative | Champ note libre sur une ligne de dépense | **Fait** (4 août 2026) |
| 1b — Nature analytique | Colonne `nature` (nullable), sélecteur optionnel | **Fait** (4 août 2026) |
| 1c — Statut « Annulée » | 3ᵉ statut sur `entries.status`, exclu des totaux | **Fait** (4 août 2026) |
| 1d — Récurrence | Génération de dépenses récurrentes | Reporté, lot séparé |
| **2 — Pilotage** | Nouvelle page : disponible réel vs engagé, répartition, **alertes de limite par catégorie** | **À faire — prochain chantier** |
| 3 — Objectifs repensés | Cartes mobiles comme vue principale, grille en secondaire, corriger le doublon "Se former en QSE", ajouter suppression d'objectif global | Après le lot 2 |
| 4 — Liaison & hors ligne | Lien optionnel dépense-objectif, stratégie hors ligne | Reporté |

## Lots 1a/1b/1c — livrés le 4 août 2026

- Migration `entries` : colonnes `note` (varchar 300, nullable) et `nature` (varchar 40, nullable) ajoutées ; `status` étend l'énum à `'cancelled'`.
- `api.php` : action `expense` accepte `note`/`nature` optionnels ; bootstrap renvoie ces colonnes.
- `update-status.php` : accepte `cancelled` comme statut valide.
- `app-v6.js` : formulaire de brouillon avec note + nature (liste déroulante des 14 catégories) ; badge nature et note affichés par ligne ; boutons **Annuler**/**Restaurer** (soft-delete, exclut des totaux).
- `draft-flow.js` réécrit génériquement (label/amount/note/nature) pour que les nouveaux champs survivent au ré-affichage.
- **Découverte de déploiement** : un cache HTTP servait une version périmée de `app-v6.js`/`draft-flow.js` même après upload réussi (fichier serveur correct, seule la distribution était en cause). **Correctif** : `index.php` et `objectives.php` chargent les scripts avec `?v=<filemtime>` calculé dynamiquement en PHP — se met à jour automatiquement à chaque déploiement.
- Vérifié en production (nouvel onglet) : boutons ✎/Annuler/Restaurer, badges nature et notes fonctionnels.

## Limitation restante connue

La ligne fantôme `"null"` / 1 F CFA est toujours présente en production — annulable par l'utilisateur via le nouveau bouton Annuler. Pas encore fait au 4 août 2026.

## Prochaine étape

**Lot 2 — Pilotage.** Nouvelle page séparée de la saisie, avec :
- Reçu / Réalisé / Prévu / Disponible réel (revenus − réalisées) / Disponible engagé (revenus − réalisées − prévues).
- Répartition Priorités / Petits chiens et top 3 des natures les plus importantes.
- Alertes de limite par catégorie. Modalité du plafond (montant fixe vs pourcentage des revenus) encore à trancher avec l'utilisateur.

Ensuite, lot 3 (refonte Objectifs en cartes mobiles) puis lot 4 (liaison + hors ligne).


## État actuel — 6 août 2026 (référence prioritaire)

Cette section remplace les statuts de lots plus anciens présents plus haut lorsqu’ils se contredisent.

### Navigation validée

La navigation principale comporte toujours quatre destinations, dans cet ordre :

1. **Mes budgets** — saisie et suivi des budgets ;
2. **Mes objectifs** — objectifs globaux et sous-objectifs datés ;
3. **Lier mes dépenses** — association facultative d’une dépense à un sous-objectif ;
4. **Tableau de bord** — analyse des revenus, dépenses, disponibilités et plafonds (ancien nom : Pilotage).

Les quatre boutons restent visibles sur chaque page. La page active est sélectionnée. Sur mobile, une barre fixe inférieure affiche une icône et un libellé court par destination, avec une marge prenant en compte les zones sûres iOS/Android ; sur ordinateur, les quatre boutons restent sur une ligne dans l’en-tête.

### Objectifs V2 et rappels

- Un objectif global possède un nom et une catégorie facultative.
- Il contient autant de sous-objectifs que nécessaire.
- Chaque sous-objectif possède un titre et une date cible précise ; aucun statut supplémentaire n’est affiché dans le nouveau flux.
- L’interface affiche les jours restants, J−7, demain et les échéances dépassées.
- Les anciennes actions mensuelles sont préservées : leur date cible initiale devient le dernier jour de leur ancien mois, puis reste modifiable.
- Les actions secondaires Modifier/Supprimer utilisent partout le menu **…**, avec confirmation avant suppression.
- Les liaisons affichent désormais la date cible exacte du sous-objectif.

Rythme de rappels validé : point hebdomadaire chaque lundi lorsqu’il reste plus de sept jours, rappel à J−7, rappel à J−1, aucun nouveau rappel après l’échéance.

Architecture : centre de notifications interne + Notifications API + Push API + Service Worker + clés VAPID + bibliothèque PHP `minishlink/web-push` + table MySQL d’abonnements + journal de déduplication + Cron o2switch quotidien. Les secrets VAPID sont dans `notification-secrets.php`, ignoré par Git. La procédure se trouve dans `OBJECTIVES_NOTIFICATIONS.md`.

Migration : `database/lot-5-objectives-notifications.sql` ajoute `goal_tracks.category`, `goal_tasks.target_date`, `goal_reminders` et `push_subscriptions`. Elle est idempotente et a été appliquée deux fois localement sans perte.

### État Git et validation

- Branche locale : `agent/objectifs-notifications`.
- Commit Objectifs/notifications : `448b6cc`.
- Push GitHub encore bloqué au 6 août 2026 : clé SSH refusée et `gh` non authentifié. L’utilisateur doit exécuter `gh auth login --hostname github.com --git-protocol https --web`, puis reprendre le push.
- Validation locale avant navigation renommée : 23 tests Playwright réussis, quatre tailles mobiles, zéro violation Axe critique/sérieuse, audits npm et Composer sans vulnérabilité, Cron testé en dry-run et en exécution sans destinataire.
- Limite de test : aucun envoi Web Push réel n’a encore été effectué vers un téléphone abonné.
- Diagnostic Push : le centre distingue désormais contexte non sécurisé, navigateur intégré sans PushManager/Notification, permission refusée et clés VAPID absentes. Le Web Push local doit être testé sur `localhost`/HTTPS dans un navigateur complet ; la réception réelle nécessite un appareil abonné.
