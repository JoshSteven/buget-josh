# Mémoire de travail — Budget Josh

## Projet

| Élément | Référence |
|---|---|
| Application | PWA personnelle de budgets et d’objectifs, pensée d’abord pour téléphone |
| Local | `D:\laragon\www\buget-josh` avec Laragon |
| Production | o2switch/cPanel — `https://depensesjosh.brightlightmind.online` |
| Stack | PHP 8.3, MySQL, JavaScript/CSS natifs, Composer, npm/Playwright |
| Mémoire détaillée | `PROJECT_MEMORY_V2.md` et `memory/projects/budget-josh.md` |

## Navigation validée

1. Mes budgets
2. Mes objectifs
3. Lier mes dépenses
4. Tableau de bord

- Sur téléphone : barre fixe inférieure à 4 icônes, libellés courts et zone sûre iOS/Android.
- Sur ordinateur : navigation horizontale à 4 boutons dans l’en-tête.

## Invariants

- Données de production personnelles : sauvegarde SQL avant toute migration.
- Ne jamais versionner `config.php`, `.env`, `notification-secrets.php` ou une clé privée.
- **Toute nouvelle page ou API doit appeler `budgetRequireAuthPage()` ou `budgetRequireAuthApi()`** (`auth.php`). Depuis le lot 8 il n’y a plus de Basic Auth : cette garde est la seule protection des données financières.
- **Le `.htaccess` de la racine n’est pas versionné** (exclu du rsync, `--exclude=/.htaccess`). Il contient `DirectoryIndex index.php`, `Options -Indexes`, le blocage de `/vendor/` et celui des manifestes de dépendances. S’il est perdu ou réécrit par cPanel, ces protections disparaissent **sans erreur visible** — le vérifier après toute manipulation de « Confidentialité du répertoire ».
- Toute nouvelle migration doit être ajoutée aux exceptions `!database/...` de `.gitignore`, sinon elle n’est jamais versionnée.
- `nature` reste facultative et n’est jamais associée automatiquement à un bucket.
- Les dépenses annulées sont exclues des totaux.
- Les liaisons ciblent `goal_tasks` et utilisent `ON DELETE SET NULL`.
- Interface en français, montants en F CFA, priorité au mobile et aux actions tactiles de 44 px environ.

## Objectifs — modèle actif

- Un objectif possède une illustration, une catégorie facultative et des repères de plan facultatifs.
- Ses étapes sont datées et utilisent `planned`/`realised`.
- Progression = étapes terminées / étapes totales.
- Prochaine action = première étape non terminée par ordre de date.
- Tiroir visuel en bas sur mobile, latéral sur ordinateur.
- Rappels internes + Web Push VAPID + Cron quotidien ; test immédiat disponible dans l’application.

## Préférences de collaboration

- Expliquer brièvement la couche concernée, l’outil utilisé et la preuve obtenue pendant le développement.
- Préférer les schémas, illustrations et parcours visuels aux longs blocs de texte.
- Tester, mettre à jour la mémoire, commit et push à la fin d’un lot validé.
