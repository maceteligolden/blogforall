import { Response } from "express";
import { HttpStatus } from "../constants";

export interface ResponseOptions {
  res: Response;
  code: number;
  message: string;
  data?: unknown;
  error?: unknown;
}

export const sendResponse = (options: ResponseOptions): void => {
  const { res, code, message, data, error } = options;
  const responseBody: Record<string, unknown> = {
    message,
  };
  
  if (data !== undefined) {
    responseBody.data = data;
  }
  
  if (error !== undefined) {
    responseBody.error = error;
  }
  
  res.status(code).json(responseBody);
};

export const sendSuccess = (res: Response, message: string, data?: unknown): void => {
  sendResponse({ res, code: HttpStatus.OK, message, data });
};

export const sendCreated = (res: Response, message: string, data?: unknown): void => {
  sendResponse({ res, code: HttpStatus.CREATED, message, data });
};

export const sendNoContent = (res: Response, message: string): void => {
  sendResponse({ res, code: HttpStatus.NO_CONTENT, message });
};
