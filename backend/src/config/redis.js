import { createClient } from 'redis';

let client;

export async function getRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL belum di-set');
  }

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => {
      console.error('[Redis error]', err.message);
    });
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}
