import type { Prisma } from '@prisma/client';
import { notFound } from '../../lib/errors';
import type { Db } from '../../lib/prisma';

/** השדות המוחזרים ללקוח עבור פריט לבוש */
export const CLOTHING_SELECT = {
  id: true,
  childId: true,
  name: true,
  category: true,
  season: true,
  isAvailable: true,
  lastStatusChangeAt: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ClothingItemSelect;

export type ClothingItemDto = Prisma.ClothingItemGetPayload<{ select: typeof CLOTHING_SELECT }>;

/** פריטים שאינם זמינים מתוך רשימה — לתצוגה ולחסימת אישור לבישה */
export function unavailableSummary(items: ClothingItemDto[]) {
  return items.filter((item) => !item.isAvailable).map((item) => ({ id: item.id, name: item.name }));
}

/**
 * מוודא שכל המזהים שייכים לילד הנתון. מחזיר רשימה ללא כפילויות (לפי סדר הופעה).
 * אינו מגלה אם מזהה חסר קיים אצל ילד או משפחה אחרים.
 */
export async function assertItemsOwnedByChild(db: Db, childId: string, ids: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return uniqueIds;

  const owned = await db.clothingItem.findMany({
    where: { id: { in: uniqueIds }, childId },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((item) => item.id));
  const missing = uniqueIds.filter((id) => !ownedSet.has(id));

  if (missing.length > 0) {
    throw notFound('CLOTHING_NOT_FOUND', 'חלק מפריטי הלבוש לא נמצאו', { missingItemIds: missing });
  }
  return uniqueIds;
}
