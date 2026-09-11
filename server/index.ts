import { createApp } from './app';

const app = createApp({ database: process.env.DB_PATH, origin: process.env.APP_ORIGIN, maxRooms: Number(process.env.MAX_ROOMS || 100), maxSpectators: Number(process.env.MAX_SPECTATORS || 12) });
const port = await app.listen(Number(process.env.PORT || 3000));
console.log(`The Minds is listening on http://localhost:${port}`);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
  if (closing) return; closing = true;
  await app.close(); process.exit(0);
});
