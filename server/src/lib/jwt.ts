import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me-min-32-chars";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me-min-32-chars";
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";

export interface AccessPayload {
  sub: string;
  email: string;
  role: string;
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions);
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function signRefresh(payload: { sub: string }): string {
  const ttl = process.env.REFRESH_TOKEN_TTL ?? "7d";
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: ttl } as jwt.SignOptions);
}

export function verifyRefresh(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
