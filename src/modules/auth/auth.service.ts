import { env } from '../../config/env';
import { getRecommendedCategories } from '../../domain/categoryRules';
import {
  generateSessionToken,
  hashSecret,
  hashToken,
  normalizeCode,
  normalizeName,
  verifyAgainstDummy,
  verifySecret,
} from '../../lib/crypto';
import { unauthorized } from '../../lib/errors';
import { type Db, prisma } from '../../lib/prisma';
import type { AuthContext, Role } from '../../types/auth';
import type { AdminLoginInput, ChangeAdminCodeInput, ChildLoginInput } from './auth.schemas';
import { assertNotLocked, registerFailure, registerSuccess, throttleKey } from './loginThrottle';

/** הודעת שגיאה אחידה — אינה חושפת אם משפחה או ילד קיימים */
const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'פרטי ההתחברות שגויים');

async function createSession(
  db: Db,
  data: { role: Role; familyId: string; childId?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_MINUTES * 60_000);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      role: data.role,
      familyId: data.familyId,
      childId: data.childId ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function adminLogin(input: AdminLoginInput) {
  const familyCode = normalizeCode(input.familyCode);
  const key = throttleKey('admin', familyCode);
  await assertNotLocked(key);

  const family = await prisma.family.findUnique({ where: { familyCode } });
  const nameMatches = family !== null && family.nameNormalized === normalizeName(input.familyName);

  const valid =
    family && nameMatches
      ? await verifySecret(input.adminCode, family.adminCredentialHash)
      : await verifyAgainstDummy(input.adminCode);

  if (!valid || !family) {
    await registerFailure(key);
    throw invalidCredentials();
  }

  await registerSuccess(key);
  const session = await createSession(prisma, { role: 'admin', familyId: family.id });

  return {
    token: session.token,
    tokenType: 'Bearer' as const,
    expiresAt: session.expiresAt,
    role: 'admin' as const,
    family: { id: family.id, name: family.name },
  };
}

/**
 * כניסת ילד. לאחר אימות מוצלח — באותה טרנזקציה — הבחירה הנוכחית מתאפסת לרשימה ריקה
 * ונוצר Session חדש. האיפוס אינו נוגע בבגדים, ב-Looks או בזמינות.
 */
export async function childLogin(input: ChildLoginInput) {
  const familyCode = normalizeCode(input.familyCode);
  const childNameNormalized = normalizeName(input.childName);
  const key = throttleKey('child', familyCode, childNameNormalized);
  await assertNotLocked(key);

  const family = await prisma.family.findUnique({ where: { familyCode } });
  const familyMatches = family !== null && family.nameNormalized === normalizeName(input.familyName);

  const child = familyMatches
    ? await prisma.child.findUnique({
        where: { familyId_nameNormalized: { familyId: family.id, nameNormalized: childNameNormalized } },
      })
    : null;

  const valid = child
    ? await verifySecret(normalizeCode(input.childCode), child.credentialHash)
    : await verifyAgainstDummy(input.childCode);

  if (!valid || !child || !family) {
    await registerFailure(key);
    throw invalidCredentials();
  }

  await registerSuccess(key);

  const session = await prisma.$transaction(async (tx) => {
    const selection = await tx.currentSelection.upsert({
      where: { childId: child.id },
      create: { childId: child.id },
      update: {},
    });
    await tx.currentSelectionItem.deleteMany({ where: { selectionId: selection.id } });
    await tx.currentSelection.update({ where: { id: selection.id }, data: { updatedAt: new Date() } });
    return createSession(tx, { role: 'child', familyId: family.id, childId: child.id });
  });

  return {
    token: session.token,
    tokenType: 'Bearer' as const,
    expiresAt: session.expiresAt,
    role: 'child' as const,
    family: { id: family.id, name: family.name },
    child: {
      id: child.id,
      name: child.name,
      gender: child.gender,
      recommendedCategories: getRecommendedCategories(child.gender),
    },
  };
}

/**
 * המשתמש המחובר (AuthMe) — לפי ה-Session בלבד.
 * name: שם הילד כשמחובר ילד; null כשמחובר מנהל.
 */
export async function getMe(auth: AuthContext) {
  const family = await prisma.family.findUnique({
    where: { id: auth.familyId },
    select: { name: true, familyCode: true },
  });
  if (!family) throw unauthorized();

  const base = { familyName: family.name, familyCode: family.familyCode, role: auth.role };

  if (auth.role === 'admin') return { ...base, name: null };

  const child = await prisma.child.findFirst({
    where: { id: auth.childId ?? '', familyId: auth.familyId },
    select: { name: true, gender: true },
  });
  if (!child) throw unauthorized();
  return { ...base, name: child.name, gender: child.gender };
}

export async function logout(auth: AuthContext): Promise<void> {
  await prisma.session.deleteMany({ where: { id: auth.sessionId } });
}

/**
 * החלפת קוד מנהל (תהליך איפוס מאובטח): דורש התחברות מנהל וגם את הקוד הנוכחי.
 * לאחר ההחלפה כל ה-Sessions האחרים של המנהל מבוטלים.
 */
export async function changeAdminCode(auth: AuthContext, input: ChangeAdminCodeInput): Promise<void> {
  const key = throttleKey('admin-change', auth.familyId);
  await assertNotLocked(key);

  const family = await prisma.family.findUniqueOrThrow({ where: { id: auth.familyId } });
  const valid = await verifySecret(input.currentAdminCode, family.adminCredentialHash);
  if (!valid) {
    await registerFailure(key);
    throw invalidCredentials();
  }
  await registerSuccess(key);

  const adminCredentialHash = await hashSecret(input.newAdminCode);
  await prisma.$transaction([
    prisma.family.update({ where: { id: family.id }, data: { adminCredentialHash } }),
    prisma.session.deleteMany({
      where: { familyId: family.id, role: 'admin', id: { not: auth.sessionId } },
    }),
  ]);
}
