import { createApp } from "./app";
import { env } from "./config/env";
import { purgeExpiredRefreshTokens } from "./services/token.service";

const app = createApp();

// Nettoyage des refresh tokens expires : la table croit a chaque connexion et
// a chaque rotation, donc elle doit etre purgee. Un premier passage au
// demarrage evacue ce qui a expire pendant que le processus etait arrete.
const REFRESH_TOKEN_PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

purgeExpiredRefreshTokens()
  .then((count) => {
    if (count > 0) {
      console.log(`${count} refresh token(s) expire(s) supprime(s) au demarrage.`);
    }
  })
  .catch((err) => console.error("Echec du nettoyage des refresh tokens:", err));

const purgeTimer = setInterval(() => {
  purgeExpiredRefreshTokens().catch((err) =>
    console.error("Echec du nettoyage des refresh tokens:", err)
  );
}, REFRESH_TOKEN_PURGE_INTERVAL_MS);
// Ne maintient pas le processus en vie pour ce seul timer.
purgeTimer.unref();

const server = app.listen(env.port, () => {
  console.log(`Backend demarre sur http://localhost:${env.port} (${env.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`${signal} recu, arrete du serveur...`);
  clearInterval(purgeTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));