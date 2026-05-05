import redis from '../lib/redis.js';
import type { Server as SocketIOServer } from 'socket.io';

const CHANNEL_PREFIX = 'pumps:';

export function startSubscriber(io: SocketIOServer): void {
  try {
    const subscriber = redis.duplicate();

    subscriber.on('error', (err: Error) => {
      console.error('Redis subscriber error:', err.message);
    });

    subscriber.on('message', (channel: string, message: string) => {
      const event = channel.replace(CHANNEL_PREFIX, '');
      try {
        const payload = JSON.parse(message);
        io.emit(event, payload);
      } catch {
        console.error('Failed to parse Redis message:', message);
      }
    });

    subscriber.subscribe(
      `${CHANNEL_PREFIX}withdrawal:created`,
      `${CHANNEL_PREFIX}shift:opened`,
      `${CHANNEL_PREFIX}shift:closed`,
      `${CHANNEL_PREFIX}reading:updated`,
      `${CHANNEL_PREFIX}assignment:changed`,
      `${CHANNEL_PREFIX}withdrawal:updated`,
      (err: Error | null | undefined) => {
        if (err) {
          console.error('Redis subscription error:', err.message);
        } else {
          console.log('Subscribed to Redis channels');
        }
      }
    );
  } catch (err: any) {
    console.error('Failed to start Redis subscriber:', err.message);
  }
}
