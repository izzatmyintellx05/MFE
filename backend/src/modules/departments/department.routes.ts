import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getActiveDepartmentWorkbook,
  uploadDepartmentWorkbook,
  downloadOriginalFile,
  listDepartments,
} from './department.controller';

const router = Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// List all departments
router.get('/', listDepartments);

// Fetch department workbook (supports /BD, /BD/workbook, /BD/active)
router.get('/:code', getActiveDepartmentWorkbook);
router.get('/:code/workbook', getActiveDepartmentWorkbook);
router.get('/:code/active', getActiveDepartmentWorkbook);

// Upload workbook
router.post('/:code/upload', upload.single('file'), uploadDepartmentWorkbook);
router.post('/:code', upload.single('file'), uploadDepartmentWorkbook);

// Download file
router.get('/:code/download', downloadOriginalFile);

export default router;