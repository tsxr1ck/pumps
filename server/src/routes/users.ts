import { Router } from "express";
import bcryptjs from "bcryptjs";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { z } from "zod";

const router = Router();

// GET /api/users - list users
router.get("/", requireAuth, requireRole("Manager"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, numeric_id, name, role, is_active, created_at, updated_at FROM users ORDER BY numeric_id`,
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const userSchema = z.object({
  numericId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  pin: z.string().min(4).max(6),
  role: z.enum(["Manager", "Cashier", "Dispatcher"]),
});

// POST /api/users - create user
router.post("/", requireAuth, requireRole("Manager"), async (req, res) => {
  try {
    const parsed = userSchema.parse(req.body);
    const pinHash = await bcryptjs.hash(parsed.pin, 12);

    const result = await db.query(
      `INSERT INTO users (numeric_id, name, pin_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, numeric_id, name, role, is_active, created_at`,
      [parsed.numericId, parsed.name, pinHash, parsed.role],
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    if (err.code === "23505") {
      res.status(409).json({ error: "Numeric ID already exists" });
      return;
    }
    console.error("Create user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:id - update user (name, role, is_active)
router.patch("/:id", requireAuth, requireRole("Manager"), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        role: z.enum(["Manager", "Cashier", "Dispatcher"]).optional(),
        isActive: z.boolean().optional(),
        pin: z.string().min(4).max(6).optional(),
      })
      .parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.name) {
      fields.push(`name = $${idx++}`);
      values.push(parsed.name);
    }
    if (parsed.role) {
      fields.push(`role = $${idx++}`);
      values.push(parsed.role);
    }
    if (parsed.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(parsed.isActive);
    }
    if (parsed.pin) {
      const pinHash = await bcryptjs.hash(parsed.pin, 12);
      fields.push(`pin_hash = $${idx++}`);
      values.push(pinHash);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    const result = await db.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING id, numeric_id, name, role, is_active, created_at, updated_at`,
      values,
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("Update user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
