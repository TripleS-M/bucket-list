process.env.JWT_SECRET = 'x'.repeat(40);
process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let base;
let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
test.after(() => server.close());

// Minimal client with its own cookie jar.
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body && JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.()[0];
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

test('auth, lists, items, and the public feed', async () => {
  const alice = client();
  const bob = client();
  const anon = client();
  const visitor = client();

  assert.equal((await alice('GET', '/api/lists')).status, 401);

  let r = await alice('POST', '/api/auth/signup', { email: 'a@x.com', name: 'Alice', password: 'password123' });
  assert.equal(r.status, 201);
  assert.equal((await alice('POST', '/api/auth/signup', { email: 'A@x.com', name: 'Dup', password: 'password123' })).status, 409);
  assert.equal((await alice('GET', '/api/auth/me')).body.user.email, 'a@x.com');
  await bob('POST', '/api/auth/signup', { email: 'b@x.com', name: 'Bob', password: 'password123' });

  assert.equal((await anon('POST', '/api/auth/login', { email: 'a@x.com', password: 'wrongwrong' })).status, 401);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'a@x.com', password: 'password123' })).status, 200);
  assert.equal((await anon('POST', '/api/auth/google', { credential: 'x' })).status, 503);

  // create + edit
  r = await alice('POST', '/api/lists', { title: 'Before 30', items: ['Skydive', 'See auroras'] });
  assert.equal(r.status, 201);
  const list = r.body.list;
  assert.equal(list.isPublic, false);
  assert.equal(list.items.length, 2);

  r = await alice('PATCH', `/api/lists/${list.id}`, { title: 'Before 31', description: 'big plans' });
  assert.equal(r.body.list.title, 'Before 31');

  r = await alice('POST', `/api/lists/${list.id}/items`, { text: 'Run a marathon' });
  assert.equal(r.status, 201);
  const marathon = r.body.item;

  // check off, uncheck
  r = await alice('PATCH', `/api/lists/${list.id}/items/${list.items[0].id}`, { done: true });
  assert.equal(r.body.item.done, true);
  assert.ok(r.body.item.doneAt);
  r = await alice('PATCH', `/api/lists/${list.id}/items/${list.items[0].id}`, { done: false });
  assert.equal(r.body.item.doneAt, null);
  await alice('PATCH', `/api/lists/${list.id}/items/${list.items[0].id}`, { done: true });

  // reorder: move marathon to the top
  await alice('PATCH', `/api/lists/${list.id}/items/${marathon.id}`, { position: 0 });
  r = await alice('GET', `/api/lists/${list.id}`);
  assert.deepEqual(r.body.list.items.map((i) => i.text), ['Run a marathon', 'Skydive', 'See auroras']);
  assert.equal(r.body.list.doneCount, 1);

  // private until published; other users can't touch it
  assert.equal((await visitor('GET', `/api/public/lists/${list.id}`)).status, 404);
  assert.equal((await bob('GET', `/api/lists/${list.id}`)).status, 404);
  assert.equal((await bob('PATCH', `/api/lists/${list.id}`, { title: 'hax' })).status, 404);
  assert.equal((await bob('DELETE', `/api/lists/${list.id}/items/${marathon.id}`)).status, 404);
  assert.equal((await visitor('GET', '/api/public/lists')).body.total, 0);

  // publish
  r = await alice('PATCH', `/api/lists/${list.id}`, { isPublic: true });
  assert.ok(r.body.list.publishedAt);
  r = await visitor('GET', '/api/public/lists');
  assert.equal(r.body.total, 1);
  assert.equal(r.body.lists[0].author.name, 'Alice');
  assert.equal(r.body.lists[0].author.email, undefined);
  assert.equal((await visitor('GET', '/api/public/lists?q=zzz')).body.total, 0);
  assert.equal((await visitor('GET', '/api/public/lists?q=before')).body.total, 1);
  assert.equal((await visitor('GET', `/api/public/lists/${list.id}`)).body.list.items.length, 3);

  // unpublish, then delete
  await alice('PATCH', `/api/lists/${list.id}`, { isPublic: false });
  assert.equal((await visitor('GET', '/api/public/lists')).body.total, 0);
  assert.equal((await alice('DELETE', `/api/lists/${list.id}`)).status, 204);
  assert.equal((await alice('GET', `/api/lists/${list.id}`)).status, 404);

  // logout
  await alice('POST', '/api/auth/logout');
  assert.equal((await alice('GET', '/api/auth/me')).status, 401);
});
