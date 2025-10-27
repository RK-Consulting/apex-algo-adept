import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import crypto from "crypto";

const router = Router();

/* breezeconnect has no official types in this project.
   Use require to import it (works with commonjs-style package) */
 // @ts-ignore
const { BreezeConnect } = require("breezeconnect");

/**
 * AES-256-GCM encrypt/decrypt helpers
 * -> returns base64 strings for storage
 */
async function encryptData(
  data: string,
  key: Buffer
): Promise<{ encrypted: string; iv: string; tag: string }> {
  const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encryptedBuffer = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encryptedBuffer.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
  };
}

async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  tagBase64: string,
  key: Buffer
): Promise<string> {
  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  const authTag = Buffer.from(tagBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }

  return crypto.pbkdf2Sync(masterSecret, "alphaforge-credentials-v1", 100000, 32, "sha256");
}

/**
 * POST /connect
 * Store encrypted ICICI credentials (api_key, api_secret, session_token)
 * Tests connection with Breeze before storing.
 */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { api_key, api_secret, session_token } = req.body;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({
        error: "Missing required fields: api_key, api_secret, and session_token are required",
      });
    }

    const encryptionKey = getEncryptionKey();

    // Test connection with Breeze
    try {
      const breeze = new BreezeConnect({ appKey: api_key }); // initialize with appKey
      // generateSession may accept (secret, sessionToken) depending on package version
      // keep the call as in your previous code — catch errors below
      await breeze.generateSession(api_secret, session_token);

      // quick smoke test: funds or profile (choose a light call)
      const fundsResponse = await breeze.getFunds();
      console.log("ICICI Direct connection successful (funds):", fundsResponse);
    } catch (connectionError: any) {
      console.error("Failed to connect to ICICI Direct:", connectionError && connectionError.message ? connectionError.message : connectionError);
      return res.status(400).json({
        error: "Failed to connect to ICICI Direct. Please check your credentials and session token.",
        details: connectionError && connectionError.message ? connectionError.message : String(connectionError),
      });
    }

    // Encrypt credentials (store encrypted + iv + tag)
    const apiKeyEnc = await encryptData(api_key, encryptionKey);
    const apiSecretEnc = await encryptData(api_secret, encryptionKey);
    const sessionTokenEnc = await encryptData(session_token, encryptionKey);

    // Check if credentials exist
    const existing = await query(
      "SELECT id FROM user_credentials WHERE user_id = $1 AND broker_name = $2",
      [userId, "ICICIDIRECT"]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update
      result = await query(
        `UPDATE user_credentials
         SET api_key = $1, api_secret = $2, session_token = $3, updated_at = NOW()
         WHERE user_id = $4 AND broker_name = $5
         RETURNING id`,
        [
          JSON.stringify(apiKeyEnc),
          JSON.stringify(apiSecretEnc),
          JSON.stringify(sessionTokenEnc),
          userId,
          "ICICIDIRECT",
        ]
      );
    } else {
      // Insert
      result = await query(
        `INSERT INTO user_credentials (user_id, broker_name, api_key, api_secret, session_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, "ICICIDIRECT", JSON.stringify(apiKeyEnc), JSON.stringify(apiSecretEnc), JSON.stringify(sessionTokenEnc)]
      );
    }

    res.json({
      success: true,
      message: "ICICI Direct connected successfully",
      credential_id: result.rows[0].id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper: create a Breeze instance for a user (decrypts credentials)
 */
async function getBreezeInstance(userId: string): Promise<any> {
  const result = await query(
    "SELECT api_key, api_secret, session_token FROM user_credentials WHERE user_id = $1 AND broker_name = $2",
    [userId, "ICICIDIRECT"]
  );

  if (result.rows.length === 0) {
    throw new Error("ICICI Direct credentials not found. Please connect your broker first.");
  }

  const credentials = result.rows[0];
  const encryptionKey = getEncryptionKey();

  // Stored objects: { encrypted, iv, tag }
  const apiKeyData = JSON.parse(credentials.api_key);
  const apiKey = await decryptData(apiKeyData.encrypted, apiKeyData.iv, apiKeyData.tag, encryptionKey);

  const apiSecretData = JSON.parse(credentials.api_secret);
  const apiSecret = await decryptData(apiSecretData.encrypted, apiSecretData.iv, apiSecretData.tag, encryptionKey);

  const sessionTokenData = JSON.parse(credentials.session_token);
  const sessionToken = await decryptData(sessionTokenData.encrypted, sessionTokenData.iv, sessionTokenData.tag, encryptionKey);

  // Initialize Breeze and generate session
  const breeze = new BreezeConnect({ appKey: apiKey });
  await breeze.generateSession(apiSecret, sessionToken);

  return breeze;
}

/** GET /funds */
router.get("/funds", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);
    const funds = await breeze.getFunds();

    res.json({ success: true, data: funds });
  } catch (error) {
    next(error);
  }
});

/** GET /holdings */
router.get("/holdings", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    const holdings = await breeze.getPortfolioHoldings({
      exchange_code: (req.query.exchange_code as string) || "NSE",
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
      stock_code: req.query.stock_code as string | undefined,
      portfolio_type: req.query.portfolio_type as string | undefined,
    });

    res.json({ success: true, data: holdings });
  } catch (error) {
    next(error);
  }
});

/** POST /order */
router.post("/order", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    const {
      stock_code,
      exchange_code,
      product,
      action,
      order_type,
      quantity,
      price,
      validity,
      stoploss,
      disclosed_quantity,
      validity_date,
    } = req.body;

    if (!stock_code || !exchange_code || !action || !quantity) {
      return res.status(400).json({
        error: "Missing required fields: stock_code, exchange_code, action, quantity",
      });
    }

    const orderResponse = await breeze.placeOrder({
      stock_code,
      exchange_code,
      product: product || "cash",
      action,
      order_type: order_type || "market",
      quantity,
      price: price || "0",
      validity: validity || "day",
      stoploss: stoploss || "0",
      disclosed_quantity: disclosed_quantity || "0",
      validity_date: validity_date || new Date().toISOString(),
      settlement_id: "",
      margin_amount: "",
      open_quantity: "",
      cover_quantity: "",
      product_type: product || "cash",
      source_flag: "",
      user_remark: "AlphaForge Order",
      order_type_fresh: order_type || "market",
      order_rate_fresh: price || "0",
    });

    res.json({ success: true, data: orderResponse });
  } catch (error) {
    next(error);
  }
});

/** GET /orders */
router.get("/orders", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    const orders = await breeze.getOrderList({
      exchange_code: (req.query.exchange_code as string) || "NSE",
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

/** GET /quotes */
router.get("/quotes", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    const { stock_code, exchange_code } = req.query;

    if (!stock_code || !exchange_code) {
      return res.status(400).json({
        error: "Missing required parameters: stock_code and exchange_code",
      });
    }

    const quotes = await breeze.getQuotes({
      stock_code: stock_code as string,
      exchange_code: exchange_code as string,
    });

    res.json({ success: true, data: quotes });
  } catch (error) {
    next(error);
  }
});

/** DELETE /order/:orderId */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);
    const { orderId } = req.params;

    const cancelResponse = await breeze.cancelOrder({
      exchange_code: (req.body.exchange_code as string) || "NSE",
      order_id: orderId,
    });

    res.json({ success: true, data: cancelResponse });
  } catch (error) {
    next(error);
  }
});

/** GET /historical */
router.get("/historical", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    const { interval, from_date, to_date, stock_code, exchange_code } = req.query;

    if (!interval || !from_date || !to_date || !stock_code || !exchange_code) {
      return res.status(400).json({
        error: "Missing required parameters: interval, from_date, to_date, stock_code, exchange_code",
      });
    }

    const historicalData = await breeze.getHistoricalData({
      interval: interval as string,
      from_date: from_date as string,
      to_date: to_date as string,
      stock_code: stock_code as string,
      exchange_code: exchange_code as string,
      product_type: (req.query.product_type as string) || "cash",
    });

    res.json({ success: true, data: historicalData });
  } catch (error) {
    next(error);
  }
});

export { router as iciciBrokerRouter };
