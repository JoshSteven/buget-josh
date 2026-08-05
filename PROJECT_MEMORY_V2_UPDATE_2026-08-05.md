# Mise à jour mémoire V2 — 5 août 2026

## Lot 2 — Pilotage

Une première version de la page de pilotage a été implémentée localement :

- `pilotage.php` : page responsive séparée avec navigation Budgets / Objectifs.
- `pilotage.js` : filtre par budget, indicateurs Reçu / Réalisé / Prévu / Disponible réel / Disponible engagé, répartition Priorités / Petits chiens et top 3 des natures.
- `limits-api.php` : lecture et sauvegarde des plafonds dans la table `budget_limits`.
- `database/lot-2-migration.sql` : migration des colonnes `note`, `nature`, du statut `cancelled` et création de `budget_limits`.
- `goals-link.js` : ajout du lien Pilotage à côté d’Objectifs.

## Règles des alertes

- Les dépenses annulées sont exclues.
- La catégorie Priorités inclut les dépenses de bucket `tithe`.
- L’engagé = réalisé + prévu.
- Un plafond peut être un montant fixe ou un pourcentage des revenus du périmètre sélectionné.
- Alerte préventive à 80 %, alerte critique à partir de 100 %.
- Une valeur nulle désactive le plafond.

## Vérification

- Syntaxe PHP validée avec PHP 8.2 pour `pilotage.php` et `limits-api.php`.
- Syntaxe JavaScript validée avec Node.js 22 pour `pilotage.js`.
- MySQL local n’était pas démarré le 5 août 2026 ; la migration SQL n’a donc pas été exécutée localement.
- L’export SQL existant est antérieur aux colonnes `note` / `nature` / `cancelled` ; utiliser la migration avant un test local ou une nouvelle mise en production.

## Suivi de travail

Les changements sont actuellement non commités dans Git. Faire le commit après validation visuelle et test avec MySQL actif.
