import { Router } from 'express';
import multer from 'multer';
import {
  getActiveDepartmentWorkbook,
  uploadDepartmentWorkbook,
  downloadOriginalFile,
  listDepartments,
} from './department.controller';

const router = Router();

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
router.get('/:code', getActiveDepartmentWorkbook);
router.get('/:code/workbook', getActiveDepartmentWorkbook);
router.get('/:code/active', getActiveDepartmentWorkbook);

// Upload workbook using memory buffer
router.post('/:code/upload', upload.single('file'), uploadDepartmentWorkbook);
router.post('/:code', upload.single('file'), uploadDepartmentWorkbook);

// Download file
router.get('/:code/download', downloadOriginalFile);

export default router;
