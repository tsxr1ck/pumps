import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// GET /api/pumps - list all pumps with hoses and gas types (single query)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id, p.number, p.name, p.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', h.id,
              'pumpId', h.pump_id,
              'gasTypeId', h.gas_type_id,
              'side', h.side,
              'isActive', h.is_active,
              'gasTypeName', gt.name,
              'gasTypeCode', gt.code
            ) ORDER BY gt.code
          ) FILTER (WHERE h.id IS NOT NULL AND h.is_active = true),
          '[]'::json
        ) as hoses
      FROM pumps p
      LEFT JOIN hoses h ON h.pump_id = p.id AND h.is_active = true
      LEFT JOIN gas_types gt ON h.gas_type_id = gt.id
      GROUP BY p.id, p.number, p.name, p.is_active
      ORDER BY p.number
    `);

    res.json({ pumps: result.rows });
  } catch (err) {
    console.error('Pumps error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
