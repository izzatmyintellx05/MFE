import { Router } from 'express';
import { login, getMe, changePassword, forgotPassword } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/me', getMe);
router.post('/change-password', requireAuth, changePassword);

export { router as authRouter };
export default router;