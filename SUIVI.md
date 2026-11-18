# Budget Josh : suivi

Mis à jour le 18 novembre 2026. Les règles et l'architecture sont dans `CONTEXTE.md`.

## 1. État des lieux

| Élément | État |
|---|---|
| Git | `master` = `origin/master` = `e535eed` |
| cPanel | Dépôt à jour sur `e535eed` (capture du 18 novembre). Le passage de `Deploy HEAD Commit` reste à confirmer dans l'onglet « Pull or Deploy ». |
| Qualité locale | Lint PHP et JS propres. 12 fichiers de tests Playwright, non relancés le 18 novembre. |
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

| Étape | Travail | Fichiers touchés | Preuve attendue |
|---|---|---|---|
| 1 | Liste des récurrences visible dans sa fenêtre : libellé, montant, budget, prochaine date, Pause/Activer, Supprimer. Fenêtre en feuille du bas sur téléphone. | `recurring-expenses.js`, `tests/recurring-expenses.spec.js` | Test : créer, voir dans la liste, mettre en pause, supprimer |
| 2 | Budgets : un seul ordre (le plus récent à gauche), défilement conservé au clic, budget choisi ramené au centre de la rangée | `app-v6.js`, `budget-enhancements.js`, nouveau test | Test : faire défiler, choisir un budget, la position reste |
| 3 | `expense_update` : vérifier l'existence avant la mise à jour | `api.php`, test API | Test : modifier sans rien changer = succès |
| 4 | Objectifs : grande coche ronde comme dans Rappels d'Apple, animation courte, vibration légère, bandeau « Annuler » quelques secondes, et validation de la prochaine action directement depuis la carte | `objectives-v2.js`, `objectives-v2.php`, `tests/objectives-v2.spec.js` | Test : cocher depuis la carte, progression mise à jour, annulation |
| 5 | Système visuel commun `assets/theme.css` chargé sur toutes les pages : palette, Manrope et Inter locales, cartes, boutons, champs, tiroirs, navigation. Retrait du vert et des taches de fond. | `assets/theme.css`, `assets/fonts/`, les 6 pages, `mobile-motion.js`, `app-v6.js`, `manifest.webmanifest` | Captures 375 px et ordinateur des 4 écrans et de la connexion |
| 6 | Nouveau logo (monogramme « J » sur fond bleu nuit, format icône iOS) et icônes PWA 192, 512 et maskable. Montré à Josh avant remplacement. | `assets/logo.svg`, `icon-*.png`, `login.php`, `sw.js` (version du cache) | Rendu des icônes, installation PWA |
| 7 | Suite Playwright complète + Axe, vérification au navigateur, `CONTEXTE.md`/`SUIVI.md` à jour, commits, push, puis déploiement cPanel | tous | Tests verts, SHA cPanel = SHA poussé, smoke test |

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
