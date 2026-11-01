import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated, throw-away database for this test file.
process.env.DB_FILE = ':memory:';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'splitmate-test-'));

const svc = await import('../src/services.js');
const { seedDemo, DEMO_EMAIL } = await import('../src/seed-data.js');

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const user = (name) =>
  svc.createUser({ name, email: `${name.toLowerCase()}@test.dev`, passwordHash: 'x' });

test('equal split: balances and simplified transfers', () => {
  const [a, b, c] = ['Asha', 'Bala', 'Chitra'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Trip', memberEmails: [b.email, c.email] });

  svc.addExpense(g, a.id, {
    description: 'Dinner', amount: 300000, category: 'food', paidBy: a.id, splitType: 'equal',
    participants: [a, b, c].map((u) => ({ userId: u.id })),
  });

  const net = svc.groupBalances(g);
  assert.equal(net[a.id], 200000);
  assert.equal(net[b.id], -100000);
  assert.equal(net[c.id], -100000);
  assert.equal(sum(Object.values(net)), 0);

  const { transfers } = svc.getGroupDetail(g);
  assert.equal(transfers.length, 2);
  assert.ok(transfers.every((t) => t.to === a.id && t.amount === 100000));
});

test('chain of debts: A owes B and B owes C becomes one payment A -> C', () => {
  const [a, b, c] = ['Dev', 'Esha', 'Farid'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Chain', memberEmails: [b.email, c.email] });

  // B pays 1000, split exactly 500/500 with A  -> A owes B 500
  svc.addExpense(g, b.id, {
    description: 'Cab', amount: 100000, paidBy: b.id, splitType: 'exact',
    participants: [{ userId: a.id, value: 50000 }, { userId: b.id, value: 50000 }],
  });
  // C pays 1000, split exactly 500/500 with B  -> B owes C 500
  svc.addExpense(g, c.id, {
    description: 'Lunch', amount: 100000, paidBy: c.id, splitType: 'exact',
    participants: [{ userId: b.id, value: 50000 }, { userId: c.id, value: 50000 }],
  });

  const detail = svc.getGroupDetail(g);
  assert.equal(detail.rawTransfers.length, 2, 'two original debts');
  assert.deepEqual(detail.transfers, [{ from: a.id, to: c.id, amount: 50000 }]);
});

test('settlement brings balances back to zero', () => {
  const [a, b] = ['Gita', 'Hari'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Flat', memberEmails: [b.email] });
  svc.addExpense(g, a.id, {
    description: 'Rent', amount: 100000, paidBy: a.id, splitType: 'equal',
    participants: [a, b].map((u) => ({ userId: u.id })),
  });
  assert.equal(svc.groupBalances(g)[b.id], -50000);

  svc.addSettlement({ groupId: g, actorId: b.id, fromUser: b.id, toUser: a.id, amount: 50000 });
  const net = svc.groupBalances(g);
  assert.equal(net[a.id], 0);
  assert.equal(net[b.id], 0);

  const detail = svc.getGroupDetail(g);
  assert.deepEqual(detail.transfers, []);
  assert.deepEqual(detail.rawTransfers, []);
});

test('settlement permissions and validation', () => {
  const [a, b, c] = ['Indu', 'Jai', 'Kiran'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Perm', memberEmails: [b.email, c.email] });
  assert.throws(
    () => svc.addSettlement({ groupId: g, actorId: c.id, fromUser: a.id, toUser: b.id, amount: 100 }),
    /part of/,
  );
  assert.throws(
    () => svc.addSettlement({ groupId: g, actorId: a.id, fromUser: a.id, toUser: a.id, amount: 100 }),
    /other than yourself/,
  );
  assert.throws(
    () => svc.addSettlement({ groupId: g, actorId: a.id, fromUser: a.id, toUser: b.id, amount: 0 }),
    /greater than zero/,
  );
});

test('only members can access a group; only payer/creator can delete', () => {
  const [a, b, outsider] = ['Lata', 'Mohan', 'Nikhil'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Private', memberEmails: [b.email] });

  assert.throws(() => svc.assertMember(g, outsider.id), /not found/i);

  const id = svc.addExpense(g, a.id, {
    description: 'Snacks', amount: 20000, paidBy: a.id, splitType: 'equal',
    participants: [a, b].map((u) => ({ userId: u.id })),
  });
  assert.throws(() => svc.deleteExpense(id, b.id), /Only the person/);
  assert.throws(() => svc.deleteExpense(id, outsider.id), /not found/i);
  svc.deleteExpense(id, a.id);
  assert.equal(svc.getGroupDetail(g).expenses.length, 0);
  // splits cascade-deleted too
  assert.equal(sum(Object.values(svc.groupBalances(g))), 0);
});

test('addExpense validates its input', () => {
  const [a, b] = ['Om', 'Pia'].map(user);
  const outsider = user('Quin');
  const { id: g } = svc.createGroup(a.id, { name: 'Valid', memberEmails: [b.email] });
  const base = {
    description: 'X', amount: 1000, paidBy: a.id, splitType: 'equal',
    participants: [{ userId: a.id }, { userId: b.id }],
  };
  assert.throws(() => svc.addExpense(g, a.id, { ...base, description: '  ' }), /description/);
  assert.throws(() => svc.addExpense(g, a.id, { ...base, amount: -5 }), /greater than zero/);
  assert.throws(() => svc.addExpense(g, a.id, { ...base, amount: NaN }), /greater than zero/);
  assert.throws(() => svc.addExpense(g, a.id, { ...base, paidBy: outsider.id }), /payer/);
  assert.throws(
    () => svc.addExpense(g, a.id, { ...base, participants: [{ userId: outsider.id }] }),
    /group member/,
  );
  assert.throws(() => svc.addExpense(g, a.id, { ...base, date: '12/10/2026' }), /valid date/);
  assert.throws(() => svc.addExpense(g, a.id, { ...base, splitType: 'weird' }), /Unknown split/);
});

test('addMember: unknown email, duplicates, success', () => {
  const [a, b] = ['Ravi', 'Sana'].map(user);
  const { id: g } = svc.createGroup(a.id, { name: 'Members' });
  assert.throws(() => svc.addMember(g, 'nobody@nowhere.dev'), /No SplitMate account/);
  svc.addMember(g, b.email);
  assert.throws(() => svc.addMember(g, b.email), /already in this group/);
  assert.equal(svc.getGroupDetail(g).members.length, 2);
});

test('createGroup reports unknown emails instead of failing', () => {
  const a = user('Tara');
  const res = svc.createGroup(a.id, { name: 'Ghosts', memberEmails: ['ghost@x.dev'] });
  assert.deepEqual(res.notFound, ['ghost@x.dev']);
});

test('demo seed: realistic data, every group balances to zero, dashboard is populated', () => {
  assert.equal(seedDemo({ hash: 'x' }), true);
  assert.equal(seedDemo({ hash: 'x' }), false, 'seeding twice is a no-op');

  const demo = svc.getUserByEmail(DEMO_EMAIL);
  const dash = svc.getDashboard(demo.id);

  assert.equal(dash.groups.length, 3);
  for (const g of dash.groups) {
    const net = svc.groupBalances(g.id);
    assert.equal(sum(Object.values(net)), 0, `group "${g.name}" must net to zero`);
  }

  // The demo user both owes and is owed, so both dashboard cards have something to show.
  assert.ok(dash.totals.youOwe > 0, 'demo user owes something');
  assert.ok(dash.totals.youAreOwed > 0, 'demo user is owed something');
  assert.equal(dash.totals.net, dash.totals.youAreOwed - dash.totals.youOwe);

  assert.equal(dash.monthly.length, 6);
  assert.ok(dash.monthly.filter((m) => m.amount > 0).length >= 4, 'spending spans several months');
  assert.ok(dash.byCategory.length >= 5);
  // All seeded expenses fall inside the 6-month window, so both views must agree.
  assert.equal(
    sum(dash.byCategory.map((c) => c.amount)),
    sum(dash.monthly.map((m) => m.amount)),
  );
  assert.ok(dash.people.length >= 2);
  assert.ok(dash.activity.length > 0 && dash.activity.length <= 8);

  // Group view: simplification really does reduce the number of payments in Goa.
  const goa = dash.groups.find((g) => g.name === 'Goa Trip');
  const detail = svc.getGroupDetail(goa.id);
  assert.equal(detail.members.length, 5);
  assert.ok(detail.transfers.length <= 4);
  assert.ok(detail.transfers.length <= detail.rawTransfers.length);
  // every expense's splits add up exactly to its amount
  for (const e of detail.expenses) {
    assert.equal(sum(e.splits.map((s) => s.amount)), e.amount, `splits of "${e.description}"`);
  }
});

test('formatINR uses Indian digit grouping', () => {
  assert.equal(svc.formatINR(0), '₹0');
  assert.equal(svc.formatINR(123456700), '₹12,34,567');
  assert.equal(svc.formatINR(150), '₹1.50');
});
