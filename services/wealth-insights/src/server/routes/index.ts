import { Router } from 'express';
import type { Router as RouterType } from 'express';

import authRoutes from './auth.route';

const router: RouterType = Router();

router.use('/auth', authRoutes);

export default router;
