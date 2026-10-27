import type { Prisma } from '@prisma/client';
import { getRecommendedCategories } from '../../domain/categoryRules';
import { CHILD_EDITABLE_CLOTHING_FIELDS } from '../../domain/permissions';
import { forbidden, notFound, unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { paginationMeta } from '../../lib/schemas';
import type { AuthContext } from '../../types/auth';
import { CLOTHING_SELECT } from './clothing.shared';
import type { CreateClothingInput, ListClothingQuery, UpdateClothingInput } from './clothing.schemas';

const clothingNotFound = () => notFound('CLOTHING_NOT_FOUND', 'פריט הלבוש לא נמצא');

/**
 * תנאי גישה לפריט: תמיד מוגבל למשפחה של המשתמש המחובר,
 * ולילד — רק לפריטים שלו. מזהה פריט תקף של משפחה אחרת יחזיר 404.
 */
function accessWhere(auth: AuthContext, id: string): Prisma.ClothingItemWhereInput {
  return {
    id,
    child: { familyId: auth.familyId },
    ...(auth.role === 'child' ? { childId: auth.childId ?? '' } : {}),
  };
}

export async function listClothing(auth: AuthContext, query: ListClothingQuery) {
  let targetChild: { id: string; gender: 'boy' | 'girl' } | null = null;

  if (auth.role === 'child') {
    // ילד רואה רק את הארון שלו; אין להסתמך על childId שנשלח
    if (query.childId && query.childId !== auth.childId) throw forbidden();
    targetChild = await prisma.child.findFirst({
      where: { id: auth.childId ?? '', familyId: auth.familyId },
      select: { id: true, gender: true },
    });
    if (!targetChild) throw unauthorized();
  } else if (query.childId) {
    targetChild = await prisma.child.findFirst({
      where: { id: query.childId, familyId: auth.familyId },
      select: { id: true, gender: true },
    });
    if (!targetChild) throw notFound('CHILD_NOT_FOUND', 'הילד לא נמצא');
  }

  const where: Prisma.ClothingItemWhereInput = { child: { familyId: auth.familyId } };
  if (targetChild) where.childId = targetChild.id;
  if (query.isAvailable !== undefined) where.isAvailable = query.isAvailable;
  if (query.season) where.season = query.season;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

  // כלל תצוגה (לא הרשאה): אם לא נבחרה קטגוריה — מוצגות הקטגוריות המומלצות לילד
  const recommendedCategories = targetChild ? getRecommendedCategories(targetChild.gender) : null;
  let defaultCategoryFilterApplied = false;
  if (query.category) {
    where.category = query.category;
  } else if (recommendedCategories && !query.allCategories) {
    where.category = { in: recommendedCategories };
    defaultCategoryFilterApplied = true;
  }

  const orderBy: Prisma.ClothingItemOrderByWithRelationInput[] = [
    { [query.sortBy]: query.sortOrder } as Prisma.ClothingItemOrderByWithRelationInput,
    { id: 'asc' },
  ];

  const [total, items] = await prisma.$transaction([
    prisma.clothingItem.count({ where }),
    prisma.clothingItem.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: CLOTHING_SELECT,
    }),
  ]);

  return {
    data: items,
    pagination: paginationMeta(query.page, query.limit, total),
    meta: { recommendedCategories, defaultCategoryFilterApplied },
  };
}

export async function getClothingItem(auth: AuthContext, id: string) {
  const item = await prisma.clothingItem.findFirst({ where: accessWhere(auth, id), select: CLOTHING_SELECT });
  if (!item) throw clothingNotFound();
  return item;
}

export async function createClothingItem(auth: AuthContext, input: CreateClothingInput) {
  const child = await prisma.child.findFirst({
    where: { id: input.childId, familyId: auth.familyId },
    select: { id: true },
  });
  if (!child) throw notFound('CHILD_NOT_FOUND', 'הילד לא נמצא');

  return prisma.clothingItem.create({
    data: {
      childId: child.id,
      name: input.name,
      category: input.category,
      season: input.season,
      imageUrl: input.imageUrl ?? null,
      isAvailable: input.isAvailable ?? true,
    },
    select: CLOTHING_SELECT,
  });
}

export async function updateClothingItem(auth: AuthContext, id: string, input: UpdateClothingInput) {
  if (auth.role === 'child') {
    const disallowed = Object.keys(input).filter((field) => !CHILD_EDITABLE_CLOTHING_FIELDS.includes(field));
    if (disallowed.length > 0) {
      throw forbidden('FIELD_NOT_EDITABLE', 'אין הרשאה לעדכן את השדות המבוקשים');
    }
  }

  const existing = await prisma.clothingItem.findFirst({
    where: accessWhere(auth, id),
    select: { id: true, isAvailable: true },
  });
  if (!existing) throw clothingNotFound();

  const data: Prisma.ClothingItemUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.season !== undefined) data.season = input.season;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;

  // רק שינוי אמיתי בזמינות מעדכן את lastStatusChangeAt
  if (input.isAvailable !== undefined && input.isAvailable !== existing.isAvailable) {
    data.isAvailable = input.isAvailable;
    data.lastStatusChangeAt = new Date();
  }

  return prisma.clothingItem.update({ where: { id: existing.id }, data, select: CLOTHING_SELECT });
}

/**
 * מחיקת פריט: הקשרים שלו ל-Looks ולבחירה הנוכחית נמחקים אוטומטית (Cascade).
 * מוחזר סיכום עקבי של מה שהוסר.
 */
export async function deleteClothingItem(auth: AuthContext, id: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.clothingItem.findFirst({ where: accessWhere(auth, id), select: { id: true } });
    if (!item) throw clothingNotFound();

    const [outfitLinks, selectionLinks] = await Promise.all([
      tx.outfitItem.findMany({ where: { clothingItemId: item.id }, select: { outfitId: true } }),
      tx.currentSelectionItem.count({ where: { clothingItemId: item.id } }),
    ]);

    await tx.clothingItem.delete({ where: { id: item.id } });

    return {
      deleted: true,
      id: item.id,
      removedFromOutfitIds: outfitLinks.map((link) => link.outfitId),
      removedFromCurrentSelection: selectionLinks > 0,
    };
  });
}
