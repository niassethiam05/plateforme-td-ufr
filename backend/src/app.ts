import express from "express";
import type { Request } from "express";
import cors from "cors";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Depuis backend/dist (ou backend/src en developpement) vers frontend/dist.
const FRONTEND_DIST_DIR = path.resolve(__dirname, "../../frontend/dist");

/**
 * URL journalisee, sans la valeur des jetons passes en query string : le jeton
 * de fichier (/api/td/:id/file/...?token=) et surtout le lien de
 * reinitialisation de mot de passe (/reinitialiser-mot-de-passe?token=), qui
 * vaut un acces au compte et ne doit pas finir dans les journaux du serveur.
 */
morgan.token("safe-url", (req) =>
  ((req as Request).originalUrl ?? req.url ?? "").replace(/([?&]token=)[^&]*/g, "$1[masque]")
);

const LOG_FORMAT_DEV = ":method :safe-url :status :response-time ms - :res[content-length]";
const LOG_FORMAT_PROD =
  ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

export function createApp() {
  const app = express();

  // Derriere un reverse proxy (nginx, Traefik, un load balancer), req.ip vaut
  // l'IP du proxy pour toutes les requetes. Sans ce setting, le rate limit
  // par IP devient GLOBAL : les tentatives de login de toute l'UFR
  // partageraient le meme compteur, et un attaquant pourrait deny de service
  // l'authentification de la plateforme en epuisant le quota depuis une seule
  // adresse. `1` (valeur par defaut de TRUST_PROXY) fait confiance au premier
  // saut (le proxy) uniquement — mettre un nombre plus eleve quand plusieurs
  // proxys se chainent. Pour verifier la valeur : l'adresse en tete de chaque
  // ligne du journal doit etre celle du visiteur, pas celle d'un proxy.
  app.set("trust proxy", env.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? LOG_FORMAT_DEV : LOG_FORMAT_PROD));

  // Garde-fou global : plafonne toute l'API, pas seulement les routes
  // explicitement protegees ci-dessous. Sans lui, le catalogue public et les
  // routes de lecture n'ont aucune limite et restent des points d'entree
  // gratuits pour saturer la base.
  //
  // Le quota est volontairement large (1000 / 15 min, soit ~66 requetes/min)
  // parce qu'il est clef par IP : sur un campus, les etudiants passent par un
  // NAT et partagent une seule adresse. Une limite etroite ferait plafonner
  // tout l'UFR d'un coup — exactement l'effet deny de service qu'on cherche a
  // eviter. Ce garde-fou vise les flots anormaux, pas
  // l'usage normal ; les operations reellement couteuses (upload, apercu de
  // PDF, signalements, auth) ont leurs propres limiteurs plus serres.
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "TooManyRequests", message: "Trop de requêtes, veuillez réessayer." },
  });
  app.use("/api", globalLimiter);

  // Les routes d'authentification ont leurs propres limiteurs, poses route
  // par route dans auth.routes.ts (voir middleware/rateLimit). Un plafond
  // unique par IP sur tout /api/auth englobait /refresh, appele a chaque
  // chargement de page : derriere le NAT d'un campus, quelques dizaines
  // d'etudiants suffisaient a bloquer la connexion de tout le monde.

  app.use("/api", routes);

  // Une route /api inconnue reste un 404 JSON : elle ne doit pas tomber dans
  // le repli ci-dessous et renvoyer la page HTML du site.
  app.use("/api", notFoundHandler);

  if (env.serveFrontend) {
    if (!fs.existsSync(path.join(FRONTEND_DIST_DIR, "index.html"))) {
      throw new Error(
        `SERVE_FRONTEND=true mais ${FRONTEND_DIST_DIR} est introuvable : lancez d'abord "npm run build".`
      );
    }

    // Les fichiers de /assets portent une empreinte dans leur nom (Vite) :
    // ils peuvent etre mis en cache indefiniment. index.html, lui, doit
    // toujours etre relu, sinon un navigateur garderait une ancienne version
    // du site apres un deploiement.
    app.use(
      "/assets",
      express.static(path.join(FRONTEND_DIST_DIR, "assets"), { immutable: true, maxAge: "1y" })
    );
    // Un fichier absent de /assets est une vraie erreur 404, pas une route du
    // site : sans cela, le repli ci-dessous renverrait la page HTML a la
    // place d'un script, ce qui masque le probleme.
    app.use("/assets", notFoundHandler);
    app.use(express.static(FRONTEND_DIST_DIR, { index: false }));

    // Repli de l'application monopage : toute autre adresse (/catalogue,
    // /fiches/:id, ...) est une route geree par React Router cote navigateur.
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
