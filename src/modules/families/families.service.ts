import { getRecommendedCategories } from '../../domain/categoryRules';
import { FAMILY_CODE_LENGTH, generateCode, hashSecret, normalizeName } from '../../lib/crypto';
import { AppError, unauthorized } from '../../lib/errors';
import { isUniqueViolation, prisma } from '../../lib/prisma';
import type { AuthContext } from '../../types/auth';

/**
 * יצירת משפחה: שם, קוד משפחה ייחודי שהמערכת מייצרת, ו-hash של קוד המנהל —
 * הכל ברשומה אחת, כך שהיצירה אטומית.
 */
export async function createFamily(input: { name: string; adminCode: string }) {
  const adminCredentialHash = await hashSecret(input.adminCode);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const familyCode = generateCode(FAMILY_CODE_LENGTH);
    try {
      const family = await prisma.family.create({
        data: {
          name: input.name,
          nameNormalized: normalizeName(input.name),
          familyCode,
          adminCredentialHash,
        },
      });
      return {
        id: family.id,
        name: family.name,
        familyCode: family.familyCode,
        createdAt: family.createdAt,
      };
    } catch (error) {
      if (isUniqueViolation(error)) continue; // התנגשות נדירה בקוד — מנסים קוד חדש
      throw error;
    }
  }
  throw new AppError(500, 'FAMILY_CODE_GENERATION_FAILED', 'לא ניתן היה ליצור קוד משפחה. נסו שוב');
}

export async function getCurrentFamily(auth: AuthContext) {
  const family = await prisma.family.findUnique({ where: { id: auth.familyId } });
  if (!family) throw unauthorized();

  const base = { id: family.id, name: family.name, role: auth.role };

  if (auth.role === 'admin') {
    const childrenCount = await prisma.child.count({ where: { familyId: family.id } });
    return { ...base, familyCode: family.familyCode, childrenCount, createdAt: family.createdAt };
  }

  const child = await prisma.child.findFirst({
    where: { id: auth.childId ?? '', familyId: family.id },
    select: { id: true, name: true, gender: true },
  });
  if (!child) throw unauthorized();
  return { ...base, child: { ...child, recommendedCategories: getRecommendedCategories(child.gender) } };
}
