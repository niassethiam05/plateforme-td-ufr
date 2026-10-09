import { prisma } from "../config/prisma";

/**
 * Plafond de taille du cache applicatif (nombre d'entrees), pas une duree :
 * les entrees expirees sont retirees a chaque ecriture, et le cache est
 * vide au demarrage du processus — un redemarrage invalide donc immediatement
 * les sessions (comportement conservateur, correct pour la revocation).
 */
const MAX_ENTRIES = 5000;
const TTL_MS = 15_000;

interface CacheEntry {
  userId: string;
  role: string;
  isActive: boolean;
  sessionVersion: number;
  expiresAt: number;
}

/**
 * Cache court de l'etat d'un utilisateur, pour que requireAuth ne fasse pas
 * une requete base a chaque appel authentifie.
 *
 * Le delai de 15s est le compromis direct avec l'exigence de revocation : un
 * changement de mot de passe ou une desactivation met au mieux 15s a invalider
 * les sessions en cours. C'est un plancher de securite, pas une limite haute :
 * le pire cas (desactivation d'un compte compromis) reste borne a 15s, contre
 * 15 minutes sans ce cache.
 *
 * La cle est l'ID utilisateur seul : on ne peut pas y mettre le token, donc
 * deux tokens du meme utilisateur pendant la fenetre partagent le meme verdict.
 * C'est correct, l'utilisateur etant unique.
 */
const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string): string {
  return userId;
}

export async function getAuthUserState(userId: string): Promise<CacheEntry> {
  const key = cacheKey(userId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, sessionVersion: true },
  });

  if (!user) {
    // Mise en cache de l'absence : evite de requeter la base a chaque
    // requete pour un utilisateur inexistant ou supprime entre-temps.
    const entry: CacheEntry = {
      userId,
      role: "",
      isActive: false,
      sessionVersion: -1,
      expiresAt: Date.now() + TTL_MS,
    };
    cache.set(key, entry);
    return entry;
  }

  const entry: CacheEntry = {
    userId: user.id,
    role: user.role,
    isActive: user.isActive,
    sessionVersion: user.sessionVersion,
    expiresAt: Date.now() + TTL_MS,
  };
  cache.set(key, entry);

  if (cache.size > MAX_ENTRIES) {
    // Eviction des entrees les plus anciennes inserees (Map preserve l'ordre
    // d'insertion) plutot qu'un balayage complet du cache.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }

  return entry;
}

/**
 * A appeler apres toute operation qui doit invalider les sessions de
 * l'utilisateur (changement de mot de passe, desactivation, changement de
 * role). Invalide immediatement l'entree de cache : la prochaine requete
 * recharge l'etat depuis la base.
 */
export function invalidateAuthUserState(userId: string): void {
  cache.delete(cacheKey(userId));
}