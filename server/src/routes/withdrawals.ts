import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

const createWithdrawalSchema = z.object({
  shiftId: z.string().uuid(),
  amount: z.number().positive(),
  note: z.string().optional(),
});

const approveWithdrawalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionNote: z.string().optional(),
});

// POST /api/withdrawals - log a withdrawal, auto-include unwithdrawn non-cash transactions
router.post('/', requireAuth, requireRole('Dispatcher', 'Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const parsed = createWithdrawalSchema.parse(req.body);
    const cashAmount = parsed.amount;

    await client.query('BEGIN');

    const nonCashResult = await client.query(
      `SELECT id, amount, type, recorded_at
       FROM transactions
       WHERE shift_id = $1 AND type != 'Cash' AND withdrawal_id IS NULL
       ORDER BY recorded_at ASC`,
      [parsed.shiftId]
    );

    const nonCashTotal = nonCashResult.rows.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount), 0
    );

    const totalAmount = cashAmount + nonCashTotal;

    const withdrawalResult = await client.query(
      `INSERT INTO withdrawals (shift_id, amount, note, recorded_by, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [parsed.shiftId, totalAmount, parsed.note || 'Retiro', (req as any).user.userId]
    );
    const withdrawal = withdrawalResult.rows[0];

    const coveredTransactions: any[] = [];
    for (const tx of nonCashResult.rows) {
      await client.query(
        `UPDATE transactions SET withdrawal_id = $1 WHERE id = $2`,
        [withdrawal.id, tx.id]
      );
      coveredTransactions.push(tx);
    }

    const cashResult = await client.query(
      `SELECT id, amount, recorded_at
       FROM transactions
       WHERE shift_id = $1 AND type = 'Cash' AND withdrawal_id IS NULL
       ORDER BY recorded_at ASC`,
      [parsed.shiftId]
    );

    let coveredCashAmount = 0;
    for (const tx of cashResult.rows) {
      if (coveredCashAmount >= cashAmount) break;
      await client.query(
        `UPDATE transactions SET withdrawal_id = $1 WHERE id = $2`,
        [withdrawal.id, tx.id]
      );
      coveredCashAmount += Number(tx.amount);
      coveredTransactions.push(tx);
    }

    await client.query('COMMIT');

    const allCoveredAmount = coveredCashAmount + nonCashTotal;

    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('withdrawal:created', {
      withdrawal: {
        ...withdrawal,
        recordedByName: (req as any).user.name,
        coveredTransactionCount: coveredTransactions.length,
        coveredAmount: allCoveredAmount,
        latestTransactionAt: coveredTransactions.length > 0
          ? coveredTransactions[coveredTransactions.length - 1].recorded_at
          : null,
      },
      coveredTransactions,
    });

    res.status(201).json({
      withdrawal,
      coveredTransactions,
      coveredAmount: allCoveredAmount,
      cashAmount,
      nonCashAmount: nonCashTotal,
      nonCashCount: nonCashResult.rows.length,
      remainingUnwithdrawn: cashResult.rows.length - coveredTransactions.filter(
        (t: any) => t.type === 'Cash' || !t.type
      ).length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/withdrawals?shift_id=...
router.get('/', requireAuth, async (req, res) => {
  try {
    const { shift_id, status } = req.query;
    let query = `
      SELECT w.*, u.name as recorded_by_name,
             au.name as approved_by_name
      FROM withdrawals w
      JOIN users u ON w.recorded_by = u.id
      LEFT JOIN users au ON w.approved_by = au.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (shift_id && typeof shift_id === 'string') {
      params.push(shift_id);
      conditions.push(`w.shift_id = $${params.length}`);
    }

    if (status && typeof status === 'string') {
      params.push(status);
      conditions.push(`w.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY w.recorded_at DESC';

    const result = await db.query(query, params);
    res.json({ withdrawals: result.rows });
  } catch (err) {
    console.error('List withdrawals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/withdrawals/:id/approve - approve or reject a withdrawal
router.patch('/:id/approve', requireAuth, requireRole('Manager', 'Cashier'), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = approveWithdrawalSchema.parse(req.body);
    const userId = (req as any).user.userId;

    const result = await db.query(
      `UPDATE withdrawals
       SET status = $1,
           approved_by = $2,
           approved_at = NOW(),
           rejection_note = $3
       WHERE id = $4
       RETURNING *`,
      [parsed.status, userId, parsed.rejectionNote || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Withdrawal not found' });
      return;
    }

    const updated = result.rows[0];

    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    const approverName = userResult.rows[0]?.name || 'Unknown';

    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('withdrawal:updated', {
      withdrawal: {
        ...updated,
        approvedByName: approverName,
      },
    });

    res.json({ withdrawal: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Approve withdrawal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/withdrawals/pending - get all pending withdrawals for current shift
router.get('/pending', requireAuth, requireRole('Manager', 'Cashier'), async (req, res) => {
  try {
    const { shift_id } = req.query;

    let query = `
      SELECT w.*, u.name as recorded_by_name,
             au.name as approved_by_name
      FROM withdrawals w
      JOIN users u ON w.recorded_by = u.id
      LEFT JOIN users au ON w.approved_by = au.id
      WHERE w.status = 'pending'
    `;
    const params: any[] = [];

    if (shift_id && typeof shift_id === 'string') {
      params.push(shift_id);
      query += ` AND w.shift_id = $${params.length}`;
    }

    query += ' ORDER BY w.recorded_at DESC';

    const result = await db.query(query, params);
    res.json({ withdrawals: result.rows });
  } catch (err) {
    console.error('List pending withdrawals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/withdrawals/:id/transactions
router.get('/:id/transactions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT t.*, p.number as pump_number
       FROM transactions t
       LEFT JOIN pumps p ON t.pump_id = p.id
       WHERE t.withdrawal_id = $1
       ORDER BY t.recorded_at ASC`,
      [id]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('List withdrawal transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
