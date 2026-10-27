import type { Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../lib/errors';
import { type Db, prisma } from '../../lib/prisma';
import {
  assertItemsOwnedByChild,
  CLOTHING_SELECT,
  unavailableSummary,
} from '../clothing/clothing.shared';
import { loadSelection, replaceSelectionItems } from '../selection/selection.service';
import type { CreateOutfitInput, UpdateOutfitInput } from './outfits.schemas';

const outfitNotFound = () => notFound('OUTFIT_NOT_FOUND', 'ה-Look לא נמצא');
const emptyOutfit = () => badRequest('EMPTY_OUTFIT', 'לא ניתן לשמור Look ריק');

const OUTFIT_INCLUDE = {
  items: {
    orderBy: { addedAt: 'asc' },
    include: { clothingItem: { select: CLOTHING_SELECT } },
  },
} as const satisfies Prisma.OutfitInclude;

async function loadOutfit(db: Db, childId: string, id: string) {
  const outfit = await db.outfit.findFirst({ where: { id, childId }, include: OUTFIT_INCLUDE });
  if (!outfit) throw outfitNotFound();
  const items = outfit.items.map((entry) => entry.clothingItem);
  return {
    id: outfit.id,
    name: outfit.name,
    items,
    itemCount: items.length,
    unavailableItems: unavailableSummary(items),
    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,
  };
}

/** Looks של הילד המחובר בלבד */
export async function listOutfits(childId: string) {
  const outfits = await prisma.outfit.findMany({
    where: { childId },
    orderBy: { createdAt: 'desc' },
    include: OUTFIT_INCLUDE,
  });
  return outfits.map((outfit) => {
    const items = outfit.items.map((entry) => entry.clothingItem);
    return {
      id: outfit.id,
      name: outfit.name,
      items,
      itemCount: items.length,
      unavailableItems: unavailableSummary(items),
      createdAt: outfit.createdAt,
      updatedAt: outfit.updatedAt,
    };
  });
}

export function getOutfit(childId: string, id: string) {
  return loadOutfit(prisma, childId, id);
}

/**
 * יצירת Look. ברירת המחדל (ללא clothingItemIds) — שמירת הבחירה הנוכחית כפי שהיא
 * שמורה בשרת ("שמירת הלוק שלי"), כדי למנוע זיוף מזהים. Look ריק נדחה.
 * אינה משנה זמינות ואינה משנה את הבחירה הנוכחית.
 */
export async function createOutfit(childId: string, input: CreateOutfitInput) {
  return prisma.$transaction(async (tx) => {
    let ids: string[];
    if (input.clothingItemIds) {
      ids = input.clothingItemIds;
    } else {
      const selection = await tx.currentSelection.findUnique({
        where: { childId },
        select: { items: { orderBy: { addedAt: 'asc' }, select: { clothingItemId: true } } },
      });
      ids = selection?.items.map((entry) => entry.clothingItemId) ?? [];
    }

    const ownedIds = await assertItemsOwnedByChild(tx, childId, ids);
    if (ownedIds.length === 0) throw emptyOutfit();

    const outfit = await tx.outfit.create({ data: { childId, name: input.name } });
    await tx.outfitItem.createMany({
      data: ownedIds.map((clothingItemId) => ({ outfitId: outfit.id, childId, clothingItemId })),
      skipDuplicates: true,
    });
    return loadOutfit(tx, childId, outfit.id);
  });
}

/** עדכון שם ו/או פריטים. אינו משנה זמינות ואינו נוגע בבחירה הנוכחית. */
export async function updateOutfit(childId: string, id: string, input: UpdateOutfitInput) {
  return prisma.$transaction(async (tx) => {
    const outfit = await tx.outfit.findFirst({ where: { id, childId }, select: { id: true } });
    if (!outfit) throw outfitNotFound();

    if (input.clothingItemIds) {
      const ids = await assertItemsOwnedByChild(tx, childId, input.clothingItemIds);
      await tx.outfitItem.deleteMany({ where: { outfitId: outfit.id } });
      await tx.outfitItem.createMany({
        data: ids.map((clothingItemId) => ({ outfitId: outfit.id, childId, clothingItemId })),
        skipDuplicates: true,
      });
    }

    if (input.addItemIds?.length) {
      const ids = await assertItemsOwnedByChild(tx, childId, input.addItemIds);
      await tx.outfitItem.createMany({
        data: ids.map((clothingItemId) => ({ outfitId: outfit.id, childId, clothingItemId })),
        skipDuplicates: true,
      });
    }

    if (input.removeItemIds?.length) {
      await tx.outfitItem.deleteMany({
        where: { outfitId: outfit.id, clothingItemId: { in: input.removeItemIds } },
      });
    }

    const remaining = await tx.outfitItem.count({ where: { outfitId: outfit.id } });
    if (remaining === 0) throw emptyOutfit(); // גורם ל-rollback של כל העדכון

    await tx.outfit.update({
      where: { id: outfit.id },
      data: { updatedAt: new Date(), ...(input.name !== undefined ? { name: input.name } : {}) },
    });
    return loadOutfit(tx, childId, outfit.id);
  });
}

export async function deleteOutfit(childId: string, id: string) {
  const { count } = await prisma.outfit.deleteMany({ where: { id, childId } });
  if (count === 0) throw outfitNotFound();
}

/**
 * פתיחת Look: הבחירה הנוכחית מוחלפת (לא ממוזגת) בפריטי ה-Look.
 * זמינות הבגדים אינה משתנה; מוחזר מצב הזמינות העדכני של כל פריט.
 */
export async function applyOutfit(childId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const outfit = await tx.outfit.findFirst({
      where: { id, childId },
      select: { id: true, items: { orderBy: { addedAt: 'asc' }, select: { clothingItemId: true } } },
    });
    if (!outfit) throw outfitNotFound();

    await replaceSelectionItems(
      tx,
      childId,
      outfit.items.map((entry) => entry.clothingItemId),
    );
    return { appliedOutfitId: outfit.id, selection: await loadSelection(tx, childId) };
  });
}
