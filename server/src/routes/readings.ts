import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

const readingSchema = z.object({
  shiftId: z.string().uuid(),
  hoseId: z.string().uuid(),
  readingType: z.enum(['start', 'end']),
  value: z.number().positive(),
});

// POST /api/readings - submit a meter reading
router.post('/', requireAuth, requireRole('Dispatcher', 'Manager'), async (req, res) => {
  try {
    const parsed = readingSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO meter_readings (shift_id, hose_id, reading_type, value, recorded_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (shift_id, hose_id, reading_type)
       DO UPDATE SET value = EXCLUDED.value, recorded_by = EXCLUDED.recorded_by, recorded_at = NOW()
       RETURNING *`,
      [parsed.shiftId, parsed.hoseId, parsed.readingType, parsed.value, (req as any).user.userId]
    );

    const { publishEvent } = await import('../realtime/publisher.js');
    await publishEvent('reading:updated', {
      shiftId: parsed.shiftId,
      hoseId: parsed.hoseId,
      readingType: parsed.readingType,
    });

    res.status(201).json({ reading: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Reading error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/readings?shift_id=...
router.get('/', requireAuth, async (req, res) => {
  try {
    const { shift_id } = req.query;
    if (!shift_id || typeof shift_id !== 'string') {
      res.status(400).json({ error: 'shift_id query param required' });
      return;
    }

    const result = await db.query(
      `SELECT mr.*, u.name as recorded_by_name, h.pump_id, p.number as pump_number,
              gt.name as gas_type_name, gt.code as gas_type_code
       FROM meter_readings mr
       JOIN users u ON mr.recorded_by = u.id
       JOIN hoses h ON mr.hose_id = h.id
       JOIN pumps p ON h.pump_id = p.id
       JOIN gas_types gt ON h.gas_type_id = gt.id
       WHERE mr.shift_id = $1
       ORDER BY p.number, gt.code, mr.reading_type`,
      [shift_id]
    );

    res.json({ readings: result.rows });
  } catch (err) {
    console.error('List readings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
