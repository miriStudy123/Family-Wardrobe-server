import { Prisma } from '@prisma/client';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { type Db, prisma } from '../../lib/prisma';
import {
  assertItemsOwnedByChild,
  CLOTHING_SELECT,
  unavailableSummary,
} from '../clothing/clothing.shared';

/**
 * מחזיר את הבחירה הנוכחית של הילד (יוצר רשומה ריקה אם אין), כולל מצב הזמינות
 * העדכני של כל פריט. פריט שהפך ללא זמין אינו מוסר אוטומטית — הוא מסומן.
 */
export async function loadSelection(db: Db, childId: string) {
  const selection = await db.currentSelection.upsert({
    where: { childId },
    create: { childId },
    update: {},
    include: {
      items: {
        orderBy: { addedAt: 'asc' },
        include: { clothingItem: { select: CLOTHING_SELECT } },
      },
    },
  });

  const items = selection.items.map((entry) => entry.clothingItem);
  const unavailableItems = unavailableSummary(items);

  return {
    id: selection.id,
    childId: selection.childId,
    items,
    itemCount: items.length,
    unavailableItems,
    canConfirm: items.length > 0 && unavailableItems.length === 0,
    updatedAt: selection.updatedAt,
  };
}

async function getSelectionId(db: Db, childId: string): Promise<string> {
  const selection = await db.currentSelection.upsert({
    where: { childId },
    create: { childId },
    update: {},
    select: { id: true },
  });
  return selection.id;
}

async function touch(db: Db, selectionId: string) {
  await db.currentSelection.update({ where: { id: selectionId }, data: { updatedAt: new Date() } });
}

export function getSelection(childId: string) {
  return loadSelection(prisma, childId);
}

/** הוספת פריט — אינה משנה זמינות ואינה "תופסת" את הפריט. הוספה חוזרת אינה יוצרת כפילות. */
export async function addItem(childId: string, clothingItemId: string) {
  return prisma.$transaction(async (tx) => {
    await assertItemsOwnedByChild(tx, childId, [clothingItemId]);
    const selectionId = await getSelectionId(tx, childId);
    await tx.currentSelectionItem.createMany({
      data: [{ selectionId, childId, clothingItemId }],
      skipDuplicates: true,
    });
    await touch(tx, selectionId);
    return loadSelection(tx, childId);
  });
}

export async function removeItem(childId: string, clothingItemId: string) {
  return prisma.$transaction(async (tx) => {
    const selectionId = await getSelectionId(tx, childId);
    const { count } = await tx.currentSelectionItem.deleteMany({ where: { selectionId, clothingItemId } });
    if (count === 0) throw notFound('ITEM_NOT_IN_SELECTION', 'הפריט אינו נמצא בבחירה הנוכחית');
    await touch(tx, selectionId);
    return loadSelection(tx, childId);
  });
}

/** החלפת כל הבחירה ברשימה חדשה (לא מיזוג). משמש גם לפתיחת Look. */
export async function replaceSelectionItems(db: Db, childId: string, clothingItemIds: string[]) {
  const ids = await assertItemsOwnedByChild(db, childId, clothingItemIds);
  const selectionId = await getSelectionId(db, childId);
  await db.currentSelectionItem.deleteMany({ where: { selectionId } });
  if (ids.length > 0) {
    await db.currentSelectionItem.createMany({
      data: ids.map((clothingItemId) => ({ selectionId, childId, clothingItemId })),
      skipDuplicates: true,
    });
  }
  await touch(db, selectionId);
}

export async function replaceSelection(childId: string, clothingItemIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await replaceSelectionItems(tx, childId, clothingItemIds);
    return loadSelection(tx, childId);
  });
}

interface LockedItemRow {
  id: string;
  childId: string;
  name: string;
  isAvailable: boolean;
}

/**
 * אישור לבישה — אטומי, בטרנזקציה אחת:
 * 1. נעילת רשומת הבחירה של הילד (סדרתיות בין אישורים של אותו ילד).
 * 2. נעילת שורות הבגדים (SELECT ... FOR UPDATE, בסדר קבוע למניעת deadlock).
 * 3. אם פריט כלשהו אינו זמין — 409 עם רשימת הפריטים, ושום פריט אינו משתנה.
 * 4. אחרת — כל הפריטים מסומנים כלא זמינים ו-lastStatusChangeAt מתעדכן.
 * הבחירה עצמה נשארת שמורה עד הכניסה הבאה.
 */
export async function confirmSelection(childId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CurrentSelection" WHERE "childId" = ${childId} FOR UPDATE`;

      const selection = await tx.currentSelection.findUnique({
        where: { childId },
        select: { id: true, items: { select: { clothingItemId: true } } },
      });
      const ids = selection?.items.map((entry) => entry.clothingItemId) ?? [];
      if (!selection || ids.length === 0) {
        throw badRequest('EMPTY_SELECTION', 'הבחירה הנוכחית ריקה — יש לבחור לפחות פריט אחד');
      }

      const rows = await tx.$queryRaw<LockedItemRow[]>`
        SELECT id, "childId", name, "isAvailable"
        FROM "ClothingItem"
        WHERE id IN (${Prisma.join(ids)})
        ORDER BY id
        FOR UPDATE`;

      if (rows.length !== ids.length || rows.some((row) => row.childId !== childId)) {
        throw forbidden('SELECTION_OWNERSHIP_MISMATCH', 'הבחירה מכילה פריטים שאינם שייכים לילד');
      }

      const unavailableItems = rows
        .filter((row) => !row.isAvailable)
        .map((row) => ({ id: row.id, name: row.name }));

      if (unavailableItems.length > 0) {
        throw conflict('ITEMS_UNAVAILABLE', 'חלק מהפריטים שנבחרו אינם זמינים כרגע', { unavailableItems });
      }

      const now = new Date();
      const { count } = await tx.clothingItem.updateMany({
        where: { id: { in: ids }, childId, isAvailable: true },
        data: { isAvailable: false, lastStatusChangeAt: now },
      });
      if (count !== ids.length) {
        // הגנה נוספת — לא אמור לקרות בזכות הנעילה; גורם ל-rollback מלא
        throw conflict('ITEMS_UNAVAILABLE', 'חלק מהפריטים שנבחרו אינם זמינים כרגע');
      }

      return {
        confirmed: true,
        confirmedAt: now,
        message: 'הלבישה אושרה',
        selection: await loadSelection(tx, childId),
      };
    },
    { timeout: 15000 },
  );
}
