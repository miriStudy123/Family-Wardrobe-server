import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { addToSelection, api, bearer, createChild, createItem, loginChild, setupFamily } from './helpers';

describe('אבטחה — הפרדה בין משפחות וילדים', () => {
  it('מנהל אינו יכול לגשת לבגדים, לילדים או לפריטים של משפחה אחרת', async () => {
    const familyA = await setupFamily('משפחה א');
    const familyB = await setupFamily('משפחה ב');
    const childB = await createChild(familyB, 'ילד ב');
    const itemB = await createItem(familyB, childB.id);

    const token = familyA.adminToken;
    expect((await api().get(`/api/clothing/${itemB.id}`).set(bearer(token))).status).toBe(404);
    expect((await api().patch(`/api/clothing/${itemB.id}`).set(bearer(token)).send({ isAvailable: false })).status).toBe(404);
    expect((await api().delete(`/api/clothing/${itemB.id}`).set(bearer(token))).status).toBe(404);
    expect((await api().get(`/api/children/${childB.id}`).set(bearer(token))).status).toBe(404);
    expect((await api().get(`/api/clothing?childId=${childB.id}`).set(bearer(token))).status).toBe(404);
    expect(
      (
        await api()
          .post('/api/clothing')
          .set(bearer(token))
          .send({ childId: childB.id, name: 'x', category: 'shirt', season: 'summer' })
      ).status,
    ).toBe(404);

    const list = await api().get('/api/clothing').set(bearer(token));
    expect(list.body.pagination.total).toBe(0);
  });

  it('ילד אינו יכול לגשת לנתוני ילד אחר באמצעות שינוי מזהה', async () => {
    const family = await setupFamily();
    const a = await createChild(family, 'א');
    const b = await createChild(family, 'ב');
    const itemB = await createItem(family, b.id);
    const tokenA = await loginChild(family, a);

    expect((await api().get(`/api/clothing?childId=${b.id}`).set(bearer(tokenA))).status).toBe(403);
    expect((await api().get(`/api/clothing/${itemB.id}`).set(bearer(tokenA))).status).toBe(404);
    expect((await addToSelection(tokenA, itemB.id)).status).toBe(404);
  });

  it('לא ניתן לשנות תפקיד או זהות באמצעות נתוני הבקשה', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'א');
    const token = await loginChild(family, child);

    // שדות זהות/תפקיד בבקשה נדחים (strict) ואינם משפיעים
    const res = await api()
      .post('/api/children')
      .set(bearer(token))
      .send({ name: 'x', gender: 'boy', role: 'admin', familyId: family.id });
    expect(res.status).toBe(403);

    const msg = await api()
      .post('/api/messages')
      .set(bearer(token))
      .send({ body: 'שלום', childId: '00000000-0000-0000-0000-000000000000' });
    expect(msg.status).toBe(400);
  });

  it('טוקן מזויף נדחה', async () => {
    const res = await api().get('/api/families/current').set(bearer('fake-token-value'));
    expect(res.status).toBe(401);
  });

  it('ולידציה — מזהה לא תקין ו-JSON שבור', async () => {
    const family = await setupFamily();
    expect((await api().get('/api/clothing/not-a-uuid').set(bearer(family.adminToken))).status).toBe(400);
    const broken = await api()
      .post('/api/families')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('INVALID_JSON');
  });

  it('שגיאות אינן חושפות Stack Trace', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\S+\s+\(/);
  });

  it('טוקן ההתחברות אינו נשמר במסד הנתונים בטקסט גלוי', async () => {
    const family = await setupFamily();
    const sessions = await prisma.session.findMany({ where: { familyId: family.id } });
    expect(sessions.some((s) => s.tokenHash === family.adminToken)).toBe(false);
  });
});
