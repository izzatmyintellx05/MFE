import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { RoleCode } from '@prisma/client';
import { getVisualizationData } from './visualization.controller';

const router = Router();

router.get('/', requireAuth, requireRoles(RoleCode.ADMIN, RoleCode.CEO), getVisualizationData);

export default router;