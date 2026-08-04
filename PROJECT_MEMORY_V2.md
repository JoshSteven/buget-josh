# Mémoire projet — Dépenses Josh (V2)

Dernière mise à jour : 4 août 2026. Remplace `PROJECT_MEMORY.md` (V1) comme référence active — la V1 reste disponible pour l'historique détaillé (diagnostics, journal pas-à-pas des correctifs), mais **c'est cette V2 qui doit guider le travail à partir de maintenant.**

## But

Application personnelle de gestion de budgets et d'objectifs, pensée d'abord pour téléphone, qui remplace un tableur Excel. Deux objectifs explicites de l'utilisateur pour cette phase :
1. Que l'usage sur téléphone soit confortable et intuitif.
2. Avoir un système qui prévient quand une limite d'usage est atteinte sur une catégorie (Petits chiens ou Priorités).

## Emplacements

- Développement Laragon : `D:\laragon\www\buget-josh`
- Sous-domaine de production : `https://depensesjosh.brightlightmind.online`
- Base de production : `sc1tijo0515_depenses_budgetjosh`
- Export SQL de sauvegarde : `database/sc1tijo0515_depenses_budgetjosh.sql` (fait par l'utilisateur avant chaque migration — pratique désormais actée, voir Lot 0)

Ne jamais enregistrer de mot de passe dans ce fichier.

## Stack

HTML/CSS/JS natif (sans framework) + PHP + MySQL. Local : Laragon. Production : o2switch/cPanel. Déploiement des fichiers PHP/JS via l'API cPanel `Fileman::savefile` (contourne un bug de confirmation JS dans l'éditeur cPanel) — vérifier après coup par longueur/hash exacts, pas seulement visuellement.

## Acquis de la V1 (prérequis — tout ceci fonctionne et ne doit pas régresser)

- Boucle de requêtes infinie éliminée à la racine (plus de scripts satellites à `MutationObserver`).
- Sauvegarde multi-lignes stable (le bug de perte de lignes était un symptôme de la boucle ci-dessus).
- Feuille de budget en cartes mobiles (une carte par budget, ordre chronologique, plus de tableau à défilement horizontal).
- Séparation visuelle nette Priorités (vert) / Petits chiens (orange).
- Édition du libellé + montant d'une ligne de dépense (bouton ✎, action `expense_update`).
- Édition du nom d'un objectif global (bouton ✎, action `track_update`).
- Mois par défaut d'un nouveau budget calculé dynamiquement (plus de valeur codée en dur).
- Vraie PWA : manifest + icônes + service worker réellement chargés depuis `index.php`.
- Protection par mot de passe (Basic Auth cPanel) sur tout le sous-domaine.
- Données de production = vraies données personnelles depuis le 29 juillet 2026 (plus des données de test).

## Limitations actuelles (à traiter)

1. ~~Pas de suppression/annulation d'une dépense mal saisie.~~ **RÉSOLU** (lot 1c, bouton Annuler/Restaurer).
2. **Page Objectifs peu intuitive sur mobile.** L'utilisateur confirme explicitement que la saisie y est inconfortable et compliquée sur téléphone — refonte nécessaire (lot 3).
3. ~~Aucune catégorisation analytique des dépenses~~ **RÉSOLU** (lot 1b, champ nature).
4. **Aucun système d'alerte de limite** sur les catégories (Petits chiens/Priorités) — prochain chantier, lot 2.
5. Doublon détecté dans `goal_tracks` : « Se former en QSE » créé deux fois à la même seconde le 4 août 2026 (bug de double-soumission probable). Pas encore de bouton de suppression pour un objectif global — à traiter avec le lot 3.

## Hiérarchie des dépenses — nature analytique (validée le 4 août 2026)

Niveau 1 (obligatoire, inchangé) : **Priorité** ou **Petit chien**.
Niveau 2 (optionnel) : **nature**, une étiquette libre et indépendante du niveau 1.

**Règle explicite de l'utilisateur : la nature n'est jamais rattachée à un bucket (Priorité/Petit chien) de façon fixe dans le code.** C'est à lui de décider, dépense par dépense. Ne jamais coder une correspondance nature→bucket en dur.

