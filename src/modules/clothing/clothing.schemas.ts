import { z } from 'zod';
import { CLOTHING_CATEGORIES, SEASONS } from '../../domain/categoryRules';
import { booleanQuerySchema, limitSchema, pageSchema, uuidSchema } from '../../lib/schemas';

const name = z.string().trim().min(1, 'יש להזין שם פריט').max(100);

const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .url('כתובת תמונה לא תקינה')
  .refine((url) => /^https?:\/\//i.test(url), 'כתובת התמונה חייבת להתחיל ב-http או https');

export const createClothingSchema = z
  .object({
    childId: uuidSchema,
    name,
    category: z.enum(CLOTHING_CATEGORIES),
    season: z.enum(SEASONS),
    imageUrl: imageUrl.nullable().optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

export const updateClothingSchema = z
  .object({
    name: name.optional(),
    category: z.enum(CLOTHING_CATEGORIES).optional(),
    season: z.enum(SEASONS).optional(),
    imageUrl: imageUrl.nullable().optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'יש לשלוח לפחות שדה אחד' });

/** שדות שמותר למיין לפיהם — רשימה סגורה */
export const CLOTHING_SORT_FIELDS = [
  'name',
  'category',
  'season',
  'isAvailable',
  'lastStatusChangeAt',
  'createdAt',
  'updatedAt',
] as const;

export const listClothingQuerySchema = z
  .object({
    childId: uuidSchema.optional(),
    isAvailable: booleanQuerySchema.optional(),
    category: z.enum(CLOTHING_CATEGORIES).optional(),
    season: z.enum(SEASONS).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(CLOTHING_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: pageSchema,
    limit: limitSchema,
    /** true — ביטול סינון ברירת המחדל לפי מגדר הילד */
    allCategories: booleanQuerySchema.optional(),
  })
  .strict();

export type CreateClothingInput = z.infer<typeof createClothingSchema>;
export type UpdateClothingInput = z.infer<typeof updateClothingSchema>;
export type ListClothingQuery = z.infer<typeof listClothingQuerySchema>;
