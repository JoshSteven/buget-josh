-- Lot 11 : les récurrences suivent chaque budget Grâce mensuel au lieu d'un budget fixe.
-- Faire une sauvegarde SQL avant exécution. Idempotent : peut être rejoué sans effet de bord.
-- Aucune donnée supprimée : l'ancien budget_id est conservé pour l'historique mais n'est plus utilisé.

ALTER TABLE recurring_expenses MODIFY budget_id char(36) NULL DEFAULT NULL;
