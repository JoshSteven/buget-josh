# Budget Josh — état du projet et mode opératoire

Dernière mise à jour : 2 septembre 2026

## Vue d’ensemble

Budget Josh est une PWA personnelle francophone de budgets et de planification d’objectifs : PHP 8.3/PDO côté serveur, MySQL/MariaDB, HTML/CSS/JavaScript natifs côté client, Service Worker et Web Push VAPID.

Le dépôt local est `D:\laragon\www\buget-josh`. Le dépôt GitHub est `JoshSteven/buget-josh`. La branche de référence actuelle est `master`, synchronisée avec `origin/master`.

## Workflow Git de référence

1. Lire `CLAUDE.md`, cette fiche, puis `memory/projects/budget-josh.md` avant d’intervenir.
2. Faire une revue du besoin et du flux avant le code : logique manquante, données touchées, risques, dépendances et critères d’acceptation.
3. Travailler par lot cohérent, avec des commits petits et descriptifs.
4. Vérifier proportionnellement au risque : syntaxe PHP/JS, tests Playwright, API, responsive et accessibilité.
5. En fin de lot, relire le diff (`git diff --check`), confirmer que seuls les fichiers du lot sont staged, puis `git commit`.
6. Après validation, `git push origin master`, puis `git pull` seulement lorsque cela sert à resynchroniser ou contrôler l’état distant ; ce n’est pas une obligation avant de commencer.
7. Noter le commit et les résultats dans la mémoire.

Ce séquencement décrit le flow de livraison souhaité : on avance, on termine, on commit et on pousse. Les vérifications de statut et de branche restent utiles comme garde-fous, mais ne doivent pas alourdir inutilement chaque intervention.

Le push n’est pas une preuve de qualité : la preuve est le couple **tests/audit + diff relu**. Tout changement de schéma ou de données de production exige une sauvegarde SQL avant migration.

## Déploiement utilisé

### GitHub → O2Switch/cPanel

Pour ce projet, le flux privilégié est GitHub puis cPanel **Git™ Version Control** : pousser le commit sur GitHub, lancer `Update from Remote`, puis `Deploy HEAD Commit`. Vérifier que le HEAD affiché par cPanel correspond au commit poussé et effectuer un smoke test de l’URL de production.

### SSH depuis le PC

Pour les autres projets où le remote cPanel est configuré en SSH, utiliser le terminal local/SSH déjà configuré. Vérifier `git remote -v`, la branche distante et la cible avant tout push. Ne pas mélanger un push GitHub et un déploiement SSH sans savoir quelle source fait foi.

## Règles de sécurité et de coordination

- Ne jamais versionner `config.php`, `.env`, `notification-secrets.php`, clés privées ou mots de passe.
- Une migration doit être idempotente, versionnée et testée localement avant production.
- Une modification d’un autre intervenant reste intacte ; si elle est staged par erreur, la désolidariser avant le commit du lot courant.
- En cas de conflit ou de choix d’architecture, expliquer les options et demander une décision plutôt que choisir silencieusement.

## Historique utile

- L’ancien Basic Auth a été remplacé par l’authentification applicative du lot 8 ; vérifier `budgetRequireAuthPage()`/`budgetRequireAuthApi()` sur toute nouvelle page ou API.
- Les notifications Web Push ont été testées sur téléphone ; Chrome Android peut les classer en blocage anti-spam, à lever via la réinitialisation des données du site.
- La navigation mobile est une barre inférieure fixe à quatre destinations ; sur ordinateur elle reste horizontale.
- Les icônes PWA et le logo portefeuille `$`/flèche/JOSH ont été actualisés.

## Lot 9 — récurrence, export et UX mobile

- Commit local validé : `6f2b563` (`Ajouter recurrence et ameliorer UX mobile`).
- Dépenses récurrentes mensuelles : création, pause, suppression et génération CLI via `cron-recurring-expenses.php`.
- Migration versionnée : `database/lot-9-recurring-expenses.sql`, appliquée et testée localement après sauvegarde.
- Export structuré CSV compatible Excel : toutes les dépenses, avec une colonne par budget.
- UX : aucun budget ouvert automatiquement, sélection explicite, icônes SVG cohérentes pour Objectifs et contrôles mobiles renforcés.
- Preuves : 34/34 tests Playwright, lint PHP/JavaScript et `git diff --check` validés.
- État livraison : commit local prêt à pousser ; cPanel n'a pas encore été synchronisé ni déployé.

## Prochain chantier connu

Le lot Pilotage reste le prochain chantier fonctionnel prioritaire : disponible réel vs engagé, répartition et alertes de limite par catégorie. Les notifications Push et les Cron restent à revalider après le prochain déploiement réel.
