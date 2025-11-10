import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

// Simple in-memory rate limiting per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * POST /api/strategies/generate
 * Uses AI (Gemini or Lovable) to generate a strategy and store in Postgres
 */
router.post("/generate", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { name, trading_style, capital_allocation, risk_level, description } = req.body;

    // --- Rate Limiting: 10 per hour per user ---
    const now = Date.now();
    const limit = rateLimitMap.get(userId);
    if (limit && now < limit.resetTime && limit.count >= 10) {
      return res.status(429).json({
        error: "Rate limit exceeded — max 10 strategy generations per hour.",
      });
    }
    if (!limit || now > limit.resetTime) {
      rateLimitMap.set(userId, { count: 1, resetTime: now + 3600000 });
    } else {
      limit.count++;
    }

    // --- AI Model Selection ---
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an expert Indian stock market strategy designer. Generate structured JSON for a trading strategy.",
          },
          {
            role: "user",
            content: `Design a ${risk_level} risk ${trading_style} strategy for Indian markets.

Name: ${name}
Capital: ₹${capital_allocation}
Description: ${description || "Not provided"}

Return a JSON with:
entry_rules, exit_rules, position_sizing, risk_management, recommended_instruments, timeframe, expected_metrics.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const rawText = (data as any).choices?.[0]?.message?.content || "{}";
    let parsed: any;

    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { raw: rawText };
    } catch {
      parsed = { raw: rawText };
    }

    // --- Insert into database ---
    const result = await query(
      `
      INSERT INTO strategies (
        user_id, name, description, entry_condition, exit_condition, 
        risk_management, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING *
      `,
      [
        userId,
        name,
        description || "AI-generated trading strategy",
        JSON.stringify(parsed.entry_rules || parsed.entry_condition || {}),
        JSON.stringify(parsed.exit_rules || parsed.exit_condition || {}),
        JSON.stringify(parsed.risk_management || {}),
      ]
    );

    return res.json({
      success: true,
      message: "Strategy generated and saved successfully.",
      strategy: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Strategy generation error:", err);
    next(err);
  }
});

/**
 * GET /api/strategies
 * Fetch all user strategies
 */
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { rows } = await query(
      "SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/strategies/:id
 * Get a specific strategy by ID
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { rows } = await query(
      "SELECT * FROM strategies WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/strategies/:id
 * Update an existing strategy
 */
router.put("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const allowed = ["name", "description", "is_active", "entry_condition", "exit_condition", "risk_management"];
    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = $${i}`);
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
        i++;
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

    values.push(id, userId);

    const { rows } = await query(
      `UPDATE strategies 
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i} AND user_id = $${i + 1}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    res.json({ success: true, strategy: rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/strategies/:id
 * Remove a strategy
 */
router.delete("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { rows } = await query(
      "DELETE FROM strategies WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Strategy not found" });

    res.json({ success: true, message: "Strategy deleted successfully." });
  } catch (err) {
    next(err);
  }
});

export { router as strategyRouter };
