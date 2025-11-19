// backend/src/routes/strategies.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import debug from "debug";

const router = Router();
const log = debug("apex:routes:strategies");

// In-memory per-user rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_PER_HOUR = Number(process.env.STRATEGY_RATE_LIMIT_PER_HOUR || 10);
const RATE_WINDOW_MS = 60 * 60 * 1000;

function safeParseStrategyJson(rawText: string) {
  if (!rawText || typeof rawText !== "string") return { raw: rawText || "" };

  try {
    return JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
  }

  return { raw: rawText };
}

async function callAiModel(payload: any, timeoutMs = 30_000) {
  const provider = (process.env.PREFERRED_AI_PROVIDER || "LOVABLE").toUpperCase();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === "GEMINI") {
      const API_KEY = process.env.GEMINI_API_KEY;
      if (!API_KEY) throw new Error("GEMINI_API_KEY not configured");

      const resp = await fetch("https://api.generative.google/v1beta2/models/gemini-2.5-chat:generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      return (
        json?.candidates?.[0]?.content?.[0]?.text ||
        json?.outputs?.[0]?.content?.[0]?.text ||
        json?.message?.content?.[0]?.text ||
        JSON.stringify(json)
      );
    } else {
      const API_KEY = process.env.LOVABLE_API_KEY;
      if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`AI provider returned ${resp.status}: ${txt}`);
      }

      const json = await resp.json();
      return json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || JSON.stringify(json);
    }
  } finally {
    clearTimeout(id);
  }
}

/**
 * POST /api/strategies/generate
 */
router.post("/generate", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId; // ✅ FIXED

    const { name, trading_style, capital_allocation, risk_level, description } = req.body ?? {};

    if (!name || !trading_style) {
      return res.status(400).json({ error: "name and trading_style are required" });
    }

    const capital = Number(capital_allocation ?? 0);
    if (Number.isNaN(capital) || capital < 0) {
      return res.status(400).json({ error: "capital_allocation must be a valid non-negative number" });
    }

    const risk = (risk_level || "medium").toString();

    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (entry && now < entry.resetTime && entry.count >= MAX_PER_HOUR) {
      const ttlSec = Math.ceil((entry.resetTime - now) / 1000);
      return res.status(429).json({
        error: `Rate limit exceeded — max ${MAX_PER_HOUR} per hour. Try again in ${ttlSec}s.`,
      });
    }

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    } else {
      entry.count++;
    }

    const modelPrompt = [
      {
        role: "system",
        content:
          "You are an expert Indian equities and derivatives strategy designer. Respond with a single JSON object only when possible.",
      },
      {
        role: "user",
        content: `Design a ${risk} risk ${trading_style} strategy...
Name: ${name}
Capital: ₹${capital.toLocaleString("en-IN")}
Description: ${description || "Not provided"}`,
      },
    ];

    const provider = (process.env.PREFERRED_AI_PROVIDER || "LOVABLE").toUpperCase();
    const aiPayload =
      provider === "GEMINI"
        ? {
            model: process.env.GEMINI_MODEL || "gemini-2.5",
            messages: modelPrompt,
            temperature: Number(process.env.AI_TEMPERATURE || 0.2),
            max_output_tokens: Number(process.env.AI_MAX_TOKENS || 1024),
          }
        : {
            model: process.env.LOVABLE_MODEL || "google/gemini-2.5-flash",
            messages: modelPrompt,
            temperature: Number(process.env.AI_TEMPERATURE || 0.2),
            max_tokens: Number(process.env.AI_MAX_TOKENS || 1024),
          };

    const raw = await callAiModel(aiPayload);
    const rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = safeParseStrategyJson(rawText);

    const strategyConfig: any = {
      name,
      description: description || parsed.description || parsed.raw || "",
      timeframe: parsed.timeframe || "1day",
      entry_rules: parsed.entry_rules || parsed.entry_condition || [],
      exit_rules: parsed.exit_rules || parsed.exit_condition || [],
      position_sizing: parsed.position_sizing || { type: "percent", value: 1 },
      risk_management: parsed.risk_management || {
        stop_loss: parsed.stop_loss || 1.5,
        take_profit: parsed.take_profit || 3.0,
      },
      recommended_instruments: parsed.recommended_instruments || [],
      expected_metrics: parsed.expected_metrics || {},
      notes: parsed.notes || undefined,
      _raw_ai_text: rawText.slice(0, 4000),
    };

    const insertSql = `
      INSERT INTO strategies (
        user_id, name, description,
        entry_condition, exit_condition,
        risk_management, strategy_config,
        is_active, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW())
      RETURNING *
    `;

    const insertVals = [
      userId,
      strategyConfig.name,
      strategyConfig.description,
      JSON.stringify(strategyConfig.entry_rules || {}),
      JSON.stringify(strategyConfig.exit_rules || {}),
      JSON.stringify(strategyConfig.risk_management || {}),
      JSON.stringify(strategyConfig),
    ];

    const result = await query(insertSql, insertVals);

    return res.json({
      success: true,
      message: "Strategy generated and saved successfully.",
      strategy: result.rows?.[0] ?? null,
    });
  } catch (err) {
    log("Strategy generation error:", err);
    return next(err);
  }
});

/**
 * GET /api/strategies
 */
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId; // ✅ FIXED

    const { rows } = await query(
      "SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return res.json({ success: true, strategies: rows });
  } catch (err) {
    log("Fetch strategies error:", err);
    return next(err);
  }
});

/**
 * GET /api/strategies/:id
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId; // ✅ FIXED
    const { id } = req.params;

    const { rows } = await query(
      "SELECT * FROM strategies WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Strategy not found" });

    return res.json({ success: true, strategy: rows[0] });
  } catch (err) {
    log("Get strategy error:", err);
    return next(err);
  }
});

/**
 * PUT /api/strategies/:id
 */
router.put("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId; // ✅ FIXED
    const { id } = req.params;
    const updates = req.body ?? {};

    const allowed = [
      "name",
      "description",
      "is_active",
      "entry_condition",
      "exit_condition",
      "risk_management",
      "strategy_config",
    ];

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      fields.push(`${key} = $${i}`);
      values.push(typeof value === "object" ? JSON.stringify(value) : value);
      i++;
    }

    if (fields.length === 0)
      return res.status(400).json({ error: "No valid fields to update" });

    values.push(id, userId);

    const sql = `
      UPDATE strategies
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${i} AND user_id = $${i + 1}
      RETURNING *
    `;

    const { rows } = await query(sql, values);

    if (rows.length === 0)
      return res.status(404).json({ error: "Strategy not found" });

    return res.json({ success: true, strategy: rows[0] });
  } catch (err) {
    log("Update strategy error:", err);
    return next(err);
  }
});

/**
 * DELETE /api/strategies/:id
 */
router.delete("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId; // ✅ FIXED
    const { id } = req.params;

    const { rows } = await query(
      "DELETE FROM strategies WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Strategy not found" });

    return res.json({ success: true, message: "Strategy deleted successfully." });
  } catch (err) {
    log("Delete strategy error:", err);
    return next(err);
  }
});

export { router as strategyRouter };
