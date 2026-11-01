/**
 * Debt simplification.
 *
 * `net` maps userId -> balance in paise:
 *    positive  = the group owes this person money (a creditor)
 *    negative  = this person owes the group money (a debtor)
 * The balances always sum to zero.
 *
 * Greedy algorithm: repeatedly match the biggest debtor with the biggest
 * creditor and settle as much as possible between them. Each step fully
 * clears at least one person, so for n people with non-zero balances it
 * produces at most n - 1 payments instead of one payment per original debt.
 */
export function simplifyDebts(net) {
  const debtors = [];
  const creditors = [];
  for (const [key, value] of Object.entries(net)) {
    const id = Number(key);
    if (value < 0) debtors.push({ id, amount: -value });
    else if (value > 0) creditors.push({ id, amount: value });
  }

  // Largest first; ties broken by id so the output is deterministic.
  const byAmount = (a, b) => b.amount - a.amount || a.id - b.id;
  const payments = [];

  while (debtors.length && creditors.length) {
    debtors.sort(byAmount);
    creditors.sort(byAmount);
    const debtor = debtors[0];
    const creditor = creditors[0];
    const pay = Math.min(debtor.amount, creditor.amount);

    payments.push({ from: debtor.id, to: creditor.id, amount: pay });

    debtor.amount -= pay;
    creditor.amount -= pay;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  return payments;
}

/**
 * The "before" picture: net every pair of people against each other, but do
 * NOT route money through third parties. Input is a list of raw debts
 * { from, to, amount } where a negative amount means a payment already made.
 */
export function netPairs(debts) {
  const pairs = new Map();
  for (const { from, to, amount } of debts) {
    if (from === to || amount === 0) continue;
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}:${b}`;
    // Positive total = a owes b; negative = b owes a.
    pairs.set(key, (pairs.get(key) || 0) + (from === a ? amount : -amount));
  }

  const out = [];
  for (const [key, total] of pairs) {
    if (total === 0) continue;
    const [a, b] = key.split(':').map(Number);
    out.push(total > 0 ? { from: a, to: b, amount: total } : { from: b, to: a, amount: -total });
  }
  return out.sort((x, y) => y.amount - x.amount || x.from - y.from || x.to - y.to);
}
