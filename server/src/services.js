import fs from 'node:fs';
import path from 'node:path';
import { db, tx, UPLOAD_DIR } from './db.js';
import { HttpError } from './errors.js';
import { computeSplits } from './splits.js';
import { simplifyDebts, netPairs } from './simplify.js';

export const CATEGORY_KEYS = [
  'food', 'travel', 'stay', 'groceries', 'rent', 'utilities', 'shopping', 'fun', 'other',
];

// Dark enough for white initials to stay readable (WCAG AA).
const AVATAR_COLORS = [
  '#0f766e', '#b45309', '#4f46e5', '#be185d', '#0e7490',
  '#c2410c', '#7c3aed', '#b91c1c', '#047857', '#4d7c0f',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const one = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const plain = (row) => ({ ...row });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const formatINR = (paise) =>
  '₹' +
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);

/* ------------------------------------------------------------------ users */

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  color: u.color,
  upiId: u.upi_id ?? null,
});

export const getUserById = (id) => one('SELECT * FROM users WHERE id = ?', id);
export const getUserByEmail = (email) =>
  one('SELECT * FROM users WHERE email = ?', String(email).trim().toLowerCase());

export function createUser({ name, email, passwordHash, upiId = null }) {
  const { n } = one('SELECT COUNT(*) AS n FROM users');
  const color = AVATAR_COLORS[n % AVATAR_COLORS.length];
  const result = run(
    'INSERT INTO users (name, email, password_hash, color, upi_id) VALUES (?, ?, ?, ?, ?)',
    name, email.toLowerCase(), passwordHash, color, upiId,
  );
  return getUserById(Number(result.lastInsertRowid));
}

export function updateUser(id, { name, upiId }) {
  const current = getUserById(id);
  run(
    'UPDATE users SET name = ?, upi_id = ? WHERE id = ?',
    name ?? current.name,
    upiId === undefined ? current.upi_id : upiId,
    id,
  );
  return getUserById(id);
}

/* ----------------------------------------------------------------- groups */

export const isMember = (groupId, userId) =>
  Number.isInteger(groupId) &&
  Number.isInteger(userId) &&
  !!one('SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ?', groupId, userId);

export function assertMember(groupId, userId) {
  if (!isMember(groupId, userId)) throw new HttpError(404, 'Group not found');
}

export function createGroup(userId, { name, emoji = '💸', memberEmails = [] }) {
  return tx(() => {
    const result = run(
      'INSERT INTO expense_groups (name, emoji, created_by) VALUES (?, ?, ?)',
      name, emoji, userId,
    );
    const id = Number(result.lastInsertRowid);
    const insert = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)');
    insert.run(id, userId);

    const added = [];
    const notFound = [];
    for (const email of memberEmails) {
      const user = getUserByEmail(email);
      if (!user) notFound.push(String(email).trim());
      else if (user.id !== userId && !added.includes(user.id)) {
        insert.run(id, user.id);
        added.push(user.id);
      }
    }
    return { id, added, notFound };
  });
}

export function addMember(groupId, email) {
  const user = getUserByEmail(email);
  if (!user) throw new HttpError(404, `No SplitMate account found for ${String(email).trim()}`);
  if (isMember(groupId, user.id)) throw new HttpError(409, `${user.name} is already in this group`);
  run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', groupId, user.id);
  return user;
}

const membersOf = (groupId) =>
  all(
    `SELECT u.* FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ? ORDER BY m.joined_at, u.id`,
    groupId,
  ).map(publicUser);

/* --------------------------------------------------------------- balances */

/**
 * Net balance per member of a group, in paise.
 *   + they are owed money      - they owe money
 * net = (what they paid) - (their share of every expense)
 *       + (payments they made) - (payments they received)
 */
export function groupBalances(groupId) {
  const net = {};
  for (const m of all('SELECT user_id FROM group_members WHERE group_id = ?', groupId)) {
    net[m.user_id] = 0;
  }
  const add = (id, value) => { net[id] = (net[id] || 0) + value; };

  for (const r of all(
    'SELECT paid_by AS id, SUM(amount) AS v FROM expenses WHERE group_id = ? GROUP BY paid_by',
    groupId,
  )) add(r.id, r.v);

  for (const r of all(
    `SELECT s.user_id AS id, SUM(s.amount) AS v
     FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
     WHERE e.group_id = ? GROUP BY s.user_id`,
    groupId,
  )) add(r.id, -r.v);

  for (const r of all(
    `SELECT from_user, to_user, SUM(amount) AS v FROM settlements
     WHERE group_id = ? GROUP BY from_user, to_user`,
    groupId,
  )) {
    add(r.from_user, r.v);
    add(r.to_user, -r.v);
  }
  return net;
}

