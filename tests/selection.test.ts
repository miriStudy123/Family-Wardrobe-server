import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { addToSelection, api, bearer, createChild, createItem, loginChild, setupFamily } from './helpers';

async function scenario() {
  const family = await setupFamily();
  const child = await createChild(family, 'יוסי');
  const shirt = await createItem(family, child.id, { name: 'חולצה', category: 'shirt' });
  const pants = await createItem(family, child.id, { name: 'מכנסיים', category: 'trousers' });
  return { family, child, shirt, pants };
}

const getSelection = (token: string) => api().get('/api/current-selection').set(bearer(token));

describe('בחירה נוכחית — איפוס בכניסה', () => {
  it('הבחירה ריקה מיד לאחר כניסה חדשה ומוצלחת', async () => {
    const { family, child } = await scenario();
    const token = await loginChild(family, child);
    const res = await getSelection(token);
    expect(res.status).toBe(200);
    expect(res.body.selection.items).toEqual([]);
  });

  it('בחירה נשמרת לאורך אותה התחברות ואינה מתאפסת בכל בקשת API', async () => {
    const { family, child, shirt } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    for (let i = 0; i < 3; i += 1) {
      await api().get('/api/clothing').set(bearer(token));
      const res = await getSelection(token);
      expect(res.body.selection.items.map((i: { id: string }) => i.id)).toEqual([shirt.id]);
    }
  });

  it('כניסה חדשה מאפסת בחירה קודמת — בלי למחוק בגדים, Looks או לשנות זמינות', async () => {
    const { family, child, shirt, pants } = await scenario();
    const token1 = await loginChild(family, child);
    await addToSelection(token1, shirt.id);
    await addToSelection(token1, pants.id);
    const look = await api().post('/api/outfits').set(bearer(token1)).send({ name: 'לוק' });
    expect(look.status).toBe(201);

    const token2 = await loginChild(family, child);
    const res = await getSelection(token2);
    expect(res.body.selection.items).toEqual([]);

    expect(await prisma.clothingItem.count({ where: { childId: child.id } })).toBe(2);
    expect(await prisma.clothingItem.count({ where: { childId: child.id, isAvailable: true } })).toBe(2);
    const looks = await api().get('/api/outfits').set(bearer(token2));
    expect(looks.body.data).toHaveLength(1);
    expect(looks.body.data[0].itemCount).toBe(2);
  });
});

describe('בחירה נוכחית — הוספה והסרה', () => {
  it('הוספת פריט והסרתו; בחירה אינה משנה זמינות', async () => {
    const { family, child, shirt } = await scenario();
    const token = await loginChild(family, child);

    const added = await addToSelection(token, shirt.id);
    expect(added.status).toBe(200);
    expect(added.body.selection.items[0].isAvailable).toBe(true);

    const dup = await addToSelection(token, shirt.id);
    expect(dup.body.selection.itemCount).toBe(1);

    const item = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });
    expect(item.isAvailable).toBe(true);

    const removed = await api().delete(`/api/current-selection/items/${shirt.id}`).set(bearer(token));
    expect(removed.status).toBe(200);
    expect(removed.body.selection.items).toEqual([]);
  });

  it('לא ניתן להוסיף פריט של ילד אחר', async () => {
    const { family, child } = await scenario();
    const other = await createChild(family, 'אחר');
    const othersItem = await createItem(family, other.id);
    const token = await loginChild(family, child);
    const res = await addToSelection(token, othersItem.id);
    expect(res.status).toBe(404);
    expect(await prisma.currentSelectionItem.count()).toBe(0);
  });

  it('PUT מחליף את הבחירה כולה', async () => {
    const { family, child, shirt, pants } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    const res = await api()
      .put('/api/current-selection')
      .set(bearer(token))
      .send({ clothingItemIds: [pants.id] });
    expect(res.body.selection.items.map((i: { id: string }) => i.id)).toEqual([pants.id]);
  });

  it('פריט שהפך ללא זמין נשאר בבחירה ומסומן', async () => {
    const { family, child, shirt } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    await api().patch(`/api/clothing/${shirt.id}`).set(bearer(family.adminToken)).send({ isAvailable: false });
    const res = await getSelection(token);
    expect(res.body.selection.itemCount).toBe(1);
    expect(res.body.selection.unavailableItems).toEqual([{ id: shirt.id, name: 'חולצה' }]);
    expect(res.body.selection.canConfirm).toBe(false);
  });
});

describe('אישור לבישה', () => {
  it('כל הפריטים זמינים — כולם הופכים ללא זמינים, והבחירה נשמרת', async () => {
    const { family, child, shirt, pants } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    await addToSelection(token, pants.id);

    const res = await api().post('/api/current-selection/confirm').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);

    const items = await prisma.clothingItem.findMany({ where: { id: { in: [shirt.id, pants.id] } } });
    expect(items.every((i) => !i.isAvailable)).toBe(true);
    expect(res.body.selection.itemCount).toBe(2);
  });

  it('בחירה ריקה נדחית', async () => {
    const { family, child } = await scenario();
    const token = await loginChild(family, child);
    const res = await api().post('/api/current-selection/confirm').set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_SELECTION');
  });

  it('פריט אחד לא זמין — האישור נדחה ושום פריט אינו משתנה', async () => {
    const { family, child, shirt, pants } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    await addToSelection(token, pants.id);
    await api().patch(`/api/clothing/${pants.id}`).set(bearer(family.adminToken)).send({ isAvailable: false });
    const shirtBefore = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });

    const res = await api().post('/api/current-selection/confirm').set(bearer(token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEMS_UNAVAILABLE');
    expect(res.body.error.details.unavailableItems).toEqual([{ id: pants.id, name: 'מכנסיים' }]);

    const shirtAfter = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });
    expect(shirtAfter.isAvailable).toBe(true);
    expect(shirtAfter.lastStatusChangeAt).toEqual(shirtBefore.lastStatusChangeAt);
  });

  it('אישורים מקבילים של אותו פריט — רק אחד מצליח', async () => {
    const { family, child, shirt } = await scenario();
    const tokenA = await loginChild(family, child);
    const tokenB = await loginChild(family, child);
    await addToSelection(tokenA, shirt.id);

    const results = await Promise.all([
      api().post('/api/current-selection/confirm').set(bearer(tokenA)),
      api().post('/api/current-selection/confirm').set(bearer(tokenB)),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('אישור חוזר אינו גורם לשינוי כפול', async () => {
    const { family, child, shirt } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    await api().post('/api/current-selection/confirm').set(bearer(token));
    const first = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });

    const again = await api().post('/api/current-selection/confirm').set(bearer(token));
    expect(again.status).toBe(409);
    const second = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });
    expect(second.lastStatusChangeAt).toEqual(first.lastStatusChangeAt);
  });

  it('אחרי אישור וכניסה חדשה — הבחירה ריקה והפריטים נשארים לא זמינים', async () => {
    const { family, child, shirt } = await scenario();
    const token = await loginChild(family, child);
    await addToSelection(token, shirt.id);
    await api().post('/api/current-selection/confirm').set(bearer(token));

    const token2 = await loginChild(family, child);
    expect((await getSelection(token2)).body.selection.items).toEqual([]);
    const item = await prisma.clothingItem.findUniqueOrThrow({ where: { id: shirt.id } });
    expect(item.isAvailable).toBe(false);
  });

  it('מנהל אינו יכול לגשת לבחירה הנוכחית (נתיב לילד בלבד)', async () => {
    const { family } = await scenario();
    expect((await getSelection(family.adminToken)).status).toBe(403);
  });
});
