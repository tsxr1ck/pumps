import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// GET /api/dashboard/summary - aggregated metrics for the open shift
router.get('/summary', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    // Get open shift
    const shiftResult = await db.query(
      `SELECT id, opened_at FROM shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`
    );

    const shift = shiftResult.rows[0];

    if (!shift) {
      res.json({
        shiftId: null,
        totalSales: 0,
        totalLiters: 0,
        totalWithdrawals: 0,
        cashInHand: 0,
        cashSales: 0,
        cardSales: 0,
        creditSales: 0,
        pumpStats: [],
        assignmentStats: [],
        recentWithdrawals: [],
        readingStats: [],
        unwithdrawnCash: 0,
        unwithdrawnTransactionCount: 0,
        unwithdrawnNonCash: 0,
        unwithdrawnNonCashCount: 0,
      });
      return;
    }

    const shiftId = shift.id;

    // All queries in parallel for speed
    const [financialResult, pumpStatsResult, assignmentStatsResult, recentWithdrawalsResult, readingStatsResult, pricesResult] = await Promise.all([
      // CTE: Transaction + withdrawal aggregates
      db.query(`
        WITH tx_by_type AS (
          SELECT
            type,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(SUM(liters), 0) as total_liters,
            COUNT(*) as tx_count
          FROM transactions
          WHERE shift_id = $1
          GROUP BY type
        ),
        withdrawal_total AS (
          SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE shift_id = $1
        ),
        unwithdrawn_cash AS (
          SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
          FROM transactions
          WHERE shift_id = $1 AND type = 'Cash' AND withdrawal_id IS NULL
        ),
        unwithdrawn_noncash AS (
          SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
          FROM transactions
          WHERE shift_id = $1 AND type != 'Cash' AND withdrawal_id IS NULL
        ),
        noncash_in_withdrawals AS (
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE shift_id = $1 AND type != 'Cash' AND withdrawal_id IS NOT NULL
        )
        SELECT
          json_agg(json_build_object('type', t.type, 'totalAmount', t.total_amount, 'totalLiters', t.total_liters, 'txCount', t.tx_count)) as tx_breakdown,
          (SELECT total FROM withdrawal_total) as total_withdrawals,
          (SELECT total FROM unwithdrawn_cash) as unwithdrawn_cash,
          (SELECT count FROM unwithdrawn_cash) as unwithdrawn_cash_count,
          (SELECT total FROM unwithdrawn_noncash) as unwithdrawn_noncash,
          (SELECT count FROM unwithdrawn_noncash) as unwithdrawn_noncash_count,
          (SELECT total FROM noncash_in_withdrawals) as noncash_in_withdrawals
        FROM tx_by_type t
      `, [shiftId]),

      // Pump stats
      db.query(`
        SELECT
          p.number as pump_number,
          p.id as pump_id,
          sa.dispatcher_id,
          u.name as dispatcher_name,
          COALESCE(SUM(t.amount), 0) as total_sales,
          COALESCE(SUM(t.liters), 0) as total_liters
        FROM pumps p
        JOIN shift_assignments sa ON sa.pump_id = p.id AND sa.shift_id = $1 AND sa.ended_at IS NULL
        JOIN users u ON sa.dispatcher_id = u.id
        LEFT JOIN transactions t ON t.pump_id = p.id AND t.shift_id = $1
        GROUP BY p.number, p.id, sa.dispatcher_id, u.name
        ORDER BY p.number
      `, [shiftId]),

      // Assignment stats
      db.query(`
        SELECT
          sa.id as assignment_id,
          p.number as pump_number,
          p.id as pump_id,
          sa.dispatcher_id,
          u.name as dispatcher_name,
          sa.started_at,
          sa.ended_at,
          COALESCE(SUM(t.amount), 0) as total_sales,
          COALESCE(SUM(t.liters), 0) as total_liters,
          COUNT(t.id) as transaction_count
        FROM shift_assignments sa
        JOIN pumps p ON sa.pump_id = p.id
        JOIN users u ON sa.dispatcher_id = u.id
        LEFT JOIN transactions t ON t.pump_id = sa.pump_id
          AND t.shift_id = sa.shift_id
          AND t.recorded_at >= sa.started_at
          AND (sa.ended_at IS NULL OR t.recorded_at <= sa.ended_at)
        WHERE sa.shift_id = $1
        GROUP BY sa.id, p.number, p.id, sa.dispatcher_id, u.name, sa.started_at, sa.ended_at
        ORDER BY sa.started_at DESC
      `, [shiftId]),

      // Recent withdrawals
      db.query(`
        SELECT w.*, u.name as recorded_by_name
        FROM withdrawals w
        JOIN users u ON w.recorded_by = u.id
        WHERE w.shift_id = $1
        ORDER BY w.recorded_at DESC
        LIMIT 20
      `, [shiftId]),

      // Meter readings per hose (with liters_dispensed)
      db.query(`
        SELECT
          p.number as pump_number,
          p.id as pump_id,
          gt.name as gas_type_name,
          gt.code as gas_type_code,
          h.id as hose_id,
          h.gas_type_id,
          MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END) as start_reading,
          MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) as end_reading,
          COALESCE(
            MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) -
            MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END),
            0
          ) as liters_dispensed,
          MAX(mr.recorded_at) as last_updated
        FROM pumps p
        JOIN hoses h ON h.pump_id = p.id AND h.is_active = true
        JOIN gas_types gt ON h.gas_type_id = gt.id
        LEFT JOIN meter_readings mr ON mr.hose_id = h.id AND mr.shift_id = $1
        GROUP BY p.number, p.id, gt.name, gt.code, h.id, h.gas_type_id
        ORDER BY p.number, gt.code
      `, [shiftId]),

      // Gas prices active at shift open time
      db.query(`
        SELECT DISTINCT ON (gt.id) gt.id as gas_type_id, gt.name, gt.code, gp.price
        FROM gas_types gt
        LEFT JOIN gas_prices gp ON gp.gas_type_id = gt.id
          AND gp.effective_from <= $1
          AND (gp.effective_until IS NULL OR gp.effective_until > $1)
        ORDER BY gt.id, gp.effective_from DESC
      `, [shift.opened_at]),
    ]);

    // ── Derive totalSales & totalLiters from meter readings × prices ──
    const priceByGasType: Record<string, number> = {};
    for (const p of pricesResult.rows) {
      priceByGasType[p.gas_type_id] = Number(p.price);
    }

    // Aggregate liters by gas type from hose readings
    const litersByGasType: Record<string, { liters: number; name: string; code: string }> = {};
    for (const r of readingStatsResult.rows) {
      const liters = Number(r.liters_dispensed);
      if (liters <= 0) continue;
      const gtId = r.gas_type_id;
      if (!litersByGasType[gtId]) {
        litersByGasType[gtId] = { liters: 0, name: r.gas_type_name, code: r.gas_type_code };
      }
      litersByGasType[gtId].liters += liters;
    }

    let totalLiters = 0;
    let totalSales = 0;
    for (const [gasTypeId, data] of Object.entries(litersByGasType)) {
      const price = priceByGasType[gasTypeId] || 0;
      totalLiters += data.liters;
      totalSales += data.liters * price;
    }

    // ── Card/Credit from transactions; cash is derived ──
    const financial = financialResult.rows[0] || {};
    const txBreakdown: Array<{ type: string; totalAmount: string; totalLiters: string; txCount: string }> = financial.tx_breakdown || [];

    const cardSales = Number(txBreakdown.find(r => r.type === 'Card')?.totalAmount || 0);
    const creditSales = Number(txBreakdown.find(r => r.type === 'Credit')?.totalAmount || 0);
    const cashSales = totalSales - cardSales - creditSales;

    const totalWithdrawals = Number(financial.total_withdrawals || 0);
    const nonCashInWithdrawals = Number(financial.noncash_in_withdrawals || 0);
    const cashOnlyWithdrawals = totalWithdrawals - nonCashInWithdrawals;
    const cashInHand = cashSales - cashOnlyWithdrawals;

    res.json({
      shiftId,
      openedAt: shift.opened_at,
      totalSales,
      totalLiters,
      totalWithdrawals,
      cashInHand,
      cashSales,
      cardSales,
      creditSales,
      pumpStats: pumpStatsResult.rows,
      assignmentStats: assignmentStatsResult.rows,
      recentWithdrawals: recentWithdrawalsResult.rows,
      readingStats: readingStatsResult.rows,
      unwithdrawnCash: Number(financial.unwithdrawn_cash || 0),
      unwithdrawnTransactionCount: Number(financial.unwithdrawn_cash_count || 0) + Number(financial.unwithdrawn_noncash_count || 0),
      unwithdrawnNonCash: Number(financial.unwithdrawn_noncash || 0),
      unwithdrawnNonCashCount: Number(financial.unwithdrawn_noncash_count || 0),
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
