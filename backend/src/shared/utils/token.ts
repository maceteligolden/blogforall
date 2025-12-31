import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    throw new Error("ACCESS_SECRET is not defined");
  }
  return jwt.sign(payload, secret, { expiresIn: "15m" });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) {
    throw new Error("REFRESH_SECRET is not defined");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

export const verifyToken = (token: string, secret: string): TokenPayload => {
  return jwt.verify(token, secret) as TokenPayload;
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    throw new Error("ACCESS_SECRET is not defined");
  }
  return verifyToken(token, secret);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) {
    throw new Error("REFRESH_SECRET is not defined");
  }
  return verifyToken(token, secret);
};