| Nature | Statut | Exemples réels chez l'utilisateur |
|---|---|---|
| Foi / générosité | confirmée | Liberalité (offrande), les deux Dîmes |
| Charges essentielles | confirmée | piaement ONEA |
| Famille | confirmée | Aissata, Maman |
| Transport | confirmée | Essence |
| Outils professionnels | confirmée | Larago license, Investissement nom de domaine, Diplome recuperé, Coursera plus |
| Épargne / engagements financiers | reprise du doc initial | Tontine |
| Dettes / remboursements | reprise du doc initial (distincte d'Épargne) | Lionel remboursement |
| Plaisir / alimentation | reprise du doc initial | Bierre Nephta, degue anita, Charcuterie, Dejeuner midi, Repas resto ouaga2k |
| Loisirs | reprise du doc initial | Jeu achat, Injustice 2 game, Marvel guardians game, paiement jeu bioshock, Sortie avec les collegues |
| Télécoms / connectivité | reprise du doc initial | Wifi, unités |
| Abonnements numériques | ajout proposé | Chat gpt go & plus, Abonement Claude, Abonnement spotify, Abonnement gpt go |
| Équipement / matériel | ajout proposé | achat carte memoire 128go |
| Santé / bien-être | ajout proposé, proactif | — |
| Autre | renommée (remplace "À préciser") | Cota Assad operation, paiements et abonement, Paiement divers |

## Feuille de route (Lots, ordre de travail)

| Lot | Contenu | Statut |
|---|---|---|
| 0 — Sécuriser | Export MySQL avant migration | **Fait**, pratique actée |
| 1a — Note facultative | Champ note libre sur une ligne de dépense | **Fait** (4 août 2026) |
| 1b — Nature analytique | Colonne `nature` (nullable), sélecteur optionnel | **Fait** (4 août 2026) |
| 1c — Statut « Annulée » | 3ᵉ statut sur `entries.status`, exclu des totaux | **Fait** (4 août 2026) |
| 1d — Récurrence | Génération de dépenses récurrentes | Reporté, lot séparé |
| **2 — Pilotage** | Nouvelle page : disponible réel vs engagé, répartition, **alertes de limite par catégorie** | **À faire — prochain chantier** |
| 3 — Objectifs repensés | Cartes mobiles comme vue principale, grille en secondaire, corriger le doublon "Se former en QSE", ajouter suppression d'objectif global | Après le lot 2 |
| 4 — Liaison & hors ligne | Lien optionnel dépense-objectif, stratégie hors ligne | Reporté |

## Lots 1a/1b/1c — livrés le 4 août 2026

- Migration `entries` : colonnes `note` (varchar 300, nullable) et `nature` (varchar 40, nullable) ajoutées ; `status` étend l'énum à `'cancelled'`.
- `api.php` : action `expense` accepte `note`/`nature` optionnels ; bootstrap renvoie ces colonnes.
- `update-status.php` : accepte `cancelled` comme statut valide.
- `app-v6.js` : formulaire de brouillon avec note + nature (liste déroulante des 14 catégories) ; badge nature et note affichés par ligne ; boutons **Annuler**/**Restaurer** (soft-delete, exclut des totaux).
- `draft-flow.js` réécrit génériquement (label/amount/note/nature) pour que les nouveaux champs survivent au ré-affichage.
- **Découverte de déploiement** : un cache HTTP servait une version périmée de `app-v6.js`/`draft-flow.js` même après upload réussi (fichier serveur correct, seule la distribution était en cause). **Correctif** : `index.php` et `objectives.php` chargent les scripts avec `?v=<filemtime>` calculé dynamiquement en PHP — se met à jour automatiquement à chaque déploiement.
- Vérifié en production (nouvel onglet) : boutons ✎/Annuler/Restaurer, badges nature et notes fonctionnels.

## Limitation restante connue

La ligne fantôme `"null"` / 1 F CFA est toujours présente en production — annulable par l'utilisateur via le nouveau bouton Annuler. Pas encore fait au 4 août 2026.

## Prochaine étape

**Lot 2 — Pilotage.** Nouvelle page séparée de la saisie, avec :
- Reçu / Réalisé / Prévu / Disponible réel (revenus − réalisées) / Disponible engagé (revenus − réalisées − prévues).
- Répartition Priorités / Petits chiens et top 3 des natures les plus importantes.
- Alertes de limite par catégorie. Modalité du plafond (montant fixe vs pourcentage des revenus) encore à trancher avec l'utilisateur.

Ensuite, lot 3 (refonte Objectifs en cartes mobiles) puis lot 4 (liaison + hors ligne).
