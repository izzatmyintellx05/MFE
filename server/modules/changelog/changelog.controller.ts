import { Request, Response } from 'express';
import { listChanges, getChange, MR11_SCOPE } from './changelog.service';

// Shell Plan and Design share one workbook, logged under DESIGN
function scopeOf(req: Request): string {
  const code = String(req.params.code || '').trim().toUpperCase();
  return code === 'SHELLPLAN' ? 'DESIGN' : code;
}

async function sendList(scope: string, req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    return res.json({ success: true, data: await listChanges(scope, limit) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

async function sendOne(scope: string, req: Request, res: Response) {
  try {
    const entry = await getChange(scope, String(req.params.logId || ''));
    if (!entry) return res.status(404).json({ success: false, error: { code: 'LOG_NOT_FOUND', message: 'Log entry not found' } });
    return res.json({ success: true, data: entry });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// GET /api/departments/:code/changelog (that department and administrators only)
export const listDepartmentChanges = (req: Request, res: Response) => sendList(scopeOf(req), req, res);
// GET /api/departments/:code/changelog/:logId
export const getDepartmentChange = (req: Request, res: Response) => sendOne(scopeOf(req), req, res);

// GET /api/mr11/changelog (everyone who can see MR11)
export const listMr11Changes = (req: Request, res: Response) => sendList(MR11_SCOPE, req, res);
// GET /api/mr11/changelog/:logId
export const getMr11Change = (req: Request, res: Response) => sendOne(MR11_SCOPE, req, res);
