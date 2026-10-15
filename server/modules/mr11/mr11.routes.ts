import { Router } from 'express';
import { 
  getLatestMr11, 
  triggerMr11Regenerate, 
  exportMr11ToExcel,
  getPlanningSeriesHistory,
  getProductionSeriesHistory,
  getShellplanApprovalHistory,
  getDispatchMonthly,
  getDeletedRows,
  deleteMr11Row,
  restoreMr11Row,
} from './mr11.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { RoleCode } from '@prisma/client';

const router = Router();

// MR11 is visible to every signed-in user, and only to signed-in users
router.use(requireAuth);

router.get('/', getLatestMr11);
router.post('/regenerate', triggerMr11Regenerate);
router.get('/export', exportMr11ToExcel);
router.get('/planning-series', getPlanningSeriesHistory);
router.get('/production-series', getProductionSeriesHistory);
router.get('/shellplan-history', getShellplanApprovalHistory);
router.get('/dispatch-monthly', getDispatchMonthly);

// Deleting and restoring MR11 rows: administrators only
router.get('/deleted-rows', requireRoles(RoleCode.ADMIN), getDeletedRows);
router.post('/rows/delete', requireRoles(RoleCode.ADMIN), deleteMr11Row);
router.post('/rows/restore', requireRoles(RoleCode.ADMIN), restoreMr11Row);

export default router;