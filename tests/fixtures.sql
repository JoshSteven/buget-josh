-- Données fictives de la base de test (aucune donnée réelle).
-- Deux budgets : une Grâce de juillet 2026 et un Projet, avec des dépenses de chaque statut.

INSERT INTO budgets(id,kind,name,period_month,project_date) VALUES
 ('11111111-1111-4111-8111-111111111111','grace','Grâce 2026-07','2026-07',NULL),
 ('22222222-2222-4222-8222-222222222222','project','Site vitrine',NULL,'2026-07-10');

INSERT INTO budget_payments(id,budget_id,amount,label,payment_date) VALUES
 ('a1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',250000,'Salaire de juin','2026-06-30'),
 ('a2222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',140000,'Acompte client','2026-07-10');

INSERT INTO entries(id,budget_id,payment_id,type,amount,label,note,bucket,nature,status,entry_date,source) VALUES
 ('e1000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','expense',25000,'Dîme — Salaire de juin',NULL,'tithe',NULL,'realised','2026-06-30','budget'),
 ('e1000001-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111',NULL,'expense',15000,'Internet',NULL,'priority','Télécoms / connectivité','planned','2026-07-05','budget'),
 ('e1000001-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111',NULL,'expense',30000,'Loyer','Juillet','priority','Charges essentielles','realised','2026-07-02','budget'),
 ('e1000001-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111',NULL,'expense',12000,'Restaurant',NULL,'dogs','Plaisir / alimentation','realised','2026-07-12','budget'),
 ('e1000001-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111',NULL,'expense',9000,'Achat annulé',NULL,'dogs',NULL,'cancelled','2026-07-14','budget'),
 ('e1000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','a2222222-2222-4222-8222-222222222222','expense',14000,'Dîme — Acompte client',NULL,'tithe',NULL,'planned','2026-07-10','budget'),
 ('e1000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222',NULL,'expense',8000,'Nom de domaine',NULL,'priority','Outils professionnels','realised','2026-07-11','budget'),
 ('e1000002-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222',NULL,'expense',3500,'Café de travail',NULL,'dogs',NULL,'realised','2026-07-15','budget');
