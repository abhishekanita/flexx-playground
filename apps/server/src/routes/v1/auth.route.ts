import { AuthController } from '@/controller/auth/auth.controller';
import { isLoggedIn } from '@/middlewares/policies/isLoggedIn';
import { asyncHandler } from '@/utils/asyncWrapper';
import { Router } from 'express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();
const controller = new AuthController();


router.get('/google', asyncHandler(controller.getGoogleAuthUrl));
router.post('/google/callback', asyncHandler(controller.googleAuthRedirect));
router.get('/get-user', isLoggedIn, asyncHandler(controller.getLoggedInUser));
router.get('/logout', isLoggedIn, asyncHandler(controller.logout));

export default router;
