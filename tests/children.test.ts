import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, bearer, childLoginRequest, createChild, createItem, loginChild, setupFamily } from './helpers';

describe('ילדים', () => {
  it('יצירת ילד מחזירה קוד אישי ומשייכת אותו למשפחה', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'רחל', 'girl');
    expect(child.code).toMatch(/^[A-Z0-9]{6}$/);
    const stored = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    expect(stored.familyId).toBe(family.id);
  });

  it('שם ילד כפול באותה משפחה נדחה', async () => {
    const family = await setupFamily();
    await createChild(family, 'דוד');
    const res = await api().post('/api/children').set(bearer(family.adminToken)).send({ name: 'דוד', gender: 'boy' });
    expect(res.status).toBe(409);
  });

  it('כניסה עם קוד ילד תקין', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'משה');
    const res = await childLoginRequest(family, child);
    expect(res.status).toBe(200);
  });

  it('ילד אינו יכול לצפות בנתוני ילד אחר', async () => {
    const family = await setupFamily();
    const a = await createChild(family, 'אברהם');
    const b = await createChild(family, 'יצחק');
    const tokenA = await loginChild(family, a);
    const res = await api().get(`/api/children/${b.id}`).set(bearer(tokenA));
    expect(res.status).toBe(403);
    const self = await api().get(`/api/children/${a.id}`).set(bearer(tokenA));
    expect(self.status).toBe(200);
  });

  it('ילד אינו יכול ליצור ילדים או לראות את רשימת הילדים', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יעקב');
    const token = await loginChild(family, child);
    expect((await api().get('/api/children').set(bearer(token))).status).toBe(403);
    expect((await api().post('/api/children').set(bearer(token)).send({ name: 'x', gender: 'boy' })).status).toBe(403);
  });

  it('שינוי מגדר אינו מוחק בגדים', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'שרה', 'girl');
    await createItem(family, child.id, { category: 'dress', name: 'שמלה' });
    const res = await api().patch(`/api/children/${child.id}`).set(bearer(family.adminToken)).send({ gender: 'boy' });
    expect(res.status).toBe(200);
    expect(await prisma.clothingItem.count({ where: { childId: child.id } })).toBe(1);
  });

  it('איפוס קוד ילד מבטל Sessions קיימים והקוד הישן אינו עובד', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'לאה', 'girl');
    const oldToken = await loginChild(family, child);

    const reset = await api().post(`/api/children/${child.id}/reset-code`).set(bearer(family.adminToken));
    expect(reset.status).toBe(200);

    expect((await api().get('/api/current-selection').set(bearer(oldToken))).status).toBe(401);
    expect((await childLoginRequest(family, child)).status).toBe(401);
    expect((await childLoginRequest(family, { ...child, code: reset.body.childCode })).status).toBe(200);
  });

  it('מחיקת ילד מוחקת את נתוניו ללא קשרים יתומים', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'רבקה', 'girl');
    await createItem(family, child.id);
    const res = await api().delete(`/api/children/${child.id}`).set(bearer(family.adminToken));
    expect(res.status).toBe(204);
    expect(await prisma.clothingItem.count({ where: { childId: child.id } })).toBe(0);
    expect(await prisma.currentSelection.count({ where: { childId: child.id } })).toBe(0);
  });
});
