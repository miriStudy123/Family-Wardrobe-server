import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** מעביר שגיאות מפונקציות אסינכרוניות למטפל השגיאות המרכזי */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
