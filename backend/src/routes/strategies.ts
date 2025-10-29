import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
//import fetch from "node-fetch";

const router = Router();

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Generate strategy using AI
router.post("/generate", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { name, trading_style, capital_allocation, risk_level, description } = req.body;

    // Rate limiting
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (userLimit) {
      if (now < userLimit.resetTime) {
        if (userLimit.count >= 10) {
          return res.status(429).json({
            error: "Rate limit exceeded. You can create a maximum of 10 strategies per hour.",
          });
        }
        userLimit.count++;
      } else {
        rateLimitMap.set(userId, { count: 1, resetTime: now + 3600000 });
      }
    } else {
      rateLimitMap.set(userId, { count: 1, resetTime: now + 3600000 });
    }

    // Call AI service
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an expert algorithmic trading strategy designer for the Indian stock market. Generate detailed trading strategies with specific entry/exit rules, risk management parameters, and technical indicators. Return structured JSON data only.",
          },
          {
            role: "user",
            content: `Generate a ${risk_level} risk ${trading_style} trading strategy for the Indian stock market.
            
Strategy Name: ${name}
Capital: ₹${capital_allocation}
Description: ${description || "Not provided"}

Please provide:
1. Entry conditions (specific technical indicators and thresholds)
2. Exit conditions (take profit, stop loss levels)
3. Position sizing rules
4. Risk management parameters
5. Recommended instruments (stocks, indices, derivatives)
6. Timeframe specifications
7. Expected metrics (win rate estimate, max drawdown, profit target)

Format the response as a JSON object with these keys: entry_rules, exit_rules, position_sizing, risk_management, recommended_instruments, timeframe, expected_metrics, reasoning.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = (await aiResponse.json()) as {
      choices: { message: { content: string } }[];
    };

    const strategyContent = aiData.choices[0].message.content;

    // Parse AI response
    let strategyConfig: any;
    try {
      const jsonMatch = strategyContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        strategyConfig = JSON.parse(jsonMatch[0]);
      } else {
        strategyConfig = {
          raw_response: strategyContent,
          entry_rules: "See raw_response for details",
          exit_rules: "See raw_response for details",
          position_sizing: "See raw_response for details",
          risk_management: "See raw_response for details",
          recommended_instruments: ["NIFTY", "BANKNIFTY"],
          timeframe: trading_style,
          expected_metrics: {
            win_rate: "65-75%",
            max_drawdown: "15-20%",
            profit_target: "15-25%",
          },
        };
      }
    } catch {
      strategyConfig = {
        raw_response: strategyContent,
        error: "Could not parse structured response",
      };
    }

    // Save to database
    const result = await query(
      `INSERT INTO strategies (
        user_id, name, description, trading_style, capital_allocation,
        risk_level, status, ai_generated, strategy_config, performance_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        name,
        description || "AI-generated strategy",
        trading_style,
        capital_allocation,
        risk_level,
        "paused",
        true,
        JSON.stringify(strategyConfig),
        JSON.stringify({
          total_trades: 0,
          win_rate: 0,
          total_return: 0,
          max_drawdown: 0,
        }),
      ]
    );

    res.json({
      success: true,
      strategy: result.rows[0],
      message: "Strategy generated successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Get all strategies for user
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await query(
      "SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get single strategy
router.get("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await query(
      "SELECT * FROM strategies WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update strategy
router.put("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      "name",
      "description",
      "status",
      "capital_allocation",
      "strategy_config",
      "performance_data",
    ];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE strategies SET ${setClause.join(", ")}, updated_at = NOW()
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete strategy
router.delete("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await query("DELETE FROM strategies WHERE id = $1 AND user_id = $2 RETURNING id", [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    res.json({ success: true, message: "Strategy deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as strategyRouter };
