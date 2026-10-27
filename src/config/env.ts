import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL חסר"),
  CODE_PEPPER: z.string().min(32, "CODE_PEPPER חייב להכיל 32 תווים לפחות"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(50),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // אין להדפיס ערכי סודות — רק את שמות המשתנים הבעייתיים
  console.error("הגדרות סביבה שגויות:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
