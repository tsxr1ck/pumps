import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const db = {
  query: pool.query.bind(pool),
  getClient: () => pool.connect(),
};

export default pool;
