-- Les enseignants crees avant l'introduction de teacher_approved_at ont la
-- colonne a NULL alors qu'ils sont actifs, donc deja valides de fait. Sans
-- rattrapage, les desactiver les ferait apparaitre comme "a valider" (jamais
-- valides) au lieu de "desactives". On reprend la date de creation du compte,
-- seule date connue.
--
-- Les enseignants inactifs sont laisses tels quels : rien ne permet de
-- distinguer ceux qui attendent une validation de ceux qui auraient ete
-- desactives avant cette migration.
UPDATE "users"
SET "teacher_approved_at" = "created_at"
WHERE "role" = 'TEACHER'
  AND "is_active" = true
  AND "teacher_approved_at" IS NULL;
