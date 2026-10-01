import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleCode } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: RoleCode[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'JWT Bearer token required' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'mfe-formwork-mr11-enterprise-secret-key-2026';
    const payload = jwt.verify(token, secret) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token is expired or invalid' } });
  }
}