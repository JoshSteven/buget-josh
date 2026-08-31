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

## Invariants

- Données de production personnelles : sauvegarde SQL avant toute migration.
- Ne jamais versionner `config.php`, `.env`, `notification-secrets.php` ou une clé privée.
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
