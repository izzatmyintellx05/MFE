import { Router } from 'express';
import { 
  getLatestMr11, 
  triggerMr11Regenerate, 
  exportMr11ToExcel,
  getPlanningSeriesHistory,
  getProductionSeriesHistory,
  getShellplanApprovalHistory,
  getDispatchMonthly,
} from './mr11.controller';
import { requireAuth } from '../../middleware/auth.middleware';

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

export default router;