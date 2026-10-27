import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`השרת פועל: http://localhost:${env.PORT}`);
  console.log(`תיעוד Swagger: http://localhost:${env.PORT}/api/docs`);
});

// ניקוי תקופתי של Sessions שפג תוקפם ושל רשומות חסימה ישנות
const cleanup = setInterval(
  () => {
    const now = new Date();
    Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.loginThrottle.deleteMany({
        where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
      }),
    ]).catch((error) => console.error('[cleanup]', error));
  },
  60 * 60_000,
);
cleanup.unref();

function shutdown(signal: string) {
  console.log(`${signal} התקבל — סוגר את השרת`);
  clearInterval(cleanup);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
