import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

// GET /api/shifts - list shift history
router.get('/', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*,
             json_agg(
               json_build_object(
                 'id', sa.id,
                 'pumpId', sa.pump_id,
                 'dispatcherId', sa.dispatcher_id,
                 'dispatcherName', u.name,
                 'startedAt', sa.started_at,
                 'endedAt', sa.ended_at
               )
             ) FILTER (WHERE sa.id IS NOT NULL) as assignments
      FROM shifts s
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.dispatcher_id = u.id
      GROUP BY s.id
      ORDER BY s.opened_at DESC
      LIMIT 50
    `);
    res.json({ shifts: result.rows });
  } catch (err) {
    console.error('List shifts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shifts/active - get current open shift
router.get('/active', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*,
             json_agg(
               json_build_object(
                 'id', sa.id,
                 'pumpId', sa.pump_id,
                 'dispatcherId', sa.dispatcher_id,
                 'dispatcherName', u.name,
                 'startedAt', sa.started_at,
                 'endedAt', sa.ended_at
               )
             ) FILTER (WHERE sa.id IS NOT NULL) as assignments
      FROM shifts s
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.dispatcher_id = u.id
      WHERE s.status = 'open'
      GROUP BY s.id
      ORDER BY s.opened_at DESC
      LIMIT 1
    `);

    if (result.rowCount === 0) {
      res.json({ shift: null });
      return;
    }

    res.json({ shift: result.rows[0] });
  } catch (err) {
    console.error('Active shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts - open a new shift
const createShiftSchema = z.object({
  assignments: z.array(z.object({
    pumpId: z.string().uuid(),
    dispatcherId: z.string().uuid(),
  })).min(1),
  notes: z.string().optional(),
});

router.post('/', requireAuth, requireRole('Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const parsed = createShiftSchema.parse(req.body);

    await client.query('BEGIN');

    // Check if there's already an open shift
    const openCheck = await client.query(
      "SELECT id FROM shifts WHERE status = 'open' LIMIT 1"
    );
    if (openCheck.rowCount && openCheck.rowCount > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'There is already an open shift' });
      return;
    }

    const shiftResult = await client.query(
      `INSERT INTO shifts (manager_id, notes, status) VALUES ($1, $2, 'open') RETURNING *`,
      [(req as any).user.userId, parsed.notes || null]
    );
    const shift = shiftResult.rows[0];

    for (const assign of parsed.assignments) {
      await client.query(
        `INSERT INTO shift_assignments (shift_id, pump_id, dispatcher_id, started_at) VALUES ($1, $2, $3, NOW())`,
        [shift.id, assign.pumpId, assign.dispatcherId]
      );
    }

    await client.query('COMMIT');

    // Publish realtime event
    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('shift:opened', { shiftId: shift.id });

    res.status(201).json({ shift });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Create shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/shifts/:id/close - close a shift
router.patch('/:id/close', requireAuth, requireRole('Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // End all active assignments
    await client.query(
      `UPDATE shift_assignments SET ended_at = NOW() WHERE shift_id = $1 AND ended_at IS NULL`,
      [id]
    );

    const shiftResult = await client.query(
      `UPDATE shifts SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'open' RETURNING *`,
      [id]
    );

    if (shiftResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Shift not found or already closed' });
      return;
    }

    await client.query('COMMIT');

    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('shift:closed', { shiftId: id });

    res.json({ shift: shiftResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Close shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/shifts/:id/assignments - list all assignments for a shift
router.get('/:id/assignments', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT sa.*, u.name as dispatcher_name, p.number as pump_number, p.name as pump_name
      FROM shift_assignments sa
      JOIN users u ON sa.dispatcher_id = u.id
      JOIN pumps p ON sa.pump_id = p.id
      WHERE sa.shift_id = $1
      ORDER BY sa.started_at DESC
    `, [id]);
    res.json({ assignments: result.rows });
  } catch (err) {
    console.error('List assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/assignments - add/replace an assignment mid-shift
const assignmentSchema = z.object({
  pumpId: z.string().uuid(),
  dispatcherId: z.string().uuid(),
});

router.post('/:id/assignments', requireAuth, requireRole('Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const parsed = assignmentSchema.parse(req.body);

    await client.query('BEGIN');

    // Verify shift is open
    const shiftCheck = await client.query(
      "SELECT id FROM shifts WHERE id = $1 AND status = 'open'",
      [id]
    );
    if (shiftCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Shift is not open' });
      return;
    }

    // End any active assignment for this pump in this shift
    await client.query(
      `UPDATE shift_assignments SET ended_at = NOW() WHERE shift_id = $1 AND pump_id = $2 AND ended_at IS NULL`,
      [id, parsed.pumpId]
    );

    // Insert new assignment
    const result = await client.query(
      `INSERT INTO shift_assignments (shift_id, pump_id, dispatcher_id, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [id, parsed.pumpId, parsed.dispatcherId]
    );

    await client.query('COMMIT');

    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('assignment:changed', { shiftId: id, pumpId: parsed.pumpId });

    res.status(201).json({ assignment: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/shifts/assignments/:assignmentId/end - manually end an assignment
router.patch('/assignments/:assignmentId/end', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const result = await db.query(
      `UPDATE shift_assignments SET ended_at = NOW() WHERE id = $1 AND ended_at IS NULL RETURNING *`,
      [assignmentId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Assignment not found or already ended' });
      return;
    }

    res.json({ assignment: result.rows[0] });
  } catch (err) {
    console.error('End assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shifts/:id/details - full shift report
router.get('/:id/details', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { id } = req.params;

    // Shift metadata
    const shiftResult = await db.query(`
      SELECT s.*, u.name as manager_name
      FROM shifts s
      JOIN users u ON s.manager_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (shiftResult.rowCount === 0) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    const shift = shiftResult.rows[0];

    // All assignments for this shift
    const assignmentsResult = await db.query(`
      SELECT
        sa.*,
        u.name as dispatcher_name,
        p.number as pump_number,
        p.name as pump_name,
        COALESCE(SUM(t.amount), 0) as total_sales,
        COALESCE(SUM(t.liters), 0) as total_liters,
        COUNT(t.id) as transaction_count
      FROM shift_assignments sa
      JOIN users u ON sa.dispatcher_id = u.id
      JOIN pumps p ON sa.pump_id = p.id
      LEFT JOIN transactions t ON t.pump_id = sa.pump_id
        AND t.shift_id = sa.shift_id
        AND t.recorded_at >= sa.started_at
        AND (sa.ended_at IS NULL OR t.recorded_at <= sa.ended_at)
      WHERE sa.shift_id = $1
      GROUP BY sa.id, u.name, p.number, p.name
      ORDER BY sa.started_at DESC
    `, [id]);

    // All transactions for this shift
    const transactionsResult = await db.query(`
      SELECT t.*, u.name as recorded_by_name, p.number as pump_number
      FROM transactions t
      JOIN users u ON t.recorded_by = u.id
      LEFT JOIN pumps p ON t.pump_id = p.id
      WHERE t.shift_id = $1
      ORDER BY t.recorded_at DESC
    `, [id]);

    // All withdrawals for this shift
    const withdrawalsResult = await db.query(`
      SELECT w.*, u.name as recorded_by_name
      FROM withdrawals w
      JOIN users u ON w.recorded_by = u.id
      WHERE w.shift_id = $1
      ORDER BY w.recorded_at DESC
    `, [id]);

    // Meter readings for this shift
    const readingsResult = await db.query(`
      SELECT mr.*, u.name as recorded_by_name, h.pump_id, p.number as pump_number,
             gt.name as gas_type_name, gt.code as gas_type_code, h.gas_type_id
      FROM meter_readings mr
      JOIN users u ON mr.recorded_by = u.id
      JOIN hoses h ON mr.hose_id = h.id
      JOIN pumps p ON h.pump_id = p.id
      JOIN gas_types gt ON h.gas_type_id = gt.id
      WHERE mr.shift_id = $1
      ORDER BY p.number, gt.code, mr.reading_type
    `, [id]);

    // Liters dispensed per gas type from meter readings
    const readingsByHose = await db.query(`
      SELECT
        h.gas_type_id,
        gt.name as gas_type_name,
        gt.code as gas_type_code,
        COALESCE(
          MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) -
          MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END),
          0
        ) as liters_dispensed
      FROM hoses h
      JOIN gas_types gt ON h.gas_type_id = gt.id
      LEFT JOIN meter_readings mr ON mr.hose_id = h.id AND mr.shift_id = $1
      WHERE h.is_active = true
      GROUP BY h.id, h.gas_type_id, gt.name, gt.code
      HAVING MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) IS NOT NULL
         AND MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END) IS NOT NULL
    `, [id]);

    // Gas prices active at shift open time
    const pricesResult = await db.query(`
      SELECT DISTINCT ON (gt.id) gt.id as gas_type_id, gt.name, gt.code, gp.price
      FROM gas_types gt
      LEFT JOIN gas_prices gp ON gp.gas_type_id = gt.id
        AND gp.effective_from <= $1
        AND (gp.effective_until IS NULL OR gp.effective_until > $1)
      ORDER BY gt.id, gp.effective_from DESC
    `, [shift.opened_at]);

    // Build price lookup
    const priceByGasType: Record<string, number> = {};
    for (const p of pricesResult.rows) {
      priceByGasType[p.gas_type_id] = Number(p.price);
    }

    // Calculate total liters and total sales from readings × prices
    let totalLiters = 0;
    let totalSales = 0;
    const salesByGasType: Array<{ gasTypeId: string; gasTypeName: string; gasTypeCode: string; liters: number; pricePerLiter: number; sales: number }> = [];

    // Aggregate liters by gas type
    const litersByGasType: Record<string, { liters: number; name: string; code: string }> = {};
    for (const r of readingsByHose.rows) {
      const liters = Number(r.liters_dispensed);
      if (liters <= 0) continue;
      const gtId = r.gas_type_id;
      if (!litersByGasType[gtId]) {
        litersByGasType[gtId] = { liters: 0, name: r.gas_type_name, code: r.gas_type_code };
      }
      litersByGasType[gtId].liters += liters;
    }

    for (const [gasTypeId, data] of Object.entries(litersByGasType)) {
      const price = priceByGasType[gasTypeId] || 0;
      const sales = data.liters * price;
      totalLiters += data.liters;
      totalSales += sales;
      salesByGasType.push({
        gasTypeId,
        gasTypeName: data.name,
        gasTypeCode: data.code,
        liters: data.liters,
        pricePerLiter: price,
        sales,
      });
    }

    // Card and credit totals from transactions (cash is NOT recorded)
    const txTotalsResult = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'Card' THEN amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN type = 'Credit' THEN amount ELSE 0 END), 0) as credit_sales,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE shift_id = $1
    `, [id]);

    const txTotals = txTotalsResult.rows[0];
    const cardSales = Number(txTotals.card_sales);
    const creditSales = Number(txTotals.credit_sales);
    const cashSales = totalSales - cardSales - creditSales;

    const [totalWithdrawals, nonCashInWithdrawalsResult] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE shift_id = $1`, [id]),
      db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE shift_id = $1 AND type != 'Cash' AND withdrawal_id IS NOT NULL`, [id]),
    ]);
    const withdrawalTotal = Number(totalWithdrawals.rows[0].total);
    const nonCashInWithdrawals = Number(nonCashInWithdrawalsResult.rows[0].total);
    const cashOnlyWithdrawals = withdrawalTotal - nonCashInWithdrawals;

    res.json({
      shift,
      assignments: assignmentsResult.rows,
      transactions: transactionsResult.rows,
      withdrawals: withdrawalsResult.rows,
      readings: readingsResult.rows,
      prices: pricesResult.rows,
      salesByGasType,
      summary: {
        totalSales,
        totalLiters,
        cardSales,
        creditSales,
        cashSales,
        totalWithdrawals: withdrawalTotal,
        nonCashInWithdrawals,
        cashOnlyWithdrawals,
        transactionCount: Number(txTotals.transaction_count),
        cashInHand: cashSales - cashOnlyWithdrawals,
      },
    });
  } catch (err) {
    console.error('Shift details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
