import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

// GET /api/prices/current - current price per gas type
router.get('/current', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (gt.id)
        gt.id as gas_type_id,
        gt.name,
        gt.code,
        gp.price,
        gp.effective_from,
        u.name as set_by_name
      FROM gas_types gt
      LEFT JOIN gas_prices gp ON gp.gas_type_id = gt.id
        AND gp.effective_from <= NOW()
        AND (gp.effective_until IS NULL OR gp.effective_until > NOW())
      LEFT JOIN users u ON gp.set_by = u.id
      ORDER BY gt.id, gp.effective_from DESC
    `);

    res.json({ prices: result.rows });
  } catch (err) {
    console.error('Current prices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/prices - price history
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT gp.*, gt.name as gas_type_name, gt.code as gas_type_code, u.name as set_by_name
      FROM gas_prices gp
      JOIN gas_types gt ON gp.gas_type_id = gt.id
      JOIN users u ON gp.set_by = u.id
      ORDER BY gp.effective_from DESC
      LIMIT 100
    `);

    res.json({ prices: result.rows });
  } catch (err) {
    console.error('Price history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/prices - set new price (append-only)
const priceSchema = z.object({
  gasTypeId: z.string().uuid(),
  price: z.number().positive(),
  effectiveFrom: z.string().datetime().optional(),
});

router.post('/', requireAuth, requireRole('Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const parsed = priceSchema.parse(req.body);
    const effectiveFrom = parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : new Date();

    await client.query('BEGIN');

    // Close current price for this gas type
    await client.query(
      `UPDATE gas_prices
       SET effective_until = $1
       WHERE gas_type_id = $2 AND effective_until IS NULL AND effective_from < $1`,
      [effectiveFrom, parsed.gasTypeId]
    );

    const result = await client.query(
      `INSERT INTO gas_prices (gas_type_id, price, effective_from, set_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [parsed.gasTypeId, parsed.price, effectiveFrom, (req as any).user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ price: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Set price error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
