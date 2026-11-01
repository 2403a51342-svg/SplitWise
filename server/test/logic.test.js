import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyDebts, netPairs } from '../src/simplify.js';
import { computeSplits } from '../src/splits.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/* ---------------------------------------------------------- simplifyDebts */

test('simplifyDebts: A owes B, B owes C collapses to A pays C', () => {
  // A=-500, B=0, C=+500
  const payments = simplifyDebts({ 1: -500, 2: 0, 3: 500 });
  assert.deepEqual(payments, [{ from: 1, to: 3, amount: 500 }]);
});

test('simplifyDebts: everyone ends up settled and payments are at most n-1', () => {
  const net = { 1: 7000, 2: -2500, 3: -1500, 4: 3000, 5: -6000, 6: 0 };
  const payments = simplifyDebts(net);

  const after = { ...net };
  for (const p of payments) {
    after[p.from] += p.amount;
    after[p.to] -= p.amount;
    assert.ok(p.amount > 0);
  }
  for (const v of Object.values(after)) assert.equal(v, 0);
  assert.ok(payments.length <= 4, `expected <= 4 payments, got ${payments.length}`);
});

test('simplifyDebts: randomised balances always settle exactly', () => {
  for (let round = 0; round < 200; round++) {
    const n = 2 + Math.floor(Math.random() * 8);
    const net = {};
    let total = 0;
    for (let i = 1; i < n; i++) {
      net[i] = Math.floor((Math.random() - 0.5) * 100000);
      total += net[i];
    }
    net[n] = -total; // balances must sum to zero
    const after = { ...net };
    for (const p of simplifyDebts(net)) {
      after[p.from] += p.amount;
      after[p.to] -= p.amount;
    }
    for (const v of Object.values(after)) assert.equal(v, 0);
  }
});

test('simplifyDebts: nothing to do when everyone is settled', () => {
  assert.deepEqual(simplifyDebts({ 1: 0, 2: 0 }), []);
});

/* --------------------------------------------------------------- netPairs */

test('netPairs: opposite debts between two people are netted', () => {
  const out = netPairs([
    { from: 1, to: 2, amount: 800 },
    { from: 2, to: 1, amount: 300 },
  ]);
  assert.deepEqual(out, [{ from: 1, to: 2, amount: 500 }]);
});

test('netPairs: a payment (negative debt) reduces what is owed', () => {
  const out = netPairs([
    { from: 1, to: 2, amount: 1000 },
    { from: 1, to: 2, amount: -1000 },
  ]);
  assert.deepEqual(out, []);
});

test('netPairs: does not route through third parties', () => {
  const out = netPairs([
    { from: 1, to: 2, amount: 500 },
    { from: 2, to: 3, amount: 500 },
  ]);
  assert.equal(out.length, 2);
});

/* ----------------------------------------------------------- computeSplits */

test('computeSplits equal: leftover paise are distributed, total is exact', () => {
  const splits = computeSplits({
    amount: 100,
    splitType: 'equal',
    participants: [{ userId: 3 }, { userId: 1 }, { userId: 2 }],
  });
  assert.deepEqual(splits.map((s) => s.amount), [34, 33, 33]);
  assert.deepEqual(splits.map((s) => s.userId), [1, 2, 3]);
  assert.equal(sum(splits.map((s) => s.amount)), 100);
});

test('computeSplits equal: amounts that divide evenly', () => {
  const splits = computeSplits({
    amount: 200000,
    splitType: 'equal',
    participants: [1, 2, 3, 4].map((userId) => ({ userId })),
  });
  assert.ok(splits.every((s) => s.amount === 50000));
});

test('computeSplits percent: rounding never loses or invents a paisa', () => {
  const splits = computeSplits({
    amount: 10001,
    splitType: 'percent',
    participants: [
      { userId: 1, value: 33.33 },
      { userId: 2, value: 33.33 },
      { userId: 3, value: 33.34 },
    ],
  });
  assert.equal(sum(splits.map((s) => s.amount)), 10001);
});

test('computeSplits percent: 40/30/30 of ₹7,500', () => {
  const splits = computeSplits({
    amount: 750000,
    splitType: 'percent',
    participants: [
      { userId: 1, value: 40 },
      { userId: 2, value: 30 },
      { userId: 3, value: 30 },
    ],
  });
  assert.deepEqual(splits.map((s) => s.amount), [300000, 225000, 225000]);
});

test('computeSplits exact: must add up to the total', () => {
  assert.throws(
    () =>
      computeSplits({
        amount: 1000,
        splitType: 'exact',
        participants: [{ userId: 1, value: 400 }, { userId: 2, value: 500 }],
      }),
    /add up to the total/,
  );
  const ok = computeSplits({
    amount: 1000,
    splitType: 'exact',
    participants: [{ userId: 1, value: 400 }, { userId: 2, value: 600 }],
  });
  assert.deepEqual(ok.map((s) => s.amount), [400, 600]);
});

test('computeSplits percent: must add up to 100', () => {
  assert.throws(
    () =>
      computeSplits({
        amount: 1000,
        splitType: 'percent',
        participants: [{ userId: 1, value: 50 }, { userId: 2, value: 40 }],
      }),
    /add up to 100/,
  );
});

test('computeSplits rejects bad input', () => {
  assert.throws(() => computeSplits({ amount: 0, splitType: 'equal', participants: [{ userId: 1 }] }));
  assert.throws(() => computeSplits({ amount: 1.5, splitType: 'equal', participants: [{ userId: 1 }] }));
  assert.throws(() => computeSplits({ amount: 100, splitType: 'equal', participants: [] }));
  assert.throws(() =>
    computeSplits({ amount: 100, splitType: 'equal', participants: [{ userId: 1 }, { userId: 1 }] }),
  );
  assert.throws(() => computeSplits({ amount: 100, splitType: 'nope', participants: [{ userId: 1 }] }));
});
