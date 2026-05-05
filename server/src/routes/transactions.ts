import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

const transactionSchema = z.object({
  shiftId: z.string().uuid(),
  pumpId: z.string().uuid().optional(),
  type: z.enum(['Cash', 'Card', 'Credit']),
  amount: z.number().positive(),
  liters: z.number().positive().optional(),
  cardLast4: z.string().length(4).optional(),
  creditCategoryId: z.string().uuid().optional(),
  note: z.string().optional(),
});

// POST /api/transactions - log a transaction
router.post('/', requireAuth, requireRole('Dispatcher', 'Manager', 'Cashier'), async (req, res) => {
  try {
    const parsed = transactionSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO transactions (shift_id, pump_id, type, amount, liters, card_last4, credit_category_id, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        parsed.shiftId,
        parsed.pumpId || null,
        parsed.type,
        parsed.amount,
        parsed.liters || null,
        parsed.cardLast4 || null,
        parsed.creditCategoryId || null,
        parsed.note || null,
        (req as any).user.userId,
      ]
    );

    res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions?shift_id=...
router.get('/', requireAuth, async (req, res) => {
  try {
    const { shift_id } = req.query;
    if (!shift_id || typeof shift_id !== 'string') {
      res.status(400).json({ error: 'shift_id query param required' });
      return;
    }

    const result = await db.query(
      `SELECT t.*, u.name as recorded_by_name, p.number as pump_number,
              cc.name as credit_category_name
       FROM transactions t
       JOIN users u ON t.recorded_by = u.id
       LEFT JOIN pumps p ON t.pump_id = p.id
       LEFT JOIN credit_categories cc ON t.credit_category_id = cc.id
       WHERE t.shift_id = $1
       ORDER BY t.recorded_at DESC`,
      [shift_id]
    );

    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
