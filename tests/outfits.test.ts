import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { addToSelection, api, bearer, createChild, createItem, loginChild, setupFamily } from './helpers';

async function scenario() {
  const family = await setupFamily();
  const child = await createChild(family, 'רחל', 'girl');
  const shirt = await createItem(family, child.id, { name: 'חולצה' });
  const skirt = await createItem(family, child.id, { name: 'חצאית', category: 'skirt' });
  const bag = await createItem(family, child.id, { name: 'תיק', category: 'accessories' });
  const token = await loginChild(family, child);
  return { family, child, shirt, skirt, bag, token };
}

const ids = (list: { id: string }[]) => list.map((i) => i.id).sort();

describe('Looks', () => {
  it('שמירת הבחירה הנוכחית כ-Look', async () => {
    const { shirt, skirt, token } = await scenario();
    await addToSelection(token, shirt.id);
    await addToSelection(token, skirt.id);
    const res = await api().post('/api/outfits').set(bearer(token)).send({ name: 'הלוק האהוב עליי' });
    expect(res.status).toBe(201);
    expect(ids(res.body.outfit.items)).toEqual([shirt.id, skirt.id].sort());
  });

  it('יצירת Look עם רשימת פריטים מפורשת', async () => {
    const { bag, token } = await scenario();
    const res = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [bag.id] });
    expect(res.status).toBe(201);
    expect(res.body.outfit.itemCount).toBe(1);
  });

  it('Look ריק נדחה', async () => {
    const { token } = await scenario();
    const res = await api().post('/api/outfits').set(bearer(token)).send({ name: 'ריק' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_OUTFIT');
  });

  it('שמירת Look אינה משנה זמינות', async () => {
    const { child, shirt, token } = await scenario();
    await addToSelection(token, shirt.id);
    await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק' });
    expect(await prisma.clothingItem.count({ where: { childId: child.id, isAvailable: false } })).toBe(0);
  });

  it('שינוי שם, הוספה והסרה של פריטים', async () => {
    const { shirt, skirt, bag, token } = await scenario();
    const created = await api().post('/api/outfits').set(bearer(token)).send({ name: 'א', clothingItemIds: [shirt.id] });
    const id = created.body.outfit.id;

    const renamed = await api().patch(`/api/outfits/${id}`).set(bearer(token)).send({ name: 'ב' });
    expect(renamed.body.outfit.name).toBe('ב');

    const added = await api().patch(`/api/outfits/${id}`).set(bearer(token)).send({ addItemIds: [skirt.id, bag.id] });
    expect(added.body.outfit.itemCount).toBe(3);

    const removed = await api().patch(`/api/outfits/${id}`).set(bearer(token)).send({ removeItemIds: [shirt.id] });
    expect(ids(removed.body.outfit.items)).toEqual([skirt.id, bag.id].sort());
  });

  it('הסרת כל הפריטים מ-Look נדחית ואינה משנה דבר', async () => {
    const { shirt, token } = await scenario();
    const created = await api().post('/api/outfits').set(bearer(token)).send({ name: 'א', clothingItemIds: [shirt.id] });
    const res = await api()
      .patch(`/api/outfits/${created.body.outfit.id}`)
      .set(bearer(token))
      .send({ name: 'חדש', removeItemIds: [shirt.id] });
    expect(res.status).toBe(400);
    const after = await api().get(`/api/outfits/${created.body.outfit.id}`).set(bearer(token));
    expect(after.body.outfit.name).toBe('א');
    expect(after.body.outfit.itemCount).toBe(1);
  });

  it('עריכת Look אינה משנה את הבחירה הנוכחית', async () => {
    const { shirt, skirt, token } = await scenario();
    await addToSelection(token, shirt.id);
    const created = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק' });
    await api().patch(`/api/outfits/${created.body.outfit.id}`).set(bearer(token)).send({ addItemIds: [skirt.id] });
    const sel = await api().get('/api/current-selection').set(bearer(token));
    expect(ids(sel.body.selection.items)).toEqual([shirt.id]);
  });

  it('פתיחת Look מחליפה את הבחירה (ללא מיזוג) ואינה משנה זמינות', async () => {
    const { child, shirt, skirt, bag, token } = await scenario();
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [skirt.id, bag.id] });
    await addToSelection(token, shirt.id);

    const res = await api().post(`/api/outfits/${look.body.outfit.id}/apply`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(ids(res.body.selection.items)).toEqual([skirt.id, bag.id].sort());
    expect(await prisma.clothingItem.count({ where: { childId: child.id, isAvailable: false } })).toBe(0);
    // הפריט מהבחירה הקודמת לא נמחק מהארון
    expect(await prisma.clothingItem.count({ where: { id: shirt.id } })).toBe(1);
  });

  it('Look עם פריט לא זמין — מצב עדכני מוחזר והאישור נחסם', async () => {
    const { family, shirt, skirt, token } = await scenario();
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [shirt.id, skirt.id] });
    await api().patch(`/api/clothing/${skirt.id}`).set(bearer(family.adminToken)).send({ isAvailable: false });

    const applied = await api().post(`/api/outfits/${look.body.outfit.id}/apply`).set(bearer(token));
    expect(applied.body.selection.unavailableItems).toEqual([{ id: skirt.id, name: 'חצאית' }]);
    expect(applied.body.selection.canConfirm).toBe(false);

    const confirm = await api().post('/api/current-selection/confirm').set(bearer(token));
    expect(confirm.status).toBe(409);
  });

  it('מחיקת פריט מסירה אותו מה-Looks ומהבחירה ללא קשרים יתומים', async () => {
    const { family, shirt, skirt, token } = await scenario();
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [shirt.id, skirt.id] });
    await addToSelection(token, shirt.id);

    const del = await api().delete(`/api/clothing/${shirt.id}`).set(bearer(family.adminToken));
    expect(del.body.removedFromOutfitIds).toEqual([look.body.outfit.id]);
    expect(del.body.removedFromCurrentSelection).toBe(true);

    expect(await prisma.outfitItem.count({ where: { clothingItemId: shirt.id } })).toBe(0);
    expect(await prisma.currentSelectionItem.count({ where: { clothingItemId: shirt.id } })).toBe(0);
    const after = await api().get(`/api/outfits/${look.body.outfit.id}`).set(bearer(token));
    expect(ids(after.body.outfit.items)).toEqual([skirt.id]);
  });

  it('ילד אינו יכול לראות או לפתוח Look של ילד אחר', async () => {
    const { family, shirt, token } = await scenario();
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'שלי', clothingItemIds: [shirt.id] });
    const other = await createChild(family, 'אחר');
    const otherToken = await loginChild(family, other);
    expect((await api().get(`/api/outfits/${look.body.outfit.id}`).set(bearer(otherToken))).status).toBe(404);
    expect((await api().post(`/api/outfits/${look.body.outfit.id}/apply`).set(bearer(otherToken))).status).toBe(404);
  });

  it('לא ניתן להוסיף ל-Look פריט של ילד אחר', async () => {
    const { family, shirt, token } = await scenario();
    const other = await createChild(family, 'אחר');
    const othersItem = await createItem(family, other.id);
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [shirt.id] });
    const res = await api().patch(`/api/outfits/${look.body.outfit.id}`).set(bearer(token)).send({ addItemIds: [othersItem.id] });
    expect(res.status).toBe(404);
  });

  it('מחיקת Look', async () => {
    const { shirt, token } = await scenario();
    const look = await api().post('/api/outfits').set(bearer(token)).send({ name: 'לוק', clothingItemIds: [shirt.id] });
    expect((await api().delete(`/api/outfits/${look.body.outfit.id}`).set(bearer(token))).status).toBe(204);
    expect(await prisma.clothingItem.count({ where: { id: shirt.id } })).toBe(1);
  });
});
