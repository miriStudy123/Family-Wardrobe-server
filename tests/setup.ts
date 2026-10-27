import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';

// הגנה: הבדיקות מוחקות נתונים — מותר להריץ אותן רק מול מסד נתונים של בדיקות
const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(
    `הבדיקות חייבות לרוץ מול מסד נתונים שמסתיים ב-_test (התקבל: "${dbName}"). ` +
      'יש ליצור את .env.test לפי .env.test.example',
  );
}

// כל בדיקה מתחילה ממסד נתונים נקי
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Message", "OutfitItem", "Outfit", "CurrentSelectionItem", "CurrentSelection", ' +
      '"ClothingItem", "Session", "Child", "Family", "LoginThrottle" CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
