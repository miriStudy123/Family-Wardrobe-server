import { z } from 'zod';
import { uuidSchema } from '../../lib/schemas';

const outfitName = z.string().trim().min(1, 'יש להזין שם ל-Look').max(60);
const idList = z.array(uuidSchema).max(50);

export const createOutfitSchema = z
  .object({
    name: outfitName,
    /** אופציונלי. אם לא נשלח — נשמרת הבחירה הנוכחית המאומתת בשרת */
    clothingItemIds: idList.min(1).optional(),
  })
  .strict();

export const updateOutfitSchema = z
  .object({
    name: outfitName.optional(),
    /** החלפה מלאה של פריטי ה-Look */
    clothingItemIds: idList.min(1).optional(),
    addItemIds: idList.optional(),
    removeItemIds: idList.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'יש לשלוח לפחות שדה אחד' })
  .refine((value) => !(value.clothingItemIds && (value.addItemIds || value.removeItemIds)), {
    message: 'לא ניתן לשלב clothingItemIds עם addItemIds או removeItemIds',
  });

export type CreateOutfitInput = z.infer<typeof createOutfitSchema>;
export type UpdateOutfitInput = z.infer<typeof updateOutfitSchema>;
