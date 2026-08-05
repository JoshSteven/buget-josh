# État global du projet — Référence pour migration Claude

Dernière mise à jour : 5 août 2026.

Ce fichier complète \`PROJECT_MEMORY_V2.md\` et récapitule précisément ce qui a été fait dans tous les lots. Claude doit l’utiliser comme feuille de relais pour la migration de la base et le déploiement.

## Règle importante

Les données de production sont des données financières personnelles réelles. Faire un export SQL avant toute migration. Ne pas enregistrer de mot de passe dans les fichiers du projet.

## État des lots

### Lot 0 — Sécuriser

Statut : fait.

- La pratique d’export SQL avant migration est actée.
- L’export existant est \`database/sc1tijo0515_depenses_budgetjosh.sql\`.
- Attention : cet export est antérieur aux dernières colonnes ajoutées ; refaire un export depuis la base active avant la prochaine migration.

### Lot 1a — Note facultative

Statut : code fait, migration déjà prévue dans le lot 2.

- Le formulaire et l’affichage utilisent le champ \`entries.note\`.
- La valeur est facultative et limitée à 300 caractères.

### Lot 1b — Nature analytique

Statut : code fait, migration déjà prévue dans le lot 2.

- Le formulaire propose les 14 natures validées.
- La nature reste indépendante du bucket Priorités / Petits chiens.
- Aucune correspondance nature → bucket n’est codée en dur.

### Lot 1c — Statut « Annulée »

Statut : code fait, migration déjà prévue dans le lot 2.

- \`cancelled\` est accepté par \`update-status.php\`.
- Les lignes annulées restent visibles mais sont exclues des totaux.
- Les boutons Annuler / Restaurer existent déjà.
- Les boutons ou actions manuelles liés aux anciennes anomalies ne sont pas un chantier prioritaire.

### Lot 1d — Récurrence

Statut : reporté.

- Aucune génération automatique de dépenses récurrentes n’a été ajoutée.

### Lot 2 — Pilotage

Statut : implémenté localement, migration et déploiement à faire.

Fichiers ajoutés :

- \`pilotage.php\`
- \`pilotage.js\`
- \`limits-api.php\`
- \`database/lot-2-migration.sql\`

Fonctionnalités :

- Reçu, Réalisé, Prévu, Disponible réel et Disponible engagé.
- Filtre par budget.
- Répartition Priorités / Petits chiens.
- Top 3 des natures.
- Plafonds configurables en montant fixe ou pourcentage des revenus.
- Alerte préventive à 80 % et critique à partir de 100 %.
- Table \`budget_limits\`.

### Lot 3 — Objectifs mobiles

Statut : implémenté localement, déploiement à faire.

Fichiers refondus :

- \`objectives.php\`
- \`objectives.js\`
- \`goals-grid-api.php\`

Fonctionnalités :

- Vue cartes par objectif, adaptée au téléphone.
- Sélecteur de mois, avec le mois courant par défaut.
- Ajout et changement de statut des actions.
- Progression par objectif.
- Vue grille 18 mois conservée en vue secondaire.
- Modification du nom d’un objectif.
- Suppression confirmée d’un objectif global et de ses actions.
- Détection visuelle des objectifs portant exactement le même nom ; aucune suppression automatique.

### Lot 4 — Liaison et hors connexion

Statut : avancé localement, migration et test réel à faire.

Fichiers ajoutés ou modifiés :

- \`liaison.php\`
- \`liaison.js\`
- \`links-api.php\`
- \`database/lot-4-migration.sql\`
- \`offline-sync.js\`
- \`sw.js\`
- \`goals-link.js\`

Fonctionnalités :

- Liaison facultative d’une dépense avec une action mensuelle précise.
- La liaison est gérée depuis une page dédiée pour ne pas réécrire le formulaire principal.
- Ajout de \`entries.goal_task_id\`, nullable, avec \`ON DELETE SET NULL\`.
- File locale des écritures hors connexion dans \`localStorage\`.
- Rejeu des écritures au retour du réseau.
- Cache du dernier bootstrap.
- Cache PWA de l’écran Budgets et de ses scripts.

## Ordre de migration base pour Claude

1. Faire un nouvel export SQL de la base active.
2. Vérifier que les migrations des lots 1a/1b/1c ont déjà été appliquées.
3. Exécuter \`database/lot-2-migration.sql\`.
4. Exécuter \`database/lot-4-migration.sql\`.
5. Vérifier les colonnes \`entries.note\`, \`entries.nature\`, \`entries.goal_task_id\`, le statut \`cancelled\` et la table \`budget_limits\`.
6. Vérifier les contraintes et l’absence de perte de données.

Les migrations doivent être exécutées dans cet ordre : le lot 4 dépend de \`goal_tasks\`, et le code actuel du lot 2 dépend déjà des colonnes \`note\`, \`nature\` et du statut \`cancelled\`.

## Déploiement fichiers

Après migration :

- Déployer les fichiers PHP/JS/SQL nécessaires via cPanel.
- Vérifier les longueurs ou hash exacts après upload.
- Ouvrir un nouvel onglet pour éviter le cache.
- Tester Budgets, Pilotage, Objectifs, Liaisons et un scénario hors connexion.
- Ne pas modifier les données manuellement pendant ce relais.

## Vérifications déjà effectuées

- Syntaxe PHP validée pour les nouvelles pages et APIs.
- Syntaxe JavaScript validée avec Node.js 22.
- MySQL local n’était pas démarré ; aucune migration n’a été exécutée localement.
- Le navigateur intégré n’est pas contrôlable directement depuis cette session.

## Historique Git

- \`e2cfd15\` — Lot 2 pilotage et lot 3 objectifs mobiles.
- \`d083cb9\` — Avancer le lot 4 liaison et hors connexion.
- Branche actuelle : \`master\`.
- État au moment de cette mise à jour : propre.
