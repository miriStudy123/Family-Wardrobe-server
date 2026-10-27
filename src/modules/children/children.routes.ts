import { Router } from 'express';
import { z } from 'zod';
import { GENDERS } from '../../domain/categoryRules';
import { asyncHandler } from '../../lib/asyncHandler';
import { idParamSchema } from '../../lib/schemas';
import { getAuth, requireRole } from '../../middleware/auth';
import * as childrenService from './children.service';

export const childrenRouter = Router();

const childName = z.string().trim().min(1, 'יש להזין שם').max(60);

const createChildSchema = z.object({ name: childName, gender: z.enum(GENDERS) }).strict();

const updateChildSchema = z
  .object({ name: childName.optional(), gender: z.enum(GENDERS).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'יש לשלוח לפחות שדה אחד' });

childrenRouter.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = createChildSchema.parse(req.body);
    const result = await childrenService.createChild(getAuth(req), input);
    res.status(201).json({
      ...result,
      message: 'הילד נוצר. קוד הילד מוצג כעת בלבד — יש למסור אותו לילד',
    });
  }),
);

childrenRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json({ data: await childrenService.listChildren(getAuth(req)) });
  }),
);

childrenRouter.get(
  '/:id',
  requireRole('admin', 'child'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ child: await childrenService.getChild(getAuth(req), id) });
  }),
);

childrenRouter.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateChildSchema.parse(req.body);
    res.json({ child: await childrenService.updateChild(getAuth(req), id, input) });
  }),
);

childrenRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await childrenService.deleteChild(getAuth(req), id);
    res.status(204).end();
  }),
);

childrenRouter.post(
  '/:id/reset-code',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const result = await childrenService.resetChildCode(getAuth(req), id);
    res.json({ ...result, message: 'נוצר קוד חדש לילד. ההתחברויות הקודמות שלו בוטלו' });
  }),
);
