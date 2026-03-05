import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { BadRequestError } from "../errors";

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
      validatedParams?: unknown;
      validatedBody?: unknown;
    }
  }
}

/**
 * PSEUDOCODE (middleware factory):
 * 1. RETURN middleware that: GET raw from req[source] (query|params|body)
 * 2. PARSE raw with schema
 * 3. IF success: ASSIGN parsed to req.validatedQuery|validatedParams|validatedBody, next()
 * 4. ON ZodError: next(BadRequestError with flattened message)
 * 5. ON other error: next(error)
 */
function validate(schema: ZodSchema, source: "query" | "params" | "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const raw = source === "query" ? req.query : source === "params" ? req.params : req.body;
      const parsed = schema.parse(raw);
      if (source === "query") req.validatedQuery = parsed;
      else if (source === "params") req.validatedParams = parsed;
      else req.validatedBody = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        next(new BadRequestError(message));
      } else {
        next(error);
      }
    }
  };
}

export const validateQuery = (schema: ZodSchema) => validate(schema, "query");
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
export const validateBody = (schema: ZodSchema) => validate(schema, "body");
