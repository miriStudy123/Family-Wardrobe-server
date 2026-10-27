import type { Child } from '@prisma/client';
import { type GenderValue, getRecommendedCategories } from '../../domain/categoryRules';
import {
  CHILD_CODE_LENGTH,
  generateCode,
  hashSecret,
  keyedDigest,
  normalizeName,
} from '../../lib/crypto';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors';
import { isUniqueViolation, prisma, uniqueViolationTargets } from '../../lib/prisma';
import type { AuthContext } from '../../types/auth';

const childNotFound = () => notFound('CHILD_NOT_FOUND', 'הילד לא נמצא');
const nameTaken = () => conflict('CHILD_NAME_TAKEN', 'כבר קיים ילד בשם זה במשפחה');

export function serializeChild(child: Child) {
  return {
    id: child.id,
    name: child.name,
    gender: child.gender,
    recommendedCategories: getRecommendedCategories(child.gender),
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}

/** קוד ילד חדש: מוחזר פעם אחת בלבד; נשמרים רק bcrypt hash ו-HMAC לאכיפת ייחודיות */
async function newChildCredentials(familyId: string) {
  const code = generateCode(CHILD_CODE_LENGTH);
  return {
    code,
    childCodeDigest: keyedDigest(`child-code|${familyId}|${code}`),
    credentialHash: await hashSecret(code),
  };
}

function isNameConflict(error: unknown): boolean {
  return isUniqueViolation(error) && uniqueViolationTargets(error).some((t) => t.includes('nameNormalized'));
}

export async function createChild(auth: AuthContext, input: { name: string; gender: GenderValue }) {
  const nameNormalized = normalizeName(input.name);
  const existing = await prisma.child.findUnique({
    where: { familyId_nameNormalized: { familyId: auth.familyId, nameNormalized } },
    select: { id: true },
  });
  if (existing) throw nameTaken();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const credentials = await newChildCredentials(auth.familyId);
    try {
      const child = await prisma.child.create({
        data: {
          familyId: auth.familyId,
          name: input.name,
          nameNormalized,
          gender: input.gender,
          childCodeDigest: credentials.childCodeDigest,
          credentialHash: credentials.credentialHash,
        },
      });
      return { child: serializeChild(child), childCode: credentials.code };
    } catch (error) {
      if (isNameConflict(error)) throw nameTaken();
      if (isUniqueViolation(error)) continue; // התנגשות נדירה בקוד הילד
      throw error;
    }
  }
  throw new AppError(500, 'CHILD_CODE_GENERATION_FAILED', 'לא ניתן היה ליצור קוד לילד. נסו שוב');
}

export async function listChildren(auth: AuthContext) {
  const children = await prisma.child.findMany({
    where: { familyId: auth.familyId },
    orderBy: { createdAt: 'asc' },
  });
  return children.map(serializeChild);
}

/** מנהל — כל ילד במשפחה; ילד — רק את עצמו */
export async function getChild(auth: AuthContext, id: string) {
  if (auth.role === 'child' && auth.childId !== id) throw forbidden();
  const child = await prisma.child.findFirst({ where: { id, familyId: auth.familyId } });
  if (!child) throw childNotFound();
  return serializeChild(child);
}

export async function updateChild(
  auth: AuthContext,
  id: string,
  input: { name?: string; gender?: GenderValue },
) {
  const child = await prisma.child.findFirst({ where: { id, familyId: auth.familyId } });
  if (!child) throw childNotFound();

  try {
    // שינוי מגדר משנה רק את קטגוריות התצוגה המומלצות — אינו מוחק בגדים
    const updated = await prisma.child.update({
      where: { id: child.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameNormalized: normalizeName(input.name) } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
      },
    });
    return serializeChild(updated);
  } catch (error) {
    if (isNameConflict(error)) throw nameTaken();
    throw error;
  }
}

/**
 * מדיניות מחיקה: מחיקת ילד מוחקת (Cascade) את בגדיו, ה-Looks שלו, הבחירה הנוכחית,
 * ההודעות שלו וה-Sessions שלו. לא נשארים קשרים יתומים.
 */
export async function deleteChild(auth: AuthContext, id: string) {
  const child = await prisma.child.findFirst({ where: { id, familyId: auth.familyId }, select: { id: true } });
  if (!child) throw childNotFound();
  await prisma.child.delete({ where: { id: child.id } });
}

/** איפוס קוד ילד: קוד חדש מוחזר פעם אחת, וכל ה-Sessions הפעילים של הילד מבוטלים */
export async function resetChildCode(auth: AuthContext, id: string) {
  const child = await prisma.child.findFirst({ where: { id, familyId: auth.familyId }, select: { id: true } });
  if (!child) throw childNotFound();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const credentials = await newChildCredentials(auth.familyId);
    try {
      await prisma.$transaction([
        prisma.child.update({
          where: { id: child.id },
          data: { childCodeDigest: credentials.childCodeDigest, credentialHash: credentials.credentialHash },
        }),
        prisma.session.deleteMany({ where: { childId: child.id } }),
      ]);
      return { childCode: credentials.code };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw new AppError(500, 'CHILD_CODE_GENERATION_FAILED', 'לא ניתן היה ליצור קוד לילד. נסו שוב');
}
