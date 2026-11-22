import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";

vi.mock("../../config/env", () => ({
  env: {
    jwt: {
      accessSecret: "access-secret-de-test",
      refreshSecret: "refresh-secret-de-test",
      accessExpiresIn: "15m",
      refreshExpiresIn: "7d",
    },
  },
}));

import { apiClientKey, fileStreamKey } from "../rateLimit";
import { signAccessToken, signFileToken, signRefreshToken } from "../../utils/jwt";

function makeReq(init: {
  authorization?: string;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  ip?: string;
}) {
  return {
    headers: { authorization: init.authorization },
    cookies: init.cookies ?? {},
    query: init.query ?? {},
    ip: init.ip ?? "41.82.0.1",
  } as never;
}

describe("rateLimit — cles par compte plutot que par IP (NAT du campus)", () => {
  it("un access token valide donne une cle par compte", () => {
    const token = signAccessToken({ sub: "user-1", role: Role.STUDENT, sv: 0 });
    expect(apiClientKey(makeReq({ authorization: `Bearer ${token}` }))).toBe("user:user-1");
  });

  it("deux etudiants derriere la meme IP ont deux compteurs distincts", () => {
    const a = signAccessToken({ sub: "user-a", role: Role.STUDENT, sv: 0 });
    const b = signAccessToken({ sub: "user-b", role: Role.STUDENT, sv: 0 });
    expect(apiClientKey(makeReq({ authorization: `Bearer ${a}` }))).not.toBe(
      apiClientKey(makeReq({ authorization: `Bearer ${b}` }))
    );
  });

  it("sans access token, un cookie de session authentique identifie le compte", () => {
    const cookie = signRefreshToken({ sub: "user-1", role: Role.STUDENT, sv: 0, jti: "j", fam: "f" });
    expect(apiClientKey(makeReq({ cookies: { refreshToken: cookie } }))).toBe("user:user-1");
  });

  it("un jeton fabrique (mauvaise signature) retombe sur l'IP : impossible de choisir sa cle", () => {
    const forged = jwt.sign({ sub: "victime", role: "STUDENT" }, "autre-secret");
    expect(apiClientKey(makeReq({ authorization: `Bearer ${forged}`, ip: "1.2.3.4" }))).toBe("ip:1.2.3.4");
    expect(apiClientKey(makeReq({ cookies: { refreshToken: forged }, ip: "1.2.3.4" }))).toBe("ip:1.2.3.4");
  });

  it("un jeton de fichier ne vaut pas identification sur l'API", () => {
    const fileToken = signFileToken({ sub: "user-1", sv: 0, tdId: "td-1", scope: "view", purpose: "file" });
    expect(apiClientKey(makeReq({ authorization: `Bearer ${fileToken}`, ip: "1.2.3.4" }))).toBe("ip:1.2.3.4");
  });

  it("visiteur anonyme : cle par IP", () => {
    expect(apiClientKey(makeReq({ ip: "1.2.3.4" }))).toBe("ip:1.2.3.4");
  });

  it("flux PDF : la cle est le compte du jeton de fichier", () => {
    const fileToken = signFileToken({ sub: "user-1", sv: 0, tdId: "td-1", scope: "view", purpose: "file" });
    expect(fileStreamKey(makeReq({ query: { token: fileToken } }))).toBe("user:user-1");
  });

  it("flux PDF : un jeton invalide retombe sur l'IP", () => {
    expect(fileStreamKey(makeReq({ query: { token: "n-importe-quoi" }, ip: "1.2.3.4" }))).toBe("ip:1.2.3.4");
  });
});
