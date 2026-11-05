import { Response } from 'express';

export interface MetaPagination {
  total?: number;
  page?: number;
  limit?: number;
  [key: string]: any;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: MetaPagination
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

export interface ErrorDetail {
  field?: string;
  issue: string;
}

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: ErrorDetail[]
) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
};

