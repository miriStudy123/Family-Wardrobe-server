import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { uuidSchema } from '../../lib/schemas';
import { getChildId } from '../../middleware/auth';
import * as selectionService from './selection.service';

/** כל הנתיבים כאן לילד מחובר בלבד; הילד מזוהה מה-Session ולא מהבקשה */
export const selectionRouter = Router();

const addItemSchema = z.object({ clothingItemId: uuidSchema }).strict();
const replaceSchema = z.object({ clothingItemIds: z.array(uuidSchema).max(50) }).strict();
const itemParamSchema = z.object({ clothingItemId: uuidSchema });

selectionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ selection: await selectionService.getSelection(getChildId(req)) });
  }),
);

selectionRouter.post(
  '/items',
  asyncHandler(async (req, res) => {
    const { clothingItemId } = addItemSchema.parse(req.body);
    res.json({ selection: await selectionService.addItem(getChildId(req), clothingItemId) });
  }),
);

selectionRouter.delete(
  '/items/:clothingItemId',
  asyncHandler(async (req, res) => {
    const { clothingItemId } = itemParamSchema.parse(req.params);
    res.json({ selection: await selectionService.removeItem(getChildId(req), clothingItemId) });
  }),
);

selectionRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { clothingItemIds } = replaceSchema.parse(req.body);
    res.json({ selection: await selectionService.replaceSelection(getChildId(req), clothingItemIds) });
  }),
);

selectionRouter.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    res.json(await selectionService.confirmSelection(getChildId(req)));
  }),
);
