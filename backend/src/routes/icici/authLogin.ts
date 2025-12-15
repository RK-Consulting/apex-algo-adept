// backend/src/routes/icici/authLogin.ts
import { Router } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { SessionService } from "../../services/sessionService";  // New import
import debug from "debug";

const log = debug("apex:icici:login");
const router = Router();

// Initiate login (per-user api_key from DB)
router.get("/auth/login", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Use SessionService to get credentials
    const credentials = await SessionService.getInstance().getCredentials(userId);

    if (!credentials || !credentials.api_key) {
      return res.status(400).json({ error: "API key not configured for user" });
    }

    const { api_key } = credentials;
    const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(api_key)}`;
    log("Redirecting user %s to ICICI login", userId);
    return res.redirect(loginUrl);
  } catch (err) {
    log("Login init error:", err);
    return res.status(500).json({ error: "Failed to initiate login" });
  }
});

export const iciciAuthLoginRouter = router;
