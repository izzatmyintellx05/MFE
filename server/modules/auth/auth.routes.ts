import { Router } from 'express';
import { login, getMe } from './auth.controller';

const router = Router();

router.post('/login', login);
router.get('/me', getMe);

export { router as authRouter };
export default router;