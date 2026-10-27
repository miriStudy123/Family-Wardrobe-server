import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, bearer, childLoginRequest, createChild, setupFamily } from './helpers';

describe('משפחות והתחברות', () => {
  it('יצירת משפחה מחזירה קוד משפחה ושומרת את קוד המנהל כ-hash', async () => {
    const res = await api().post('/api/families').send({ name: 'משפחת לוי', adminCode: 'SuperSecret1' });
    expect(res.status).toBe(201);
    expect(res.body.family.familyCode).toMatch(/^[A-Z0-9]{8}$/);

    const stored = await prisma.family.findUniqueOrThrow({ where: { id: res.body.family.id } });
    expect(stored.adminCredentialHash).not.toContain('SuperSecret1');
    expect(stored.adminCredentialHash.startsWith('$2')).toBe(true);
  });

  it('יצירת משפחה עם קוד מנהל קצר נדחית', async () => {
    const res = await api().post('/api/families').send({ name: 'משפחה', adminCode: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('כניסת מנהל מצליחה ואינה יוצרת משפחה חדשה', async () => {
    const family = await setupFamily('משפחת כהן');
    const before = await prisma.family.count();
    const res = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: 'משפחת כהן', familyCode: family.familyCode, adminCode: family.adminCode });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.family.id).toBe(family.id);
    expect(await prisma.family.count()).toBe(before);
  });

  it('קוד משפחה לבדו (עם קוד מנהל שגוי) אינו מספיק', async () => {
    const family = await setupFamily();
    const res = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: family.name, familyCode: family.familyCode, adminCode: 'wrong-code' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('הודעת השגיאה זהה למשפחה לא קיימת ולקוד שגוי', async () => {
    const family = await setupFamily();
    const wrongCode = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: family.name, familyCode: family.familyCode, adminCode: 'nope-nope' });
    const noFamily = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: 'לא קיימת', familyCode: 'ZZZZZZZZ', adminCode: 'nope-nope' });
    expect(wrongCode.status).toBe(401);
    expect(noFamily.status).toBe(401);
    expect(noFamily.body).toEqual(wrongCode.body);
  });

  it('כניסת ילד מצליחה', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const res = await childLoginRequest(family, child);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('child');
    expect(res.body.child.id).toBe(child.id);
  });

  it('כניסת ילד עם קוד שגוי נכשלת', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const res = await childLoginRequest(family, child, { childCode: 'AAAAAA' });
    expect(res.status).toBe(401);
  });

  it('קוד הילד נשמר כ-hash ולא בטקסט גלוי', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const stored = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    expect(JSON.stringify(stored)).not.toContain(child.code);
  });

  it('חסימה זמנית לאחר ניסיונות כושלים — גם קוד נכון נחסם', async () => {
    const family = await setupFamily();
    for (let i = 0; i < 5; i += 1) {
      const res = await api()
        .post('/api/auth/admin/login')
        .send({ familyName: family.name, familyCode: family.familyCode, adminCode: `wrong-${i}` });
      expect(res.status).toBe(401);
    }
    const blocked = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: family.name, familyCode: family.familyCode, adminCode: family.adminCode });
    expect(blocked.status).toBe(429);
  });

  it('חסימת ניחוש קוד ילד', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    for (let i = 0; i < 5; i += 1) {
      await childLoginRequest(family, child, { childCode: `XXXX${i}${i}` });
    }
    const blocked = await childLoginRequest(family, child);
    expect(blocked.status).toBe(429);
  });

  it('AuthMe מחזיר את המנהל המחובר', async () => {
    const family = await setupFamily('משפחת מזרחי');
    const res = await api().get('/api/auth/me').set(bearer(family.adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      familyName: 'משפחת מזרחי',
      familyCode: family.familyCode,
      role: 'admin',
      name: null,
    });
  });

  it('AuthMe מחזיר את הילד המחובר', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'נועה', 'girl');
    const token = (await childLoginRequest(family, child)).body.token;
    const res = await api().get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      familyName: family.name,
      familyCode: family.familyCode,
      role: 'child',
      name: 'נועה',
    });
  });

  it('AuthMe ללא טוקן או אחרי התנתקות נדחה', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    const family = await setupFamily();
    await api().post('/api/auth/logout').set(bearer(family.adminToken));
    expect((await api().get('/api/auth/me').set(bearer(family.adminToken))).status).toBe(401);
  });

  it('התנתקות מבטלת את הטוקן', async () => {
    const family = await setupFamily();
    const out = await api().post('/api/auth/logout').set(bearer(family.adminToken));
    expect(out.status).toBe(204);
    const after = await api().get('/api/families/current').set(bearer(family.adminToken));
    expect(after.status).toBe(401);
  });

  it('Session שפג תוקפו נדחה', async () => {
    const family = await setupFamily();
    await prisma.session.updateMany({ where: { familyId: family.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api().get('/api/families/current').set(bearer(family.adminToken));
    expect(res.status).toBe(401);
  });

  it('החלפת קוד מנהל דורשת את הקוד הנוכחי ומאפשרת כניסה עם הקוד החדש', async () => {
    const family = await setupFamily();
    const wrong = await api()
      .post('/api/auth/admin/change-code')
      .set(bearer(family.adminToken))
      .send({ currentAdminCode: 'not-the-code', newAdminCode: 'Brand-New-Code-1' });
    expect(wrong.status).toBe(401);

    const changed = await api()
      .post('/api/auth/admin/change-code')
      .set(bearer(family.adminToken))
      .send({ currentAdminCode: family.adminCode, newAdminCode: 'Brand-New-Code-1' });
    expect(changed.status).toBe(200);

    const login = await api()
      .post('/api/auth/admin/login')
      .send({ familyName: family.name, familyCode: family.familyCode, adminCode: 'Brand-New-Code-1' });
    expect(login.status).toBe(200);
  });

  it('GET /api/families/current — מנהל מקבל את קוד המשפחה', async () => {
    const family = await setupFamily();
    const res = await api().get('/api/families/current').set(bearer(family.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.family.familyCode).toBe(family.familyCode);
  });

  it('בקשה ללא טוקן נדחית', async () => {
    const res = await api().get('/api/children');
    expect(res.status).toBe(401);
  });
});
