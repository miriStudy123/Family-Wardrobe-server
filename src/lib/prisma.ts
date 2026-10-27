import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** לקוח מסד נתונים — רגיל או בתוך טרנזקציה */
export type Db = PrismaClient | Prisma.TransactionClient;

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function uniqueViolationTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  return [];
}
