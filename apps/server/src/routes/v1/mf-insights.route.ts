import { MFInsightsController } from '@/controller/mf-insights/mf-insights.controller';
import { asyncHandler } from '@/utils/asyncWrapper';
import { Router } from 'express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();
const controller = new MFInsightsController();

router.get('/:pan', asyncHandler(controller.getInsights));
router.get('/:pan/dashboard', asyncHandler(controller.getDashboard));
router.get('/:pan/cards', asyncHandler(controller.getCards));

export default router;
