-- Lot 4 — Liaison dépense / objectif
-- Faire un export SQL avant exécution. Migration à exécuter une seule fois.

ALTER TABLE \`entries\`
  ADD COLUMN IF NOT EXISTS \`goal_task_id\` char(36) DEFAULT NULL AFTER \`nature\`;

ALTER TABLE \`entries\`
  ADD CONSTRAINT \`entries_goal_task_fk\`
  FOREIGN KEY (\`goal_task_id\`) REFERENCES \`goal_tasks\` (\`id\`) ON DELETE SET NULL;
