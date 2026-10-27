import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { idParamSchema } from '../../lib/schemas';
import { getChildId } from '../../middleware/auth';
import { createOutfitSchema, updateOutfitSchema } from './outfits.schemas';
import * as outfitsService from './outfits.service';

/** Looks — לילד מחובר בלבד, על ה-Looks שלו בלבד */
export const outfitsRouter = Router();

outfitsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createOutfitSchema.parse(req.body);
    res.status(201).json({ outfit: await outfitsService.createOutfit(getChildId(req), input) });
  }),
);

outfitsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await outfitsService.listOutfits(getChildId(req)) });
  }),
);

outfitsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ outfit: await outfitsService.getOutfit(getChildId(req), id) });
  }),
);

outfitsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateOutfitSchema.parse(req.body);
    res.json({ outfit: await outfitsService.updateOutfit(getChildId(req), id, input) });
  }),
);

outfitsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await outfitsService.deleteOutfit(getChildId(req), id);
    res.status(204).end();
  }),
);

outfitsRouter.post(
  '/:id/apply',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await outfitsService.applyOutfit(getChildId(req), id));
  }),
);
