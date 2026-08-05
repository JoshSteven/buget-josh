# Mise à jour mémoire V2 — Lot 3 — 5 août 2026

## Passage depuis le lot 2

Le lot 2 « Pilotage » est implémenté localement mais n’est pas encore déployé en production. Les fichiers concernés sont \`pilotage.php\`, \`pilotage.js\`, \`limits-api.php\` et \`database/lot-2-migration.sql\`. La migration doit être exécutée après un nouvel export SQL de sauvegarde et après démarrage de MySQL local pour validation.

## Lot 3 — Objectifs mobiles

La page Objectifs a été refondue :

- \`objectives.php\` affiche désormais les cartes comme vue principale.
- \`objectives.js\` propose un sélecteur de mois, avec le mois courant sélectionné par défaut.
- Chaque objectif est une carte avec progression globale, actions du mois choisi, bouton de statut et ajout d’action.
- La grille 18 mois reste disponible avec le bouton « Vue grille » pour les utilisateurs qui veulent la vue d’ensemble.
- Le choix cartes/grille est conservé dans \`localStorage\`.
- L’édition du nom d’un objectif est conservée.
- La suppression d’un objectif global est disponible avec confirmation ; elle supprime aussi ses actions via la contrainte de cascade MySQL.
- Les objectifs portant exactement le même nom sont signalés comme doublons, mais aucun doublon n’est supprimé automatiquement.
- La vue Objectifs contient maintenant des liens vers Budgets et Pilotage.

## API

\`goals-grid-api.php\` conserve les actions existantes et ajoute \`track_delete\`.

## Vérification

- Syntaxe PHP validée avec PHP 8.2 pour \`objectives.php\` et \`goals-grid-api.php\`.
- Syntaxe JavaScript validée avec Node.js 22 pour \`objectives.js\`.
- Aucun test navigateur ou test SQL direct effectué dans cette session : MySQL local n’était pas démarré et le navigateur intégré n’est pas contrôlable directement depuis cette session.

## Prochaine étape

Faire une validation visuelle sur téléphone et ordinateur, puis corriger les détails d’ergonomie éventuels avant déploiement. Ensuite, effectuer le déploiement du lot 2 et du lot 3 après export SQL et vérification des longueurs/hash des fichiers sur cPanel.
