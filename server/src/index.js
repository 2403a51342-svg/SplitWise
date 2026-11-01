import { createServer } from './app.js';
import { seedDemoIfEmpty } from './seed.js';

const PORT = Number(process.env.PORT) || 4000;

// Fresh database -> create demo users/groups so the app looks alive. Disable with SEED_DEMO=false.
if (process.env.SEED_DEMO !== 'false') seedDemoIfEmpty();

const { server } = createServer();
server.listen(PORT, () => {
  console.log(`SplitMate API running on http://localhost:${PORT}`);
});
