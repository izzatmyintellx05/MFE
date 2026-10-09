import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  getActiveDepartmentWorkbook,
  uploadDepartmentWorkbook,
  downloadOriginalFile,
  listDepartments,
} from './department.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Shell Plan and Design share one workbook; every other department has its own
const DEPARTMENT_ROLES: Record<string, string[]> = {
  DESIGN: ['SHELLPLAN', 'DESIGN'],
  SHELLPLAN: ['SHELLPLAN', 'DESIGN'],
};

// A department's workbook is read, uploaded and downloaded only by that department or an administrator
function requireDepartmentAccess(req: Request, res: Response, next: NextFunction) {
  const code = String(req.params.code || '').toUpperCase();
  const roles = ((req as any).user?.roles || []).map((r: any) => String(r).toUpperCase());
  const allowed = DEPARTMENT_ROLES[code] || [code];
  if (roles.includes('ADMIN') || allowed.some((r) => roles.includes(r))) return next();
  return res.status(403).json({
    success: false,
    error: { code: 'ACCESS_DENIED', message: 'You do not have access to this department.' },
  });
}

// Every department endpoint needs a signed-in user
router.use(requireAuth);

// In-memory buffer storage: eliminates EROFS read-only disk errors on Vercel / serverless runtimes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
});

// List all departments
router.get('/', listDepartments);

// Fetch department workbook (supports /BD, /BD/workbook, /BD/active)
router.get('/:code', requireDepartmentAccess, getActiveDepartmentWorkbook);
router.get('/:code/workbook', requireDepartmentAccess, getActiveDepartmentWorkbook);
router.get('/:code/active', requireDepartmentAccess, getActiveDepartmentWorkbook);

// Upload workbook using memory buffer
router.post('/:code/upload', requireDepartmentAccess, upload.single('file'), uploadDepartmentWorkbook);
router.post('/:code', requireDepartmentAccess, upload.single('file'), uploadDepartmentWorkbook);

// Download file
router.get('/:code/download', requireDepartmentAccess, downloadOriginalFile);

export default router;
