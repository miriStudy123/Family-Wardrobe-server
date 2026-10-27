import { describe, expect, it } from 'vitest';
import { api, bearer, createChild, createItem, loginChild, setupFamily } from './helpers';

describe('בגדים', () => {
  it('יצירה, עדכון ומחיקה של פריט', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const item = await createItem(family, child.id, { name: 'חולצה כחולה' });
    expect(item.isAvailable).toBe(true);

    const updated = await api()
      .patch(`/api/clothing/${item.id}`)
      .set(bearer(family.adminToken))
      .send({ name: 'חולצה תכלת', season: 'summer' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.name).toBe('חולצה תכלת');
    expect(updated.body.item.season).toBe('summer');

    const deleted = await api().delete(`/api/clothing/${item.id}`).set(bearer(family.adminToken));
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted).toBe(true);
    expect((await api().get(`/api/clothing/${item.id}`).set(bearer(family.adminToken))).status).toBe(404);
  });

  it('קטגוריה ועונה לא חוקיות נדחות', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const res = await api()
      .post('/api/clothing')
      .set(bearer(family.adminToken))
      .send({ childId: child.id, name: 'x', category: 'hat', season: 'spring' });
    expect(res.status).toBe(400);
  });

  it('סינון לפי זמינות, עונה וקטגוריה — כולל isAvailable=false', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'רחל', 'girl');
    await createItem(family, child.id, { name: 'מעיל', category: 'shirt', season: 'winter' });
    await createItem(family, child.id, { name: 'שמלת קיץ', category: 'dress', season: 'summer' });
    await createItem(family, child.id, { name: 'חצאית', category: 'skirt', season: 'winter', isAvailable: false });

    const winter = await api()
      .get(`/api/clothing?childId=${child.id}&season=winter&isAvailable=true`)
      .set(bearer(family.adminToken));
    expect(winter.status).toBe(200);
    expect(winter.body.data.map((i: { name: string }) => i.name)).toEqual(['מעיל']);

    const unavailable = await api()
      .get(`/api/clothing?childId=${child.id}&isAvailable=false`)
      .set(bearer(family.adminToken));
    expect(unavailable.body.data.map((i: { name: string }) => i.name)).toEqual(['חצאית']);

    const dresses = await api()
      .get(`/api/clothing?childId=${child.id}&category=dress`)
      .set(bearer(family.adminToken));
    expect(dresses.body.data).toHaveLength(1);
  });

  it('פרמטרים לא מוכרים, מיון לא מאושר או limit חריג נדחים', async () => {
    const family = await setupFamily();
    for (const qs of ['foo=bar', 'sortBy=childId', 'limit=500', 'isAvailable=maybe']) {
      const res = await api().get(`/api/clothing?${qs}`).set(bearer(family.adminToken));
      expect(res.status).toBe(400);
    }
  });

  it('דפדוף ומיון', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    for (const name of ['ג', 'א', 'ב']) await createItem(family, child.id, { name });
    const res = await api()
      .get(`/api/clothing?childId=${child.id}&sortBy=name&sortOrder=asc&limit=2&page=1`)
      .set(bearer(family.adminToken));
    expect(res.body.data.map((i: { name: string }) => i.name)).toEqual(['א', 'ב']);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('ברירת מחדל לילד boy — ללא חצאיות ושמלות, אך הנתונים נשמרים', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'דוד', 'boy');
    await createItem(family, child.id, { category: 'shirt', name: 'חולצה' });
    await createItem(family, child.id, { category: 'dress', name: 'שמלה' });

    const token = await loginChild(family, child);
    const def = await api().get('/api/clothing').set(bearer(token));
    expect(def.body.data.map((i: { name: string }) => i.name)).toEqual(['חולצה']);
    expect(def.body.meta.defaultCategoryFilterApplied).toBe(true);

    const all = await api().get('/api/clothing?allCategories=true').set(bearer(token));
    expect(all.body.data).toHaveLength(2);
  });

  it('רק מנהל יכול ליצור/למחוק פריטים', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const item = await createItem(family, child.id);
    const token = await loginChild(family, child);
    const create = await api()
      .post('/api/clothing')
      .set(bearer(token))
      .send({ childId: child.id, name: 'x', category: 'shirt', season: 'summer' });
    expect(create.status).toBe(403);
    expect((await api().delete(`/api/clothing/${item.id}`).set(bearer(token))).status).toBe(403);
  });

  it('ילד אינו יכול לשנות זמינות ישירות', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const item = await createItem(family, child.id, { isAvailable: false });
    const token = await loginChild(family, child);
    const res = await api().patch(`/api/clothing/${item.id}`).set(bearer(token)).send({ isAvailable: true });
    expect(res.status).toBe(403);
    const check = await api().get(`/api/clothing/${item.id}`).set(bearer(family.adminToken));
    expect(check.body.item.isAvailable).toBe(false);
  });

  it('מנהל מחזיר פריט לזמינות ו-lastStatusChangeAt מתעדכן; עדכון ללא שינוי זמינות אינו מעדכן', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const item = await createItem(family, child.id, { isAvailable: false });

    const sameStatus = await api()
      .patch(`/api/clothing/${item.id}`)
      .set(bearer(family.adminToken))
      .send({ isAvailable: false, name: 'שם חדש' });
    expect(sameStatus.body.item.lastStatusChangeAt).toBe(item.lastStatusChangeAt);

    const restored = await api()
      .patch(`/api/clothing/${item.id}`)
      .set(bearer(family.adminToken))
      .send({ isAvailable: true });
    expect(restored.body.item.isAvailable).toBe(true);
    expect(new Date(restored.body.item.lastStatusChangeAt).getTime()).toBeGreaterThan(
      new Date(item.lastStatusChangeAt as string).getTime(),
    );
  });

  it('מנהל רואה את בגדי כל הילדים במשפחה', async () => {
    const family = await setupFamily();
    const a = await createChild(family, 'א');
    const b = await createChild(family, 'ב', 'girl');
    await createItem(family, a.id);
    await createItem(family, b.id);
    const res = await api().get('/api/clothing').set(bearer(family.adminToken));
    expect(res.body.pagination.total).toBe(2);
  });
});
