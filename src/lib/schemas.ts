import { z } from 'zod';

export const uuidSchema = z.string().uuid('מזהה לא תקין');

export const idParamSchema = z.object({ id: uuidSchema });

/** פרמטר בוליאני במחרוזת שאילתה: true / false בלבד */
export const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const pageSchema = z.coerce.number().int().min(1).max(10000).default(1);
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
