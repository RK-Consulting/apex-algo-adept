// backend/src/routes/icici/authLogin.ts
import { Router } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { SessionService } from "../../services/sessionService";  // New import
import { authenticateToken } from '../../middleware/auth.js';  // Add this
import debug from "debug";

const log = debug("apex:icici:login");
const router = Router();

// Initiate login (per-user api_key from DB)
// Initiate ICICI Breeze Login
router.get('/auth/login', authenticateToken, async (req: AuthRequest, res) => {  // Now defined
  try {
    const userId = req.user!.userId;
    const credentials = await SessionService.getInstance().getCredentials(userId);
    if (!credentials?.api_key) {
      return res.status(400).json({ error: 'API key not configured for user' });
    }

    const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(credentials.api_key)}`;
    log('Redirecting user %s to ICICI login', userId);
    return res.redirect(loginUrl);
  } catch (err: any) {
    log('Login init error:', err);
    return res.status(500).json({ error: 'Failed to initiate login' });
  }
});

export const iciciAuthLoginRouter = router;
