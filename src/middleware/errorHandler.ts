import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

const body = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(body('ROUTE_NOT_FOUND', 'הנתיב המבוקש לא נמצא'));
};

/**
 * מטפל שגיאות מרכזי — מבנה תשובה אחיד, ללא חשיפת Stack Traces או פרטים פנימיים.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      body(
        'VALIDATION_ERROR',
        'הבקשה אינה תקינה',
        err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      ),
    );
    return;
  }

  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json(body('INVALID_JSON', 'גוף הבקשה אינו JSON תקין'));
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json(body('PAYLOAD_TOO_LARGE', 'גוף הבקשה גדול מדי'));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json(body('CONFLICT', 'הנתון כבר קיים'));
      return;
    }
    if (err.code === 'P2025' || err.code === 'P2003') {
      res.status(404).json(body('NOT_FOUND', 'המשאב לא נמצא'));
      return;
    }
  }

  if (env.NODE_ENV !== 'test') {
    console.error('[unhandled error]', err);
  }
  res.status(500).json(body('INTERNAL_ERROR', 'אירעה שגיאה פנימית'));
};
