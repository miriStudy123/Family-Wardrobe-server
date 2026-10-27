import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate, getAuth, requireRole } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { adminLoginSchema, changeAdminCodeSchema, childLoginSchema } from './auth.schemas';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post(
  '/admin/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = adminLoginSchema.parse(req.body);
    res.json(await authService.adminLogin(input));
  }),
);

authRouter.post(
  '/child/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = childLoginSchema.parse(req.body);
    res.json(await authService.childLogin(input));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await authService.getMe(getAuth(req)));
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.logout(getAuth(req));
    res.status(204).end();
  }),
);

authRouter.post(
  '/admin/change-code',
  authRateLimiter,
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = changeAdminCodeSchema.parse(req.body);
    await authService.changeAdminCode(getAuth(req), input);
    res.json({ success: true, message: 'קוד המנהל עודכן' });
  }),
);
