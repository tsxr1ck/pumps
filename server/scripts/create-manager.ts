import bcryptjs from "bcryptjs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createManager() {
  const numericId = process.argv[2] ? parseInt(process.argv[2]) : 1000;
  const name = process.argv[3] || "Manager";
  const pin = process.argv[4] || "123456";

  const pinHash = await bcryptjs.hash(pin, 12);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (numeric_id, name, pin_hash, role) VALUES ($1, $2, $3, 'Manager')
       ON CONFLICT (numeric_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, role = 'Manager', is_active = true, updated_at = NOW()
       RETURNING id, numeric_id, name, role`,
      [numericId, name, pinHash],
    );
    console.log("Manager user created/updated:");
    console.log(result.rows[0]);
  } catch (err) {
    console.error("Failed to create manager:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createManager();
