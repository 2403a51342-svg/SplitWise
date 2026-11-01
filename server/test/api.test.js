// End-to-end HTTP + WebSocket test. It needs the npm dependencies, so it is skipped
// automatically when they are not installed (run `npm install` first, then `npm test`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_FILE = ':memory:';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'splitmate-api-'));
process.env.JWT_SECRET = 'test-secret';

const deps = await Promise.all(
  ['express', 'socket.io', 'socket.io-client', 'jsonwebtoken', 'bcryptjs', 'multer', 'cors'].map((d) =>
    import(d).then(() => true, () => false),
  ),
);
const installed = deps.every(Boolean);
const skip = installed ? false : 'npm dependencies are not installed';

test('API: register, group, expense, real-time event, settle up', { skip }, async (t) => {
  const { createServer } = await import('../src/app.js');
  const { io: connect } = await import('socket.io-client');
  const { server, io } = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  t.after(() => { io.close(); server.close(); });

  const call = async (method, url, { token, body } = {}) => {
    const res = await fetch(base + '/api' + url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };

  const a = await call('POST', '/auth/register', { body: { name: 'Asha Rao', email: 'asha@t.dev', password: 'secret1' } });
  const b = await call('POST', '/auth/register', { body: { name: 'Bala Menon', email: 'bala@t.dev', password: 'secret2' } });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);

  // duplicate email + wrong password + missing token
  assert.equal((await call('POST', '/auth/register', { body: { name: 'X', email: 'asha@t.dev', password: 'secret1' } })).status, 409);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'asha@t.dev', password: 'nope' } })).status, 401);
  assert.equal((await call('GET', '/dashboard')).status, 401);

  const group = await call('POST', '/groups', {
    token: a.data.token,
    body: { name: 'Trip', emoji: '✈️', memberEmails: ['bala@t.dev', 'ghost@t.dev'] },
  });
  assert.equal(group.status, 201);
  assert.deepEqual(group.data.notFound, ['ghost@t.dev']);
  const gid = group.data.id;

  // Bala connects a socket and must hear about Asha's expense instantly.
  const socket = connect(base, { auth: { token: b.data.token }, transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  const heard = new Promise((resolve) => socket.on('group:changed', resolve));

  const form = new FormData();
  form.set('description', 'Dinner');
  form.set('amount', '200000');
  form.set('category', 'food');
  form.set('paidBy', String(a.data.user.id));
  form.set('splitType', 'equal');
  form.set('participants', JSON.stringify([{ userId: a.data.user.id }, { userId: b.data.user.id }]));
  const created = await fetch(`${base}/api/groups/${gid}/expenses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.data.token}` },
    body: form,
  });
  assert.equal(created.status, 201);

  const event = await heard;
  assert.equal(event.kind, 'expense');
  assert.equal(event.groupId, gid);
  assert.match(event.text, /Dinner/);
  socket.close();

  const detail = await call('GET', `/groups/${gid}`, { token: b.data.token });
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.data.transfers, [{ from: b.data.user.id, to: a.data.user.id, amount: 100000 }]);

  // an outsider cannot see the group
  const c = await call('POST', '/auth/register', { body: { name: 'Chitra', email: 'c@t.dev', password: 'secret3' } });
  assert.equal((await call('GET', `/groups/${gid}`, { token: c.data.token })).status, 404);

  // Bala settles up
  const settle = await call('POST', `/groups/${gid}/settlements`, {
    token: b.data.token,
    body: { fromUser: b.data.user.id, toUser: a.data.user.id, amount: 100000 },
  });
  assert.equal(settle.status, 201);
  const after = await call('GET', `/groups/${gid}`, { token: a.data.token });
  assert.deepEqual(after.data.transfers, []);

  // UPI id validation
  assert.equal((await call('PATCH', '/me', { token: a.data.token, body: { upiId: 'not a upi' } })).status, 400);
  const ok = await call('PATCH', '/me', { token: a.data.token, body: { upiId: 'asha@okhdfcbank' } });
  assert.equal(ok.data.user.upiId, 'asha@okhdfcbank');
});
