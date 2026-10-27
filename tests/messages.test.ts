import { describe, expect, it } from 'vitest';
import { api, bearer, createChild, loginChild, setupFamily } from './helpers';

describe('הודעות', () => {
  it('ילד שולח הודעה, מנהל קורא ומסמן כנקראה', async () => {
    const family = await setupFamily();
    const child = await createChild(family, 'יוסי');
    const token = await loginChild(family, child);

    const sent = await api().post('/api/messages').set(bearer(token)).send({ body: 'החולצה הכחולה קטנה עליי' });
    expect(sent.status).toBe(201);
    expect(sent.body.message.childId).toBe(child.id);

    const unread = await api().get('/api/messages?unreadOnly=true').set(bearer(family.adminToken));
    expect(unread.body.data).toHaveLength(1);

    const read = await api().patch(`/api/messages/${sent.body.message.id}/read`).set(bearer(family.adminToken));
    expect(read.status).toBe(200);
    expect(read.body.message.readAt).not.toBeNull();

    const after = await api().get('/api/messages?unreadOnly=true').set(bearer(family.adminToken));
    expect(after.body.data).toHaveLength(0);
  });

  it('ילד רואה רק את ההודעות שלו ואינו יכול לסמן כנקראה', async () => {
    const family = await setupFamily();
    const a = await createChild(family, 'א');
    const b = await createChild(family, 'ב');
    const tokenA = await loginChild(family, a);
    const tokenB = await loginChild(family, b);
    const msg = await api().post('/api/messages').set(bearer(tokenA)).send({ body: 'הודעה מ-א' });
    await api().post('/api/messages').set(bearer(tokenB)).send({ body: 'הודעה מ-ב' });

    const listA = await api().get('/api/messages').set(bearer(tokenA));
    expect(listA.body.data.map((m: { body: string }) => m.body)).toEqual(['הודעה מ-א']);

    expect((await api().patch(`/api/messages/${msg.body.message.id}/read`).set(bearer(tokenA))).status).toBe(403);
  });

  it('מנהל של משפחה אחרת אינו רואה את ההודעות', async () => {
    const familyA = await setupFamily();
    const familyB = await setupFamily();
    const child = await createChild(familyA, 'א');
    const token = await loginChild(familyA, child);
    const msg = await api().post('/api/messages').set(bearer(token)).send({ body: 'פרטי' });

    const list = await api().get('/api/messages').set(bearer(familyB.adminToken));
    expect(list.body.data).toHaveLength(0);
    expect((await api().patch(`/api/messages/${msg.body.message.id}/read`).set(bearer(familyB.adminToken))).status).toBe(404);
  });

  it('מנהל אינו שולח הודעות דרך נקודת הקצה של הילד', async () => {
    const family = await setupFamily();
    const res = await api().post('/api/messages').set(bearer(family.adminToken)).send({ body: 'x' });
    expect(res.status).toBe(403);
  });
});
