import { NpciController } from '@/controller/integrations/npci.controller';
import { isLoggedIn } from '@/middlewares/policies/isLoggedIn';
import { asyncHandler } from '@/utils/asyncWrapper';
import { Router } from 'express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();
const controller = new NpciController();

router.get('/connection-status', isLoggedIn, asyncHandler(controller.getConnectionStatus));
router.post('/connect', isLoggedIn, asyncHandler(controller.connect));
router.post('/connect/verify', isLoggedIn, asyncHandler(controller.verifyConnection));
router.get('/mandates', isLoggedIn, asyncHandler(controller.getMandates));
router.post('/mandates/sync', isLoggedIn, asyncHandler(controller.forceSync));
router.post('/mandates/revoke', isLoggedIn, asyncHandler(controller.revokeMandate));

export default router;
