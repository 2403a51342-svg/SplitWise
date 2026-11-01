import { HttpError } from './errors.js';

/**
 * Turn "₹X split between these people" into exact per-person amounts in paise.
 * The returned amounts ALWAYS add up to `amount` exactly (no lost paise).
 *
 * splitType:
 *   equal   - participants: [{ userId }]
 *   exact   - participants: [{ userId, value }]  value = paise, must sum to amount
 *   percent - participants: [{ userId, value }]  value = percent, must sum to 100
 */
export function computeSplits({ amount, splitType, participants }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'Enter an amount greater than zero');
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new HttpError(400, 'Pick at least one person to split with');
  }

  const seen = new Set();
  for (const p of participants) {
    if (!Number.isInteger(p.userId) || seen.has(p.userId)) {
      throw new HttpError(400, 'Invalid list of people for this split');
    }
    seen.add(p.userId);
  }

  const people = [...participants].sort((a, b) => a.userId - b.userId);
  let amounts;

  if (splitType === 'equal') {
    // Everyone gets the floor; the leftover paise go one each to the first few people.
    const base = Math.floor(amount / people.length);
    let leftover = amount - base * people.length;
    amounts = people.map(() => base + (leftover-- > 0 ? 1 : 0));
  } else if (splitType === 'exact') {
    amounts = people.map((p) => {
      if (!Number.isInteger(p.value) || p.value < 0) {
        throw new HttpError(400, 'Enter a valid amount for every person');
      }
      return p.value;
    });
    const sum = amounts.reduce((a, b) => a + b, 0);
    if (sum !== amount) {
      throw new HttpError(400, 'The individual amounts must add up to the total');
    }
  } else if (splitType === 'percent') {
    const percents = people.map((p) => Number(p.value));
    if (percents.some((v) => !Number.isFinite(v) || v < 0)) {
      throw new HttpError(400, 'Enter a valid percentage for every person');
    }
    const total = percents.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new HttpError(400, 'Percentages must add up to 100');
    }
    // Largest-remainder method so the rounded shares still add up to `amount`.
    const raw = percents.map((pct) => (amount * pct) / 100);
    amounts = raw.map(Math.floor);
    const leftover = amount - amounts.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ i, fraction: r - Math.floor(r) }))
      .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (let k = 0; k < leftover; k++) amounts[order[k % order.length].i] += 1;
  } else {
    throw new HttpError(400, 'Unknown split type');
  }

  return people.map((p, i) => ({ userId: p.userId, amount: amounts[i] }));
}
