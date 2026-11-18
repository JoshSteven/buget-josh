# Budget Josh : suivi

Mis à jour le 18 novembre 2026. Les règles et l'architecture sont dans `CONTEXTE.md`.

## 1. État des lieux

| Élément | État |
|---|---|
| Git | `master` = `origin/master` = `e535eed` |
| cPanel | Dépôt à jour sur `e535eed` (capture du 18 novembre). Le passage de `Deploy HEAD Commit` reste à confirmer dans l'onglet « Pull or Deploy ». |
| Qualité locale | 44 tests Playwright verts au 18 novembre (dont Axe sur 5 pages), lint PHP et JS propres. |
| Migrations | Lots 2, 4, 5, 6, 7, 8 et 9 appliqués en production. Aucune migration en attente. |

### Lots livrés
| Lot | Contenu | Production |
|---|---|---|
| 1a à 1c | Note, nature analytique, statut annulé | Oui |
| 2 | Tableau de bord : disponibles, répartition, top natures, plafonds et alertes | Oui |
| 3 à 6 | Objectifs en cartes, étapes datées, tiroir de plan, liaisons dépense-étape, hors connexion | Oui |
| 5 et 7 | Rappels internes, Web Push, rappel quotidien | Oui, Push reçu sur téléphone le 31 août |
| 8 | Authentification applicative (fin du Basic Auth) | Oui |
| 9 | Dépenses récurrentes, cron 20 h, UX mobile | Oui (`cdecd02`) |
| Export | Fichier Excel mis en forme | Oui (`c3f96fc`) |
| Correctif | Modifier un budget sans changer le mois | Dans `e535eed`, déploiement à confirmer |

## 2. Problèmes remontés par Josh à l'usage (18 novembre)

| # | Constat | Cause trouvée dans le code | Nature |
|---|---|---|---|
| 1 | La liste des dépenses récurrentes ne s'affiche pas : impossible de les voir, les mettre en pause ou les supprimer | `recurring-expenses.js` remplit `#recurringList`, une zone qui n'existe dans aucune page. Le test vérifiait seulement le bouton. | Correction nécessaire |
| 2 | En touchant un budget, la rangée revient à gauche sur les anciens budgets | `render()` reconstruit la rangée à chaque clic (défilement remis à zéro) et la trie du plus ancien au plus récent, alors que `budget-enhancements.js` la trie dans l'autre sens au premier chargement | Correction nécessaire |
| 3 | Valider une étape d'objectif n'est pas intuitif et ne donne pas envie | Petit bouton texte « Terminer » caché dans le tiroir, sans retour visuel | Amélioration UX |
| 4 | Le vert et le logo ne plaisent plus, l'application doit faire premium « comme Apple » | Couleurs codées en dur dans 7 fichiers (`#123b35`, `#197451`, `--green`), taches décoratives en fond | Changement de périmètre validé |
| 5 | Repéré pendant l'audit : modifier une dépense sans rien changer renvoie « Dépense introuvable » | `expense_update` utilise `rowCount()`, même défaut que l'ancien bug de `budget_month` | Correction nécessaire |

## 3. Lot 10 en cours : correctifs d'usage et refonte premium

Décision de Josh (18 novembre) : tout traiter en un seul lot. La palette est à mon choix (voir `CONTEXTE.md`, section 6). **Aucun changement de base de données n'est prévu**, donc aucune migration.

| Étape | Travail | État au 18 novembre | Preuve |
|---|---|---|---|
| 1 | Liste des récurrences visible : libellé, montant, budget, prochaine date, Mettre en pause/Reprendre, Supprimer | Fait, `f1c1abe` | Test de bout en bout : créer, voir, pause, reprise, suppression |
| 2 | Budgets : le plus récent à gauche, défilement conservé, budget choisi ramené au centre | Fait, `e6c82f5` | Test avec 12 budgets simulés + test « un seul budget actif » |
| 3 | `expense_update` et `budget_label` : existence vérifiée avant la mise à jour | Fait, `be7538f` | Test API : modification identique = 200, identifiant inconnu = 404 |
| 4 | Objectifs : coche ronde façon Rappels, animation, vibration, bandeau « Annuler » 5 s, prochaine action cochable depuis la carte | Fait, `008e653` et `0242f4b` | Tests Objectifs (10) + contrôle visuel 375 px et ordinateur |
| 5 | Thème commun `assets/theme.css` : palette sans vert, Inter et Manrope locales, barre d'onglets givrée, boutons bleus, cache PWA v12 | Fait, `aa9cb86` | Captures des 4 écrans, Axe sans violation grave sur 5 pages |
| 6 | Nouveau logo et icônes PWA | **En attente du choix de Josh** (A bleu nuit recommandé, B saphir, C clair). Sources dans `assets/brand/`. | Aperçu envoyé |
| 7 | Push GitHub puis déploiement cPanel | **En attente de l'accord de Josh** | SHA cPanel = SHA poussé, smoke test |

Environnement de test local : serveur `php -S 127.0.0.1:8080` avec PHP 8.3 de Laragon (configuration dans `.claude/launch.json`, extensions passées en `-d` car ce PHP n'a pas de `php.ini`). Mot de passe local de test posé sur la base `budget_josh` : celui de `tests/global-setup.js`, à ne jamais utiliser en production. Sauvegarde de la base locale avant le lot : `database/backup_local_avant_lot10_2026-11-18.sql`.

### Risques identifiés
- **CSS éparpillé** : des styles sont injectés par JavaScript (`app-v6.js` dans le `body`, `mobile-motion.js` avec `!important`). Le thème commun doit donc avoir une priorité plus forte. Solution : sélecteurs renforcés dans `theme.css`, puis retrait progressif des couleurs codées en dur.
- **Cache de l'application installée** : le Service Worker peut servir l'ancien style. Solution : changer la version du cache dans `sw.js`.
- **Tests liés aux textes** : plusieurs tests cherchent « Terminer » ou des couleurs. Ils seront adaptés, pas supprimés.
- **Icône déjà installée sur le téléphone** : Android et iOS mettent parfois du temps à rafraîchir l'icône. Il faudra peut-être réinstaller la PWA.

### Hors de ce lot
- Mise en page complète de chaque écran : ce lot change le système visuel et les composants, pas l'organisation des écrans.
- Ligne fantôme « null » / 1 F CFA en production : Josh peut l'annuler lui-même avec le bouton Annuler.

## 4. À vérifier hors de l'ordinateur
- Réception réelle d'un Push et passage du Cron des rappels après le prochain déploiement.
- Rendu de la nouvelle icône sur le téléphone de Josh.
