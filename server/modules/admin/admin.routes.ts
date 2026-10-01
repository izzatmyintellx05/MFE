import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { 
  getAllUsersWithPermissions, 
  updateUserPermissions, 
  createUser, 
  deleteUser 
} from './admin.controller';

const router = Router();

// Self-contained JWT extraction and admin verification
const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    return;
  }

  const secret = process.env.JWT_SECRET || 'mfe-formwork-mr11-enterprise-secret-key-2026';

  try {
    const decoded = jwt.verify(token, secret) as any;
    (req as any).user = decoded;

    const userRoles: string[] = decoded.roles || (decoded.role ? [decoded.role] : []);
    const email: string = decoded.email || '';

    const isAdmin =
      userRoles.includes('ADMIN') ||
      decoded.departmentRole === 'ADMIN' ||
      email === 'admin@mfeformwork.com';

    if (!isAdmin) {
      res.status(403).json({ success: false, error: { message: 'Access denied: Administrator privileges required' } });
      return;
    }

    next();
  } catch (err) {
    res.status(403).json({ success: false, error: { message: 'Invalid or expired token' } });
    return;
  }
};

router.use(authenticateAdmin);

router.get('/users', getAllUsersWithPermissions);
router.patch('/users/:userId/permissions', updateUserPermissions);

router.get('/users', getAllUsersWithPermissions);
router.post('/users', createUser); // <-- ADD THIS ROUTE
router.patch('/users/:userId/permissions', updateUserPermissions);

router.get('/users', getAllUsersWithPermissions);
router.post('/users', createUser);
router.patch('/users/:userId/permissions', updateUserPermissions);
router.delete('/users/:userId', deleteUser); // <-- Added delete route

export default router;
export { router as adminRouter };

