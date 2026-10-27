import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate, getAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import * as familiesService from './families.service';

export const familiesRouter = Router();

const createFamilySchema = z
  .object({
    name: z.string().trim().min(1, 'יש להזין שם משפחה').max(100),
    adminCode: z.string().min(8, 'קוד מנהל חייב להכיל 8 תווים לפחות').max(128),
  })
  .strict();

familiesRouter.post(
  '/',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = createFamilySchema.parse(req.body);
    const family = await familiesService.createFamily(input);
    res.status(201).json({
      message: 'המשפחה נוצרה בהצלחה. שמרו את קוד המשפחה — הוא נדרש להתחברות',
      family,
    });
  }),
);

familiesRouter.get(
  '/current',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ family: await familiesService.getCurrentFamily(getAuth(req)) });
  }),
);
