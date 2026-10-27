import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** אלפבית ללא תווים שקל לבלבל ביניהם (0/O, 1/I/L) */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const FAMILY_CODE_LENGTH = 8;
export const CHILD_CODE_LENGTH = 6;

/** יצירת קוד אקראי בטוח קריפטוגרפית */
export function generateCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** נרמול קוד שהוקלד: אותיות גדולות, ללא רווחים ומקפים */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

/** נרמול שם להשוואה */
export function normalizeName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, env.BCRYPT_ROUNDS);
}

export function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * השוואה מול hash מדומה כאשר המשתמש לא נמצא — כדי שזמן התגובה לא יחשוף
 * אם משפחה או ילד קיימים.
 */
export async function verifyAgainstDummy(secret: string): Promise<false> {
  dummyHashPromise ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), env.BCRYPT_ROUNDS);
  await bcrypt.compare(secret, await dummyHashPromise);
  return false;
}

/** HMAC דטרמיניסטי עם סוד השרת — לאכיפת ייחודיות ולמפתחות חסימה */
export function keyedDigest(value: string): string {
  return crypto.createHmac('sha256', env.CODE_PEPPER).update(value).digest('hex');
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
