import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runSeed() {
  const seedFile = path.join(process.cwd(), 'migrations', '002_seed_data.sql');
  const sql = fs.readFileSync(seedFile, 'utf-8');

  const client = await pool.connect();
  try {
    console.log('Running seed data...');
    await client.query(sql);
    console.log('Seed data completed successfully');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
