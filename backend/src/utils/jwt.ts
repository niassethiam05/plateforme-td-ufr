import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}
