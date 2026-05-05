import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface UserSeed {
  numericId: number;
  name: string;
  pin: string;
  role: 'Manager' | 'Dispatcher' | 'Cashier';
}

async function seedUsers() {
  const users: UserSeed[] = [
    { numericId: 1994, name: 'Manager', pin: '310724', role: 'Manager' },
    { numericId: 897, name: 'Dispatcher', pin: '40600', role: 'Dispatcher' },
  ];

  const client = await pool.connect();
  try {
    for (const user of users) {
      const pinHash = await bcrypt.hash(user.pin, 12);
      const result = await client.query(
        `INSERT INTO users (numeric_id, name, pin_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (numeric_id) DO UPDATE
         SET pin_hash = EXCLUDED.pin_hash,
             role = EXCLUDED.role,
             name = EXCLUDED.name,
             is_active = true,
             updated_at = NOW()
         RETURNING id, numeric_id, name, role, is_active`,
        [user.numericId, user.name, pinHash, user.role]
      );
      console.log(`User ${user.role} created/updated:`, result.rows[0]);
    }
    console.log('All users seeded successfully');
  } catch (err) {
    console.error('Failed to seed users:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers();
