export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (code = 'UNAUTHORIZED', message = 'נדרשת התחברות') =>
  new AppError(401, code, message);

export const forbidden = (code = 'FORBIDDEN', message = 'אין הרשאה לביצוע הפעולה') =>
  new AppError(403, code, message);

export const notFound = (code = 'NOT_FOUND', message = 'המשאב לא נמצא', details?: unknown) =>
  new AppError(404, code, message, details);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);

export const tooManyRequests = (message = 'יותר מדי ניסיונות. נסו שוב מאוחר יותר') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);
