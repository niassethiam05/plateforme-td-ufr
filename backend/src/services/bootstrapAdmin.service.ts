import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const SALT_ROUNDS = 12;

/** Plus exigeant que pour un compte ordinaire : ce compte a tous les droits. */
const MIN_ADMIN_PASSWORD_LENGTH = 12;

export type BootstrapAdminResult =
  | "created"
  | "skipped-not-configured"
  | "skipped-admin-exists"
  | "skipped-invalid";

/**
 * Cree le premier compte administrateur a partir de ADMIN_EMAIL et
 * ADMIN_PASSWORD, au demarrage du serveur.
 *
 * L'inscription publique refuse le role ADMIN, et le seed de demonstration
 * cree des comptes dont le mot de passe est ecrit dans le README : il ne doit
 * jamais tourner en production. Sans ce mecanisme, une installation neuve
 * n'aurait donc aucun moyen propre d'obtenir son premier administrateur.
 *
 * Ne fait rien des qu'un administrateur existe, quel qu'il soit : les
 * variables ne peuvent ni recreer un compte, ni changer un mot de passe, ni
 * promouvoir un compte existant. Une fois le compte cree, ADMIN_PASSWORD peut
 * (et devrait) etre retire de la configuration.
 */
export async function bootstrapAdmin(): Promise<BootstrapAdminResult> {
  const { email, password } = env.bootstrapAdmin;
  if (!email || !password) return "skipped-not-configured";

  const existingAdmins = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (existingAdmins > 0) return "skipped-admin-exists";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("ADMIN_EMAIL n'est pas une adresse email valide : administrateur non cree.");
    return "skipped-invalid";
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    console.error(
      `ADMIN_PASSWORD doit contenir au moins ${MIN_ADMIN_PASSWORD_LENGTH} caracteres : administrateur non cree.`
    );
    return "skipped-invalid";
  }

  const emailTaken = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (emailTaken) {
    console.error(
      "ADMIN_EMAIL correspond deja a un compte non administrateur : administrateur non cree."
    );
    return "skipped-invalid";
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      firstName: "Administrateur",
      lastName: "Plateforme",
      role: Role.ADMIN,
    },
  });
  console.log(
    `Compte administrateur cree pour ${email}. Retirez ADMIN_PASSWORD de la configuration et changez le mot de passe depuis la page Profil.`
  );
  return "created";
}
