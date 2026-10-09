import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  // Derriere un reverse proxy (nginx, Traefik, un load balancer), req.ip vaut
  // l'IP du proxy pour toutes les requetes. Sans ce setting, le rate limit
  // par IP devient GLOBAL : les tentatives de login de toute l'UFR
  // partageraient le meme compteur, et un attaquant pourrait deny de service
  // l'authentification de la plateforme en epuisant le quota depuis une seule
  // adresse. `1` fait confiance au premier saut (le proxy) uniquement —
  // mettre un nombre plus eleve quand plusieurs proxys se chainent.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}