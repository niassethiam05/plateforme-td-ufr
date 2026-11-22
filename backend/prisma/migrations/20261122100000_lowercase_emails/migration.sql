-- Les emails sont desormais enregistres en minuscules (validators/fields.ts).
-- On ramene les comptes existants a la meme forme, sauf ceux qui entreraient
-- en conflit avec un autre compte de meme adresse a la casse pres : ceux-la
-- restent tels quels (la connexion ignore la casse) et sont a fusionner a la
-- main par l'administration.
UPDATE "users" AS u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (
    SELECT 1 FROM "users" AS other
    WHERE other."id" <> u."id"
      AND lower(other."email") = lower(u."email")
  );
