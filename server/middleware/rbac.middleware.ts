import { Request, Response, NextFunction } from 'express';
import { RoleCode } from '@prisma/client';

export function requireRoles(...allowedRoles: RoleCode[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED' } });
    }

    if (req.user.roles.includes(RoleCode.ADMIN)) {
      return next();
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission for this resource.' },
      });
    }

    next();
  };
}