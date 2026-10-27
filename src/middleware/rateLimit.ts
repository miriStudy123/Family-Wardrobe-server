import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const tooMany = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'יותר מדי בקשות. נסו שוב מאוחר יותר' },
};

/** הגבלת קצב לפי כתובת IP על נקודות ההתחברות ויצירת משפחה */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(tooMany);
  },
});
