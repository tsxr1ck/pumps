import { Router } from "express";
import bcryptjs from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "../lib/db.js";
import { signAccessToken, signRefreshToken } from "../lib/tokens.js";
import { z } from "zod";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." },
});

const loginSchema = z.object({
  numericId: z.number().int().positive(),
  pin: z.string().min(4).max(6),
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = await db.query(
      "SELECT id, numeric_id, name, pin_hash, role, is_active FROM users WHERE numeric_id = $1",
      [parsed.numericId],
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = result.rows[0];
    if (!user.is_active) {
      res.status(403).json({ error: "Account deactivated" });
      return;
    }

    const valid = await bcryptjs.compare(parsed.pin, user.pin_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const payload = {
      userId: user.id,
      numericId: user.numeric_id,
      role: user.role,
      name: user.name,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user.id });

    res.json({
      user: {
        id: user.id,
        numericId: user.numeric_id,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token required" });
      return;
    }

    const { verifyRefreshToken } = await import("../lib/tokens.js");
    const { userId } = verifyRefreshToken(refreshToken);

    const result = await db.query(
      "SELECT id, numeric_id, name, role, is_active FROM users WHERE id = $1",
      [userId],
    );

    if (result.rowCount === 0 || !result.rows[0].is_active) {
      res.status(401).json({ error: "User not found or deactivated" });
      return;
    }

    const user = result.rows[0];
    const payload = {
      userId: user.id,
      numericId: user.numeric_id,
      role: user.role,
      name: user.name,
    };

    const newAccessToken = signAccessToken(payload);
    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

export default router;
