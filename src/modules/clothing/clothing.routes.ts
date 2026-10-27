import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { idParamSchema } from '../../lib/schemas';
import { getAuth, requireRole } from '../../middleware/auth';
import { createClothingSchema, listClothingQuerySchema, updateClothingSchema } from './clothing.schemas';
import * as clothingService from './clothing.service';

export const clothingRouter = Router();

clothingRouter.get(
  '/',
  requireRole('admin', 'child'),
  asyncHandler(async (req, res) => {
    const query = listClothingQuerySchema.parse(req.query);
    res.json(await clothingService.listClothing(getAuth(req), query));
  }),
);

clothingRouter.get(
  '/:id',
  requireRole('admin', 'child'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ item: await clothingService.getClothingItem(getAuth(req), id) });
  }),
);

clothingRouter.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = createClothingSchema.parse(req.body);
    res.status(201).json({ item: await clothingService.createClothingItem(getAuth(req), input) });
  }),
);

// ילד מגיע לכאן, אך השירות דוחה כל שדה שאינו ברשימת השדות המותרים לילד
clothingRouter.patch(
  '/:id',
  requireRole('admin', 'child'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateClothingSchema.parse(req.body);
    res.json({ item: await clothingService.updateClothingItem(getAuth(req), id, input) });
  }),
);

clothingRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await clothingService.deleteClothingItem(getAuth(req), id));
  }),
);
