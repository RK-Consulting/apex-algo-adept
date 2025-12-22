// /backend/src/routes/profile.ts

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

/* ================= GET PROFILE ================= */
/* router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const result = await query(
    `
    SELECT full_name, email, phone, pan
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    // This should practically never happen
    return res.status(404).json({
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
*/
router.get("/", async (_req, res) => {
  const result = await query(
    `SELECT id, email, full_name, phone, pan FROM users LIMIT 1`
  );
  res.json(result.rows[0] || {});
});

/* ================= UPDATE PROFILE ================= */
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { full_name, phone, pan } = req.body;

  await query(
    `
    UPDATE users
    SET
      full_name = $2,
      phone = $3,
      pan = $4,
      updated_at = now()
    WHERE id = $1
    `,
    [userId, full_name, phone, pan]
  );

  res.json({ success: true });
});

export default router;
