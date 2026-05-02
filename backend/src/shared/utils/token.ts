import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  email: string;
  currentSiteId?: string; // Optional site context
  role?: string; // UserRole for admin checks without DB lookup
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = env.jwt.accessSecret;
  if (!secret) {
    throw new Error("ACCESS_SECRET is not defined");
  }
  return jwt.sign(payload, secret, { expiresIn: "15m" });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = env.jwt.refreshSecret;
  if (!secret) {
    throw new Error("REFRESH_SECRET is not defined");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

export const verifyToken = (token: string, secret: string): TokenPayload => {
  return jwt.verify(token, secret) as TokenPayload;
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = env.jwt.accessSecret;
  if (!secret) {
    throw new Error("ACCESS_SECRET is not defined");
  }
  return verifyToken(token, secret);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = env.jwt.refreshSecret;
  if (!secret) {
    throw new Error("REFRESH_SECRET is not defined");
  }
  return verifyToken(token, secret);
};
