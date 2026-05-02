import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Default allowed origins for development
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3001",
    "https://blogforall-ij6u.onrender.com",
  ];

  const allowedOrigins = env.frontend.urls.length > 0 ? [...env.frontend.urls, ...defaultOrigins] : defaultOrigins;

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  // In development, allow any localhost origin or configured origins
  if (env.isDevelopment) {
    if (
      origin &&
      (uniqueOrigins.includes(origin) || (origin.includes("localhost") && origin.match(/^http:\/\/localhost:\d+$/)))
    ) {
      res.header("Access-Control-Allow-Origin", origin);
    } else if (origin) {
      res.header("Access-Control-Allow-Origin", "*");
    }
  } else {
    // In production, only allow configured origins
    if (origin && uniqueOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-access-key-id, x-secret-key");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
};
