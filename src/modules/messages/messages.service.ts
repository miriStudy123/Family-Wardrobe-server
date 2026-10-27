import type { Prisma } from '@prisma/client';
import { forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { paginationMeta } from '../../lib/schemas';
import type { AuthContext } from '../../types/auth';

const MESSAGE_SELECT = {
  id: true,
  childId: true,
  body: true,
  createdAt: true,
  readAt: true,
  child: { select: { name: true } },
} as const satisfies Prisma.MessageSelect;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

function serialize(message: MessageRow) {
  return {
    id: message.id,
    childId: message.childId,
    childName: message.child.name,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
  };
}

/** ילד שולח הודעה למנהל המשפחה שלו. המשפחה והילד נלקחים מה-Session בלבד. */
export async function sendMessage(auth: AuthContext, body: string) {
  if (auth.role !== 'child' || !auth.childId) throw forbidden();
  const message = await prisma.message.create({
    data: { familyId: auth.familyId, childId: auth.childId, body },
    select: MESSAGE_SELECT,
  });
  return serialize(message);
}

/** מנהל — כל הודעות המשפחה; ילד — רק ההודעות שהוא שלח */
export async function listMessages(
  auth: AuthContext,
  query: { page: number; limit: number; unreadOnly?: boolean; childId?: string },
) {
  const where: Prisma.MessageWhereInput = { familyId: auth.familyId };
  if (auth.role === 'child') {
    if (query.childId && query.childId !== auth.childId) throw forbidden();
    where.childId = auth.childId ?? '';
  } else if (query.childId) {
    where.childId = query.childId;
  }
  if (query.unreadOnly) where.readAt = null;

  const [total, rows] = await prisma.$transaction([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: MESSAGE_SELECT,
    }),
  ]);

  return { data: rows.map(serialize), pagination: paginationMeta(query.page, query.limit, total) };
}

/** סימון כנקראה — מנהל בלבד, הודעות המשפחה שלו בלבד. פעולה אידמפוטנטית. */
export async function markAsRead(auth: AuthContext, id: string) {
  const message = await prisma.message.findFirst({ where: { id, familyId: auth.familyId }, select: { id: true } });
  if (!message) throw notFound('MESSAGE_NOT_FOUND', 'ההודעה לא נמצאה');

  await prisma.message.updateMany({ where: { id: message.id, readAt: null }, data: { readAt: new Date() } });
  const updated = await prisma.message.findUniqueOrThrow({ where: { id: message.id }, select: MESSAGE_SELECT });
  return serialize(updated);
}
