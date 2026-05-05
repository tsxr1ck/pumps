import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { z } from 'zod';

const router = Router();

// GET /api/credits - list all credit categories
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, code, parent_id, is_active, created_at
      FROM credit_categories
      ORDER BY name
    `);

    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Credits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const creditSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).optional(),
  parentId: z.string().uuid().optional().nullable(),
});

// POST /api/credits - create a credit category
router.post('/', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const parsed = creditSchema.parse(req.body);
    const result = await db.query(
      `INSERT INTO credit_categories (name, code, parent_id) VALUES ($1, $2, $3) RETURNING *`,
      [parsed.name, parsed.code || null, parsed.parentId || null]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Create credit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/credits/:id - update a credit category
router.patch('/:id', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = creditSchema.partial().parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.name !== undefined) { fields.push(`name = $${idx++}`); values.push(parsed.name); }
    if (parsed.code !== undefined) { fields.push(`code = $${idx++}`); values.push(parsed.code); }
    if (parsed.parentId !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(parsed.parentId); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    const result = await db.query(
      `UPDATE credit_categories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({ category: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('Update credit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/credits/:id - soft-delete by deactivating
router.delete('/:id', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE credit_categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({ category: result.rows[0] });
  } catch (err) {
    console.error('Deactivate credit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
