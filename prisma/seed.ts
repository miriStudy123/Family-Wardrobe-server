// ============================================================
// נתוני דמו לבדיקה ידנית: npm run db:seed
// ============================================================
// יוצר משפחה אחת עם קודים קבועים וידועים. הרצה חוזרת מוחקת ויוצרת אותה מחדש
// (לפי קוד המשפחה בלבד) — שאר הנתונים במסד אינם נפגעים.

import type { ClothingCategory, Gender, Season } from '@prisma/client';
import { hashSecret, keyedDigest, normalizeName } from '../src/lib/crypto';
import { prisma } from '../src/lib/prisma';

const FAMILY = { name: 'משפחת לוי', familyCode: 'TEST2345', adminCode: 'Admin1234' };

type SeedItem = { name: string; category: ClothingCategory; season: Season; isAvailable?: boolean };

const CHILDREN: { name: string; gender: Gender; code: string; items: SeedItem[]; outfit: string[] }[] = [
  {
    name: 'נועה',
    gender: 'girl',
    code: 'ABC234',
    items: [
      { name: 'חולצה לבנה', category: 'shirt', season: 'summer' },
      { name: 'סוודר ורוד', category: 'shirt', season: 'winter' },
      { name: 'ג׳ינס כחול', category: 'trousers', season: 'all_season' },
      { name: 'חצאית ג׳ינס', category: 'skirt', season: 'summer' },
      { name: 'שמלה פרחונית', category: 'dress', season: 'summer', isAvailable: false },
      { name: 'קשת לשיער', category: 'accessories', season: 'all_season' },
    ],
    outfit: ['חולצה לבנה', 'חצאית ג׳ינס', 'קשת לשיער'],
  },
  {
    name: 'יוסי',
    gender: 'boy',
    code: 'XYZ789',
    items: [
      { name: 'חולצת כדורגל', category: 'shirt', season: 'summer' },
      { name: 'קפוצ׳ון אפור', category: 'shirt', season: 'winter' },
      { name: 'מכנס קצר', category: 'trousers', season: 'summer' },
      { name: 'טרנינג שחור', category: 'trousers', season: 'winter', isAvailable: false },
      { name: 'כובע מצחייה', category: 'accessories', season: 'all_season' },
    ],
    outfit: ['חולצת כדורגל', 'מכנס קצר', 'כובע מצחייה'],
  },
];

async function main() {
  await prisma.family.deleteMany({ where: { familyCode: FAMILY.familyCode } });

  const family = await prisma.family.create({
    data: {
      name: FAMILY.name,
      nameNormalized: normalizeName(FAMILY.name),
      familyCode: FAMILY.familyCode,
      adminCredentialHash: await hashSecret(FAMILY.adminCode),
    },
  });

  for (const seed of CHILDREN) {
    const child = await prisma.child.create({
      data: {
        familyId: family.id,
        name: seed.name,
        nameNormalized: normalizeName(seed.name),
        gender: seed.gender,
        childCodeDigest: keyedDigest(`child-code|${family.id}|${seed.code}`),
        credentialHash: await hashSecret(seed.code),
      },
    });

    const items = await Promise.all(
      seed.items.map((item) => prisma.clothingItem.create({ data: { childId: child.id, ...item } })),
    );

    await prisma.outfit.create({
      data: {
        childId: child.id,
        name: `ה-Look של ${seed.name}`,
        items: {
          create: items
            .filter((item) => seed.outfit.includes(item.name))
            .map((item) => ({ clothingItemId: item.id })),
        },
      },
    });

    await prisma.message.create({
      data: { familyId: family.id, childId: child.id, body: `היי, ${seed.gender === 'girl' ? 'זו' : 'זה'} ${seed.name}! אפשר לכבס לי את הבגדים?` },
    });
  }

  console.log('נתוני הדמו נוצרו:', FAMILY.name, FAMILY.familyCode);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
