import { IntegrationsController } from '@/controller/integrations/integrations.controller';
import { isLoggedIn } from '@/middlewares/policies/isLoggedIn';
import { asyncHandler } from '@/utils/asyncWrapper';
import { Router } from 'express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();
const controller = new IntegrationsController();


router.get('/all', asyncHandler(controller.getAllIntegrations));
router.get('/connected', isLoggedIn, asyncHandler(controller.getConnectedIntegrations));
router.post('/google/initiate', isLoggedIn, asyncHandler(controller.initiateGoogleIntegration));
router.post('/google/initiate/redirect', isLoggedIn, asyncHandler(controller.initiateGoogleIntegrationRedirect));
router.post('/npci/initiate', isLoggedIn, asyncHandler(controller.initiateNpciIntegration));
router.post('/npci/initiate/otp', isLoggedIn, asyncHandler(controller.initiateNpciIntegrationOtp));

export default router;
