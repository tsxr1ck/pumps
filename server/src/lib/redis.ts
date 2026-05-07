import { Redis } from "ioredis";
import { env } from "./env.js";

const redisUrl = env.REDIS_URL;

// Parse URL to extract auth explicitly (ioredis can drop password when options object is also passed)
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379, password: undefined };
  }
}

const { host, port, password } = parseRedisUrl(redisUrl);
console.log(
  `Redis config: host=${host}, port=${port}, auth=${password ? "yes" : "no"}`,
);

export const redis = new Redis({
  host,
  port,
  password,
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.error("Redis: max retries reached, giving up");
      return null;
    }
    return Math.min(times * 200, 3000);
  },
  maxRetriesPerRequest: 3,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

export default redis;
