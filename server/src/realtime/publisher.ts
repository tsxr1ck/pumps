import redis from '../lib/redis.js';

const CHANNEL_PREFIX = 'pumps:';

export async function publishEvent(event: string, payload: unknown): Promise<void> {
  try {
    await redis.publish(`${CHANNEL_PREFIX}${event}`, JSON.stringify(payload));
  } catch (err: any) {
    console.error(`Failed to publish ${event}:`, err.message);
  }
}
