import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.util';
import { sendError } from '../utils/apiResponse.util';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & {
        effectiveCompanyId?: string | null;
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  let authHeader = req.headers.authorization;

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && req.query.token) {
    authHeader = `Bearer ${req.query.token}`;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication token is missing or malformed', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    // Super Admin / Admin can switch company context via X-Company-Context header
    let effectiveCompanyId = payload.companyId;
    const contextHeader = req.headers['x-company-context'] as string | undefined;

    if (payload.role === 'SUPER_ADMIN' || payload.role === 'ADMIN') {
      if (contextHeader === '' || contextHeader === 'all') {
        effectiveCompanyId = null;
      } else if (contextHeader) {
        effectiveCompanyId = contextHeader;
      } else {
        effectiveCompanyId = null;
      }
    }

    req.user = {
      ...payload,
      effectiveCompanyId,
    };

    return next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'Access token has expired', 401);
    }
    return sendError(res, 'UNAUTHORIZED', 'Invalid or revoked access token', 401);
  }
};

