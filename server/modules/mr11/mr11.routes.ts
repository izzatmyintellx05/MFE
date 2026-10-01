import { Router } from 'express';
import { 
  getLatestMr11, 
  triggerMr11Regenerate, 
  exportMr11ToExcel,
  getPlanningSeriesHistory,
  getProductionSeriesHistory
} from './mr11.controller';

const router = Router();

router.get('/', getLatestMr11);
router.post('/regenerate', triggerMr11Regenerate);
router.get('/export', exportMr11ToExcel);
router.get('/planning-series', getPlanningSeriesHistory);
router.get('/production-series', getProductionSeriesHistory);

export default router;