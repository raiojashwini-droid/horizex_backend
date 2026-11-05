import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.util';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any[];

  constructor(message: string, statusCode = 400, code = 'APP_ERROR', details?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message,
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Invalid request parameters', 400, details);
  }

  // Handle Custom Application Errors
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'UNAUTHORIZED', 'Invalid authentication token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'TOKEN_EXPIRED', 'Authentication token has expired', 401);
  }

  // Handle Prisma Known Errors
  if (err.code === 'P2002') {
    const fields = (err.meta?.target as string[]) || ['field'];
    return sendError(
      res,
      'DUPLICATE_ENTRY',
      `A record with this ${fields.join(', ')} already exists`,
      409
    );
  }
  if (err.code === 'P2025') {
    return sendError(res, 'NOT_FOUND', 'Requested record not found in database', 404);
  }

  // Fallback Server Error
  console.error('Unhandled Server Error:', err);
  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred on the server'
      : err.message || 'Internal Server Error',
    500
  );
};

