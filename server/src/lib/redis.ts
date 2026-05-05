import { Redis } from "ioredis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

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
  `Redis config: host=${host}, port=${port}, password=${password ? "***" + password.slice(-3) : "NONE"}, url=${redisUrl}`,
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
