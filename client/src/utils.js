/** Format integer paise as Indian-grouped rupees: 123456700 -> ₹12,34,567 */
export function inr(paise, { sign = false } = {}) {
  const value = Math.abs(paise);
  const body = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
  const prefix = sign ? (paise > 0 ? '+' : paise < 0 ? '−' : '') : '';
  return `${prefix}₹${body}`;
}

/** "1,250.50" -> 125050 (paise). Returns 0 for anything that is not a positive number. */
export function rupeesToPaise(text) {
  const n = Number(String(text ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** Split `paise` into n shares that add up exactly (the first few shares get an extra paisa). */
export function evenSplit(paise, n) {
  if (n <= 0) return [];
  const base = Math.floor(paise / n);
  let leftover = paise - base * n;
  return Array.from({ length: n }, () => base + (leftover-- > 0 ? 1 : 0));
}

export const CATEGORIES = {
  food: { label: 'Food', emoji: '🍕', color: '#f59e0b' },
  travel: { label: 'Travel', emoji: '✈️', color: '#3b82f6' },
  stay: { label: 'Stay', emoji: '🏨', color: '#8b5cf6' },
  groceries: { label: 'Groceries', emoji: '🛒', color: '#22c55e' },
  rent: { label: 'Rent', emoji: '🏠', color: '#ec4899' },
  utilities: { label: 'Bills', emoji: '💡', color: '#06b6d4' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#f97316' },
  fun: { label: 'Fun', emoji: '🎉', color: '#d946ef' },
  other: { label: 'Other', emoji: '📦', color: '#64748b' },
};
export const categoryOf = (key) => ({ key, ...(CATEGORIES[key] || CATEGORIES.other) });

/** UPI deep link. On a phone it opens the user's UPI app with everything pre-filled. */
export function upiLink({ upiId, name, amountPaise, note }) {
  const enc = encodeURIComponent; // %20 for spaces: some UPI apps mishandle "+"
  // `pa` is kept un-encoded: UPI apps expect the literal name@bank form.
  return `upi://pay?pa=${upiId}&pn=${enc(name)}&am=${(amountPaise / 100).toFixed(2)}&cu=INR&tn=${enc(note)}`;
}

const parseDay = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00`);

export const dayLabel = (iso) =>
  parseDay(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const monthLabel = (iso) =>
  parseDay(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** "2026-05" -> "May" */
export const shortMonth = (yyyymm) =>
  new Date(`${yyyymm}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

export const firstName = (name = '') => name.split(' ')[0];

export const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
