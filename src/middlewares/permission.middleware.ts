import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { sendError } from '../utils/apiResponse.util';

export const checkPermission = (moduleName: string, action: 'view' | 'add' | 'edit' | 'delete') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId || (req.user as any)?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // 1. ADMIN bypasses all checks
    if (userRole === 'ADMIN') {
      return next();
    }

    // 2. Only COWORKER role is restricted by granular permissions
    if (userRole !== 'COWORKER') {
      return next();
    }

    // 3. Query DB for user's permission in this module
    const permission = await prisma.permission.findFirst({
      where: {
        userId,
        moduleName: {
          equals: moduleName,
          mode: 'insensitive',
        },
      },
    });

    if (!permission) {
      return sendError(res, 'FORBIDDEN', `Access denied for ${moduleName}`, 403);
    }

    // 4. Check specific CRUD flag
    let hasAccess = false;
    const act = action.toLowerCase();
    if (act === 'view') hasAccess = permission.canView;
    else if (act === 'add') hasAccess = permission.canAdd;
    else if (act === 'edit') hasAccess = permission.canEdit;
    else if (act === 'delete') hasAccess = permission.canDelete;

    if (!hasAccess) {
      return sendError(res, 'FORBIDDEN', `Permission denied to ${act} in ${moduleName}`, 403);
    }

    return next();
  };
};
