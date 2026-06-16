import { HttpStatus } from "../constants";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class TokenLimitExceededError extends AppError {
  readonly code = "TOKEN_LIMIT_EXCEEDED";
  constructor(
    message: string = "Token limit reached",
    public readonly resetAt: Date
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class AiConcurrencyError extends AppError {
  readonly code = "AI_REQUEST_IN_PROGRESS";
  constructor(message: string = "Another AI request is already in progress") {
    super(message, HttpStatus.CONFLICT);
  }
}
