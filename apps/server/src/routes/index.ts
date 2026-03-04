import { Router } from 'express';
import type { Router as RouterType } from 'express';

import authRoutes from './v1/auth.route';
import integrationsRoutes from './v1/integrations.route';
import npciRoutes from './v1/npci.route';
import mfInsightsRoutes from './v1/mf-insights.route';

const router: RouterType = Router();

router.use('/auth', authRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/npci', npciRoutes);
router.use('/mf-insights', mfInsightsRoutes);

export default router;
