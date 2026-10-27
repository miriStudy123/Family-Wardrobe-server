import { env } from '../../config/env';
import { keyedDigest } from '../../lib/crypto';
import { tooManyRequests } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/**
 * חסימה זמנית לאחר ניסיונות כושלים חוזרים — לפי זהות ההתחברות (ולא רק לפי IP),
 * כהגנה מפני ניחוש קודים. המפתח הוא HMAC, כך שלא נשמר מידע גלוי.
 */
export function throttleKey(...parts: string[]): string {
  return keyedDigest(`login|${parts.join('|')}`);
}

export async function assertNotLocked(key: string): Promise<void> {
  const record = await prisma.loginThrottle.findUnique({ where: { key } });
  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    throw tooManyRequests();
  }
}

export async function registerFailure(key: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - env.LOGIN_WINDOW_MINUTES * 60_000);

  await prisma.$transaction(async (tx) => {
    const record = await tx.loginThrottle.findUnique({ where: { key } });
    const expired =
      !record ||
      record.firstFailedAt < windowStart ||
      (record.lockedUntil !== null && record.lockedUntil <= now);

    if (expired) {
      await tx.loginThrottle.upsert({
        where: { key },
        create: { key, failedCount: 1, firstFailedAt: now },
        update: { failedCount: 1, firstFailedAt: now, lockedUntil: null },
      });
      return;
    }

    const failedCount = record.failedCount + 1;
    await tx.loginThrottle.update({
      where: { key },
      data: {
        failedCount,
        lockedUntil:
          failedCount >= env.LOGIN_MAX_ATTEMPTS
            ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000)
            : null,
      },
    });
  });
}

export async function registerSuccess(key: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { key } });
}
