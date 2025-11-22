// backend/src/routes/icici/status.ts
import { Router } from "express";
import debug from "debug";
import { AuthRequest, authenticateToken } from "../../middleware/auth.js";
import { getSessionForUser } from "../../utils/breezeSession.js";

const router = Router();
const log = debug("apex:icici:status");

router.get("/status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const session = await getSessionForUser(userId);
    const connected = !!(session && session.jwtToken);
    res.json({ success: true, connected, sessionMeta: session ? { expires_at: session.expires_at } : null });
  } catch (err: any) {
    log("Status error:", err);
    res.status(500).json({ success: false, connected: false, error: err.message });
  }
});

export { router as iciciStatusRouter };
