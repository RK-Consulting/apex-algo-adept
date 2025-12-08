// /backend/src/routes/icici/authLogin.ts
import { Router } from "express";

const router = Router();

router.get("/auth/login", (req, res) => {
  const appKey = process.env.ICICI_APP_KEY;

  if (!appKey) {
    return res.status(500).send("ICICI_APP_KEY missing in environment");
  }

  const loginUrl =
    "https://api.icicidirect.com/apiuser/login?api_key=" +
    encodeURIComponent(appKey);

  return res.redirect(loginUrl);
});

export const iciciAuthLoginRouter = router;