/** Pairwise debts without simplification, for the before/after comparison. */
export function groupRawTransfers(groupId) {
  const debts = all(
    `SELECT s.user_id AS debtor, e.paid_by AS creditor, s.amount AS amount
     FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
     WHERE e.group_id = ? AND s.user_id != e.paid_by`,
    groupId,
  ).map((r) => ({ from: r.debtor, to: r.creditor, amount: r.amount }));

  for (const r of all('SELECT from_user, to_user, amount FROM settlements WHERE group_id = ?', groupId)) {
    debts.push({ from: r.from_user, to: r.to_user, amount: -r.amount });
  }
  return netPairs(debts);
}

/* --------------------------------------------------------------- expenses */

export function addExpense(groupId, actorId, input) {
  const description = String(input.description ?? '').trim();
  if (!description) throw new HttpError(400, 'Give the expense a description');
  if (description.length > 80) throw new HttpError(400, 'Description is too long (max 80 characters)');

  const amount = input.amount;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'Enter an amount greater than zero');
  }
  if (amount > 1e10) throw new HttpError(400, 'That amount is too large');

  const category = CATEGORY_KEYS.includes(input.category) ? input.category : 'other';
  const date = input.date || todayISO();
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, 'Enter a valid date');
  }

  if (!isMember(groupId, input.paidBy)) throw new HttpError(400, 'The payer must be a group member');
  const participants = Array.isArray(input.participants) ? input.participants : [];
  for (const p of participants) {
    if (!isMember(groupId, p.userId)) {
      throw new HttpError(400, 'Everyone in the split must be a group member');
    }
  }
  const splitType = input.splitType || 'equal';
  const splits = computeSplits({ amount, splitType, participants });

  return tx(() => {
    const result = run(
      `INSERT INTO expenses
         (group_id, paid_by, created_by, description, amount, category, split_type, receipt_url, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      groupId, input.paidBy, actorId, description, amount, category, splitType,
      input.receiptUrl ?? null, date,
    );
    const id = Number(result.lastInsertRowid);
    const insert = db.prepare('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)');
    for (const s of splits) insert.run(id, s.userId, s.amount);
    return id;
  });
}

export function deleteExpense(expenseId, actorId) {
  const e = one('SELECT * FROM expenses WHERE id = ?', expenseId);
  if (!e || !isMember(e.group_id, actorId)) throw new HttpError(404, 'Expense not found');
  if (e.created_by !== actorId && e.paid_by !== actorId) {
    throw new HttpError(403, 'Only the person who added or paid for this expense can delete it');
  }
  run('DELETE FROM expenses WHERE id = ?', expenseId); // splits are removed by ON DELETE CASCADE
  if (e.receipt_url) {
    fs.rm(path.join(UPLOAD_DIR, path.basename(e.receipt_url)), { force: true }, () => {});
  }
  return { groupId: e.group_id, description: e.description, amount: e.amount };
}

/* ------------------------------------------------------------ settlements */

export function addSettlement({ groupId, actorId, fromUser, toUser, amount }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount greater than zero');
  if (amount > 1e10) throw new HttpError(400, 'That amount is too large');
  if (fromUser === toUser) throw new HttpError(400, 'Pick someone other than yourself');
  if (actorId !== fromUser && actorId !== toUser) {
    throw new HttpError(403, 'You can only record payments you are part of');
  }
  if (!isMember(groupId, fromUser) || !isMember(groupId, toUser)) {
    throw new HttpError(400, 'Both people must be in this group');
  }
  const result = run(
    'INSERT INTO settlements (group_id, from_user, to_user, amount) VALUES (?, ?, ?, ?)',
    groupId, fromUser, toUser, amount,
  );
  return Number(result.lastInsertRowid);
}

/* ----------------------------------------------------------- read models */

export function getGroupDetail(groupId) {
  const group = one(
    'SELECT id, name, emoji, created_by AS createdBy, created_at AS createdAt FROM expense_groups WHERE id = ?',
    groupId,
  );
  if (!group) throw new HttpError(404, 'Group not found');

  const splitsByExpense = new Map();
  for (const s of all(
    `SELECT s.expense_id, s.user_id, s.amount
     FROM expense_splits s JOIN expenses e ON e.id = s.expense_id WHERE e.group_id = ?`,
    groupId,
  )) {
    if (!splitsByExpense.has(s.expense_id)) splitsByExpense.set(s.expense_id, []);
    splitsByExpense.get(s.expense_id).push({ userId: s.user_id, amount: s.amount });
  }

  const expenses = all('SELECT * FROM expenses WHERE group_id = ? ORDER BY date DESC, id DESC', groupId).map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    paidBy: e.paid_by,
    createdBy: e.created_by,
    splitType: e.split_type,
    receiptUrl: e.receipt_url,
    date: e.date,
    createdAt: e.created_at,
    splits: splitsByExpense.get(e.id) || [],
  }));

  const settlements = all(
    `SELECT id, from_user AS fromUser, to_user AS toUser, amount, created_at AS createdAt
     FROM settlements WHERE group_id = ? ORDER BY id DESC`,
    groupId,
  ).map(plain);

  const balances = groupBalances(groupId);
  const byCategory = all(
    'SELECT category, SUM(amount) AS amount FROM expenses WHERE group_id = ? GROUP BY category ORDER BY amount DESC',
    groupId,
  ).map(plain);

  return {
    group: plain(group),
    members: membersOf(groupId),
    expenses,
    settlements,
    balances,
    transfers: simplifyDebts(balances),
    rawTransfers: groupRawTransfers(groupId),
    stats: { total: byCategory.reduce((sum, r) => sum + r.amount, 0), byCategory },
  };
}

function lastMonths(count) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

export function getDashboard(userId) {
  const groups = all(
    `SELECT g.id, g.name, g.emoji FROM expense_groups g
     JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.id DESC`,
    userId,
  );

  let youOwe = 0;
  let youAreOwed = 0;
  const peopleNet = new Map(); // other user -> positive means they owe me

  const groupCards = groups.map((g) => {
    const net = groupBalances(g.id);
    const mine = net[userId] || 0;
    if (mine < 0) youOwe += -mine;
    else youAreOwed += mine;

    for (const t of simplifyDebts(net)) {
      if (t.from === userId) peopleNet.set(t.to, (peopleNet.get(t.to) || 0) - t.amount);
      else if (t.to === userId) peopleNet.set(t.from, (peopleNet.get(t.from) || 0) + t.amount);
    }

    const total = one('SELECT COALESCE(SUM(amount), 0) AS t FROM expenses WHERE group_id = ?', g.id).t;
    return { id: g.id, name: g.name, emoji: g.emoji, balance: mine, members: membersOf(g.id), total };
  });

  const people = [...peopleNet]
    .filter(([, amount]) => amount !== 0)
    .map(([id, amount]) => ({ user: publicUser(getUserById(id)), amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  // Spending = the user's own share of each expense (not what they fronted).
  const byCategory = all(
    `SELECT e.category AS category, SUM(s.amount) AS amount
     FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
     WHERE s.user_id = ? GROUP BY e.category ORDER BY amount DESC`,
    userId,
  ).map(plain);

  const months = lastMonths(6);
  const monthTotals = new Map(
    all(
      `SELECT substr(e.date, 1, 7) AS month, SUM(s.amount) AS amount
       FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
       WHERE s.user_id = ? AND substr(e.date, 1, 7) >= ? GROUP BY month`,
      userId, months[0],
    ).map((r) => [r.month, r.amount]),
  );
  const monthly = months.map((month) => ({ month, amount: monthTotals.get(month) || 0 }));

  const recentExpenses = all(
    `SELECT e.id, e.description, e.amount, e.category, e.date,
            e.paid_by AS paidBy, u.name AS paidByName,
            g.id AS groupId, g.name AS groupName, g.emoji AS groupEmoji,
            COALESCE(s.amount, 0) AS myShare
     FROM expenses e
     JOIN expense_groups g ON g.id = e.group_id
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
     JOIN users u ON u.id = e.paid_by
     LEFT JOIN expense_splits s ON s.expense_id = e.id AND s.user_id = ?
     ORDER BY e.date DESC, e.id DESC LIMIT 8`,
    userId, userId,
  ).map((r) => ({ ...r, kind: 'expense' }));

  const recentSettlements = all(
    `SELECT st.id, st.amount, substr(st.created_at, 1, 10) AS date,
            st.from_user AS fromUser, st.to_user AS toUser,
            fu.name AS fromName, tu.name AS toName,
            g.id AS groupId, g.name AS groupName, g.emoji AS groupEmoji
     FROM settlements st
     JOIN expense_groups g ON g.id = st.group_id
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
     JOIN users fu ON fu.id = st.from_user
     JOIN users tu ON tu.id = st.to_user
     ORDER BY st.id DESC LIMIT 8`,
    userId,
  ).map((r) => ({ ...r, kind: 'settlement' }));

  const activity = [...recentExpenses, ...recentSettlements]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 8);

  return {
    totals: { youOwe, youAreOwed, net: youAreOwed - youOwe },
    groups: groupCards,
    people,
    byCategory,
    monthly,
    activity,
  };
}
