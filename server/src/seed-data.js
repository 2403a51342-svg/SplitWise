import * as svc from './services.js';

export const DEMO_EMAIL = 'demo@splitmate.app';
export const DEMO_PASSWORD = 'demo1234';

const rupees = (n) => Math.round(n * 100);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Creates a realistic demo workspace (5 people, 3 groups, ~30 expenses spread over
 * 5 months) so the dashboard and charts look alive on the very first run.
 * `hash` is the password hash to store for every demo user.
 */
export function seedDemo({ hash }) {
  if (svc.getUserByEmail(DEMO_EMAIL)) return false;

  const mk = (name, email, upiId) => svc.createUser({ name, email, passwordHash: hash, upiId });
  const aarav = mk('Aarav Sharma', DEMO_EMAIL, 'aarav@okicici');
  const priya = mk('Priya Nair', 'priya@splitmate.app', 'priya@oksbi');
  const rohan = mk('Rohan Mehta', 'rohan@splitmate.app', 'rohan@okhdfcbank');
  const ananya = mk('Ananya Reddy', 'ananya@splitmate.app', 'ananya@ybl');
  const karthik = mk('Karthik Iyer', 'karthik@splitmate.app', 'karthik@paytm');

  const equal = (users) => users.map((u) => ({ userId: u.id }));
  const add = (groupId, by, description, amount, category, ago, users, extra = {}) =>
    svc.addExpense(groupId, by.id, {
      description,
      amount: rupees(amount),
      category,
      paidBy: by.id,
      splitType: 'equal',
      participants: equal(users),
      date: daysAgo(ago),
      ...extra,
    });

  /* ---- Goa Trip: all five friends ---- */
  const everyone = [aarav, priya, rohan, ananya, karthik];
  const goa = svc.createGroup(aarav.id, {
    name: 'Goa Trip',
    emoji: '🏖️',
    memberEmails: everyone.slice(1).map((u) => u.email),
  }).id;

  add(goa, rohan, 'Flights to Goa', 18400, 'travel', 30, everyone);
  add(goa, aarav, 'Beachside villa (3 nights)', 24000, 'stay', 29, everyone);
  add(goa, priya, 'Scooter rentals', 3200, 'travel', 28, [aarav, priya, rohan, ananya]);
  add(goa, ananya, 'Beach shack dinner', 4650, 'food', 27, everyone);
  add(goa, karthik, 'Water sports', 6000, 'fun', 27, everyone);
  add(goa, aarav, 'Sunset cruise', 7500, 'fun', 27, [aarav, priya, ananya], {
    splitType: 'percent',
    participants: [
      { userId: aarav.id, value: 40 },
      { userId: priya.id, value: 30 },
      { userId: ananya.id, value: 30 },
    ],
  });
  add(goa, priya, 'Souvenirs & gifts', 2100, 'shopping', 26, [aarav, priya, rohan, ananya], {
    splitType: 'exact',
    participants: [
      { userId: priya.id, value: rupees(700) },
      { userId: aarav.id, value: rupees(500) },
      { userId: ananya.id, value: rupees(600) },
      { userId: rohan.id, value: rupees(300) },
    ],
  });
  add(goa, aarav, 'Cab to airport', 1250, 'travel', 25, everyone);
  svc.addSettlement({
    groupId: goa, actorId: karthik.id, fromUser: karthik.id, toUser: aarav.id, amount: rupees(2000),
  });

  /* ---- Flat 402: three flatmates, five months of bills ---- */
  const flatmates = [aarav, rohan, karthik];
  const flat = svc.createGroup(aarav.id, {
    name: 'Flat 402',
    emoji: '🏠',
    memberEmails: [rohan.email, karthik.email],
  }).id;

  add(flat, karthik, 'Rent', 36000, 'rent', 152, flatmates);
  add(flat, aarav, 'Rent', 36000, 'rent', 122, flatmates);
  add(flat, rohan, 'Rent', 36000, 'rent', 92, flatmates);
  add(flat, karthik, 'Rent', 36000, 'rent', 62, flatmates);
  add(flat, aarav, 'Rent', 36000, 'rent', 32, flatmates);
  add(flat, rohan, 'Rent', 36000, 'rent', 2, flatmates);
  add(flat, rohan, 'Electricity bill', 2310, 'utilities', 110, flatmates);
  add(flat, rohan, 'Electricity bill', 2680, 'utilities', 80, flatmates);
  add(flat, rohan, 'Electricity bill', 2950, 'utilities', 50, flatmates);
  add(flat, rohan, 'Electricity bill', 3120, 'utilities', 20, flatmates);
  add(flat, karthik, 'Groceries', 1850, 'groceries', 100, flatmates);
  add(flat, karthik, 'Groceries', 2240, 'groceries', 40, flatmates);
  add(flat, aarav, 'Groceries', 1320, 'groceries', 15, flatmates);
  add(flat, rohan, 'Groceries', 980, 'groceries', 6, flatmates);
  add(flat, karthik, 'WiFi (annual share)', 1179, 'utilities', 45, flatmates);

  /* ---- Weekend Trek ---- */
  const trekkers = [aarav, priya, ananya];
  const trek = svc.createGroup(priya.id, {
    name: 'Weekend Trek',
    emoji: '⛰️',
    memberEmails: [aarav.email, ananya.email],
  }).id;

  add(trek, priya, 'Cab to base camp', 2400, 'travel', 14, trekkers);
  add(trek, priya, 'Trek permit & guide', 3600, 'fun', 13, trekkers);
  add(trek, ananya, 'Camp dinner', 1950, 'food', 13, trekkers);
  add(trek, priya, 'Homestay', 9000, 'stay', 13, trekkers);
  add(trek, aarav, 'Snacks & water', 640, 'groceries', 12, trekkers);

  return true;
}
