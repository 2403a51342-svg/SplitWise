import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { seedDemo, DEMO_EMAIL, DEMO_PASSWORD } from './seed-data.js';
import { db } from './db.js';

export function seedDemoIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;
  const created = seedDemo({ hash: bcrypt.hashSync(DEMO_PASSWORD, 10) });
  if (created) console.log(`Seeded demo data. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  return created;
}

// `npm run seed` -> node src/seed.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const created = seedDemo({ hash: bcrypt.hashSync(DEMO_PASSWORD, 10) });
  console.log(
    created
      ? `Seeded demo data. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`
      : 'Demo data already exists, nothing to do.',
  );
}
