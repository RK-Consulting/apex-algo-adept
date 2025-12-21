import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

/* ================= GET PROFILE ================= */
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const result = await query(
    `SELECT full_name, email, phone, pan
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    return res.json({
      exists: false,
      isComplete: false,
    });
  }

  const profile = result.rows[0];

  const isComplete =
    !!profile.full_name &&
    !!profile.email &&
    !!profile.phone &&
    !!profile.pan;

  res.json({
    exists: true,
    isComplete,
    profile,
  });
});

/* ================= UPSERT PROFILE ================= */
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { full_name, email, phone, pan } = req.body;

  await query(
    `
    INSERT INTO user_profiles (user_id, full_name, email, phone, pan)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id)
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      pan = EXCLUDED.pan,
      updated_at = now()
    `,
    [userId, full_name, email, phone, pan]
  );

  res.json({ success: true });
});

export default router;
