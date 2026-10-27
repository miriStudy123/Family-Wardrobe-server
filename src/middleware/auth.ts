import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { hashToken } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AuthContext, Role } from '../types/auth';

/**
 * מזהה את המשתמש לפי טוקן Bearer בלבד.
 * התפקיד, המשפחה והילד נלקחים מה-Session השמור בשרת — לעולם לא מנתוני הבקשה.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw unauthorized();

  const token = header.slice('Bearer '.length).trim();
  if (!token || token.length > 200) throw unauthorized();

  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    throw unauthorized('SESSION_EXPIRED', 'ההתחברות פגה. יש להתחבר מחדש');
  }

  if (session.role === 'child' && !session.childId) throw unauthorized();

  req.auth = {
    sessionId: session.id,
    role: session.role,
    familyId: session.familyId,
    childId: session.childId,
  };
  next();
});

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    return next();
  };
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** מחזיר את מזהה הילד המחובר — מתוך ה-Session בלבד */
export function getChildId(req: Request): string {
  const auth = getAuth(req);
  if (auth.role !== 'child' || !auth.childId) throw forbidden();
  return auth.childId;
}
