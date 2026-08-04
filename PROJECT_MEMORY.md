# Mémoire projet — Dépenses Josh

Dernière mise à jour : 29 juillet 2026.

## But

Application personnelle de gestion de budgets et d'objectifs, pensée d'abord pour téléphone. Elle remplace un tableur Excel : les budgets sont des colonnes, les catégories sont `Priorités` et `Petits chiens`.

## Emplacements

- Développement Laragon : `D:\laragon\www\buget-josh`
- Sous-domaine de production : `https://depensesjosh.brightlightmind.online`
- Base de production : `sc1tijo0515_depenses_budgetjosh` (confirmé via export SQL réel le 4 août 2026 — corrige une note du 29 juillet basée sur une lecture d'écran erronée)
- Export SQL de sauvegarde : `database/sc1tijo0515_depenses_budgetjosh.sql` (fait par l'utilisateur le 4 août 2026)

Ne jamais enregistrer de mot de passe dans ce fichier.

## Stack

- Front-end : HTML, CSS, JavaScript natif (sans framework).
- Back-end : PHP.
- Données : MySQL.
- Local : Laragon (PHP 8.2 / MySQL 8.4).
- Production : o2switch / cPanel / phpMyAdmin.

## Fonctionnement actuel

- Deux types de budgets : Grâce mensuelle et Projet / consultance.
- Une Grâce de juillet correspond au salaire reçu fin juin pour couvrir juillet.
- Chaque dépense est liée à un budget, dans `Priorités` ou `Petits chiens`.
- Une dîme de 10 % est créée automatiquement par budget et affichée dans Priorités.
- Les statuts `À faire` / `Réalisée` sont représentés par un toggle.
- Page Objectifs séparée : lignes d'objectifs globaux et actions par mois, **de juillet 2026 à décembre 2027** (juin déjà rempli, exclu du nouveau planning).
- Front-end principal (`index.php` → `app-v6.js`) : une **carte par budget** (empilées verticalement sur mobile, grille responsive sur écran large) — plus de tableur large à défilement horizontal.
- PWA : manifest et service worker réellement liés depuis `index.php` (existaient mais n'étaient jamais chargés). Icônes réelles ajoutées (`icon-192.png`, `icon-512.png`).
- Les cartes de budget s'affichent en ordre chronologique (plus ancien à gauche/en premier, plus récent à droite/en dernier).
- **Données en production = vraies données de l'utilisateur** depuis le 29 juillet 2026 (plus des données de test) : projet « site authentiqueracine » et « Grâce 2026-07 ». Toujours traiter le contenu de la base comme des données financières personnelles réelles.
- Le mois par défaut d'un nouveau budget (Grâce) suit dynamiquement la date du jour, plus un mois codé en dur.
- Chaque ligne de dépense est éditable (libellé + montant, bouton ✎) — action API `expense_update`. Pas de suppression de ligne (intentionnel).
- Séparation visuelle nette Priorités (vert) / Petits chiens (orange) dans chaque carte.
- Page Objectifs : chaque objectif global (ligne) a aussi un bouton ✎ pour corriger son nom — action API `track_update` dans `goals-grid-api.php`.

## Tables MySQL utilisées en production

- `budgets`
- `budget_payments`
- `entries`
- `goal_tracks`
- `goal_tasks`

## État de déploiement

- Les fichiers ont été téléversés dans le dossier du sous-domaine o2switch.
- Le schéma MySQL de production a été importé avec succès.
- L'utilisateur MySQL doit rester associé à la base avec les privilèges nécessaires.
- `config.php` en production doit contenir les identifiants MySQL o2switch, jamais ceux de Laragon.

## Bugs connus

1. ~~Mobile : le tableur conserve une ergonomie desktop~~ — **RÉSOLU le 29 juillet 2026**, refonte en cartes verticales, voir journal.
2. ~~Brouillons : lignes perdues~~ — confirmé résolu par l'utilisateur après le correctif de la boucle de requêtes.
3. Objectifs page (`objectives.php`) : la grille mensuelle reste un tableau large (18 mois désormais) qui nécessite du défilement horizontal — n'a pas été repensée en mobile. À signaler si l'utilisateur veut la même refonte que la page principale.

## Prochaines étapes prioritaires

Aucune étape prioritaire en attente à ce jour (29 juillet 2026) — voir "Bugs connus" n°3 pour un chantier optionnel identifié mais non demandé explicitement.

## Journal des avances majeures

- 2026-07-29 : **cause racine trouvée et corrigée** pour le bug n°3 (`Unexpected token '<'` / erreurs 503). Trois scripts chargés par `index.php` (`sheet-polish-fixed.js`, `entry-display.js`, `sheet-summary.js`) observaient chacun tout `document.body` via `MutationObserver` pour se re-décorer après chaque changement, mais ne suspendaient que leur propre observateur pendant leurs propres mutations — pas les deux autres. Résultat : une réaction en chaîne quasi infinie (des centaines de requêtes `api.php?action=bootstrap` par minute tant qu'un onglet restait ouvert), qui finissait par saturer l'hébergement mutualisé et provoquait des réponses 503. Corrigé avec un registre partagé (`window.__obsPause`) qui suspend/reprend les trois observateurs ensemble. Déployé et vérifié en production.
- 2026-07-29 : **protection par mot de passe activée** sur `depensesjosh.brightlightmind.online` via cPanel « Confidentialité du répertoire » (Apache Basic Auth, réalm "Budget Josh"). Le site était auparavant accessible sans authentification à quiconque avait le lien. Vérifié : renvoie `401` + `WWW-Authenticate` tant qu'on n'est pas authentifié.
- 2026-07-29 : **refonte mobile + PWA + nettoyage** (en local, à téléverser — pas testé en navigateur réel dans cette session, autorisation d'accès locale refusée). `app-v6.js` réécrit en cartes par budget (plus de tableau à défilement horizontal) ; `header-controls.js`, `sheet-polish-fixed.js`, `entry-display.js`, `sheet-summary.js` supprimés, leur rôle absorbé directement dans `app-v6.js` (élimine le patron MutationObserver+fetch à risque de boucle, plutôt que de le corriger) ; la préservation des brouillons au clic sur le toggle a été fusionnée dans `draft-flow.js`. `index.php` a maintenant les vraies balises PWA (manifest, apple-touch-icon, theme-color) et enregistre le service worker — aucun des deux n'était chargé avant. Icônes PWA créées (`icon-192.png`, `icon-512.png`), le manifest avait `icons:[]` avant. Nettoyage : `app-v3/4/5.js`, `app-db.js`, `grace-date.js`, `header-delete.js`, `header-edit.js`, `goals-panel.js`, `goals-api.php`, `objectives-api.php`, et tous les `.sql` du dossier web supprimés. Effet de bord : grille Objectifs passée de 7 à 18 colonnes (plus large), non retravaillée pour mobile. Confirmé en production après réupload : cartes en ordre chronologique, dîme en premier, totaux exacts, aucune régression.
- 2026-07-29 : **remplacement complet des données de production** par les vraies données de l'utilisateur (avant : données de test). Deux budgets réels : projet « site authentiqueracine » (reçu 140 000, dîme 15 000) et « Grâce 2026-07 » (reçu 250 000, dîme 25 000), toutes les lignes au statut "prévu", datées du 29 juillet 2026. Fait via script PHP one-shot supprimé du serveur juste après exécution. Totaux vérifiés identiques à la capture de l'utilisateur.
