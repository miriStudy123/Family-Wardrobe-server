import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { booleanQuerySchema, idParamSchema, limitSchema, pageSchema, uuidSchema } from '../../lib/schemas';
import { getAuth, requireRole } from '../../middleware/auth';
import * as messagesService from './messages.service';

export const messagesRouter = Router();

const sendSchema = z.object({ body: z.string().trim().min(1, 'ההודעה ריקה').max(2000) }).strict();

const listQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    unreadOnly: booleanQuerySchema.optional(),
    childId: uuidSchema.optional(),
  })
  .strict();

messagesRouter.post(
  '/',
  requireRole('child'),
  asyncHandler(async (req, res) => {
    const { body } = sendSchema.parse(req.body);
    res.status(201).json({ message: await messagesService.sendMessage(getAuth(req), body) });
  }),
);

messagesRouter.get(
  '/',
  requireRole('admin', 'child'),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(await messagesService.listMessages(getAuth(req), query));
  }),
);

messagesRouter.patch(
  '/:id/read',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ message: await messagesService.markAsRead(getAuth(req), id) });
  }),
);
