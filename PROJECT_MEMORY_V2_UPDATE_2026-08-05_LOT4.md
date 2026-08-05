# Mise à jour mémoire V2 — Lot 4 — 5 août 2026

## Décision de périmètre

Le lot 4 est avancé avec une liaison facultative entre une dépense et une action mensuelle précise. L’action porte déjà son objectif global, son mois et son titre ; aucun rattachement nature → bucket n’est ajouté.

## Liaison dépense / objectif

- \`database/lot-4-migration.sql\` ajoute \`entries.goal_task_id\`, nullable, avec \`ON DELETE SET NULL\`.
- \`links-api.php\` expose les dépenses et les actions, puis enregistre ou retire une liaison.
- \`liaison.php\` / \`liaison.js\` ajoutent une page mobile dédiée pour associer les dépenses existantes à une action.
- Le lien « Liaisons » est disponible depuis la navigation Budgets.

Cette première étape évite de réécrire le formulaire de saisie principal. La liaison peut être faite après création de la dépense.

## Hors connexion

- \`offline-sync.js\` intercepte les écritures de dépenses et de statuts lorsque le réseau tombe.
- Les requêtes sont conservées dans \`localStorage\`, puis rejouées au retour du réseau.
- Le dernier bootstrap est mis en cache et les nouvelles dépenses hors connexion sont ajoutées à ce cache pour rester visibles pendant la session.
- \`sw.js\` met en cache l’écran budgets et ses scripts avec une stratégie réseau d’abord, cache de secours ensuite.

## État

Lot 4 avancé localement, mais migration SQL et test réel de synchronisation non exécutés : MySQL local n’était pas démarré et aucun test navigateur interactif n’est disponible dans cette session.

## Pré-requis de déploiement

1. Export SQL de sauvegarde.
2. Exécuter d’abord la migration du lot 2 si elle n’a pas encore été appliquée, puis \`database/lot-4-migration.sql\`.
3. Tester un lien dépense/action et un passage hors ligne en production.
4. Vérifier les longueurs/hash des fichiers après upload cPanel.
