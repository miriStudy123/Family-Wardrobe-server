import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app';

export const app = createApp();
export const api = () => request(app);

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface TestFamily {
  id: string;
  name: string;
  familyCode: string;
  adminCode: string;
  adminToken: string;
}

export interface TestChild {
  id: string;
  name: string;
  code: string;
}

let familyCounter = 0;

export async function setupFamily(name?: string): Promise<TestFamily> {
  familyCounter += 1;
  const familyName = name ?? `משפחה ${familyCounter}`;
  const adminCode = 'Admin-Code-123';

  const created = await api().post('/api/families').send({ name: familyName, adminCode });
  expect(created.status).toBe(201);

  const login = await api().post('/api/auth/admin/login').send({
    familyName,
    familyCode: created.body.family.familyCode,
    adminCode,
  });
  expect(login.status).toBe(200);

  return {
    id: created.body.family.id,
    name: familyName,
    familyCode: created.body.family.familyCode,
    adminCode,
    adminToken: login.body.token,
  };
}

export async function createChild(
  family: TestFamily,
  name: string,
  gender: 'boy' | 'girl' = 'boy',
): Promise<TestChild> {
  const res = await api().post('/api/children').set(bearer(family.adminToken)).send({ name, gender });
  expect(res.status).toBe(201);
  return { id: res.body.child.id, name, code: res.body.childCode };
}

export function childLoginRequest(family: TestFamily, child: TestChild, overrides: Record<string, string> = {}) {
  return api()
    .post('/api/auth/child/login')
    .send({
      familyName: family.name,
      familyCode: family.familyCode,
      childName: child.name,
      childCode: child.code,
      ...overrides,
    });
}

export async function loginChild(family: TestFamily, child: TestChild): Promise<string> {
  const res = await childLoginRequest(family, child);
  expect(res.status).toBe(200);
  return res.body.token;
}

export async function createItem(
  family: TestFamily,
  childId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; [key: string]: unknown }> {
  const res = await api()
    .post('/api/clothing')
    .set(bearer(family.adminToken))
    .send({ childId, name: 'חולצה', category: 'shirt', season: 'all_season', ...overrides });
  expect(res.status).toBe(201);
  return res.body.item;
}

export async function addToSelection(childToken: string, clothingItemId: string) {
  return api().post('/api/current-selection/items').set(bearer(childToken)).send({ clothingItemId });
}
