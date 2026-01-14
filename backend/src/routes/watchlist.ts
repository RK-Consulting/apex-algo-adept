// backend/src/routes/watchlist.ts

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import debug from "debug";

const log = debug("alphaforge:watchlist");
const router = Router();

/**
 * GET /
 * Returns watchlist groups for the authenticated user
 */
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { rows } = await query(
      `SELECT id, group_name, symbols, position, created_at, updated_at
       FROM user_watchlist_groups
       WHERE user_id = $1::uuid
       ORDER BY position ASC, created_at ASC`,
      [userId]
    );

    // DB returns JSONB as native JS array automatically with pg-node
    const groups = rows.map((r) => ({
      id: r.id,
      name: r.group_name,
      symbols: Array.isArray(r.symbols) ? r.symbols : [],
      position: r.position,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    res.json({ success: true, groups });
  } catch (err) {
    log("❌ Error fetching watchlist: %o", err);
    next(err);
  }
});

/**
 * POST /update-groups
 * Full sync of groups (Upsert logic)
 */
router.post("/update-groups", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groups } = req.body;

    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: "groups array required" });
    }

    // 1) Get current state to identify deletions
    const { rows: existing } = await query(
      `SELECT id FROM user_watchlist_groups WHERE user_id = $1::uuid`,
      [userId]
    );
    const existingIds = new Set(existing.map((r) => r.id));

    // 2) Upsert loop
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const id = g.id || null;
      const name = (g.name || `Group ${i + 1}`).slice(0, 128);
      const symbols = Array.isArray(g.symbols) ? g.symbols : [];
      const position = typeof g.position === "number" ? g.position : i;

      if (id && existingIds.has(id)) {
        await query(
          `UPDATE user_watchlist_groups
           SET group_name = $1, symbols = $2, position = $3, updated_at = NOW()
           WHERE id = $4 AND user_id = $5::uuid`,
          [name, JSON.stringify(symbols), position, id, userId]
        );
        existingIds.delete(id);
      } else {
        await query(
          `INSERT INTO user_watchlist_groups (user_id, group_name, symbols, position)
           VALUES ($1::uuid, $2, $3, $4)`,
          [userId, name, JSON.stringify(symbols), position]
        );
      }
    }

    // 3) Clean up removed groups
    if (existingIds.size > 0) {
      await query(
        `DELETE FROM user_watchlist_groups WHERE id = ANY($1::uuid[]) AND user_id = $2::uuid`,
        [Array.from(existingIds), userId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    log("❌ Error updating groups: %o", err);
    next(err);
  }
});

/**
 * POST /add
 * Appends a symbol to a group
 */
router.post("/add", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    if (groupId) {
      const { rows } = await query(
        `SELECT symbols FROM user_watchlist_groups WHERE id = $1 AND user_id = $2::uuid`,
        [groupId, userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: "group not found" });

      const symbols = Array.isArray(rows[0].symbols) ? rows[0].symbols : [];
      if (!symbols.includes(symbol)) {
        symbols.push(symbol);
        await query(
          `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() 
           WHERE id = $2 AND user_id = $3::uuid`,
          [JSON.stringify(symbols), groupId, userId]
        );
      }
      return res.json({ success: true, groupId });
    } else {
      // Find or Create Default
      const { rows } = await query(
        `SELECT id, symbols FROM user_watchlist_groups 
         WHERE user_id = $1::uuid ORDER BY position ASC LIMIT 1`,
        [userId]
      );

      if (rows.length === 0) {
        const insert = await query(
          `INSERT INTO user_watchlist_groups (user_id, group_name, symbols, position) 
           VALUES ($1::uuid, 'Default', $2, 0) RETURNING id`,
          [userId, JSON.stringify([symbol])]
        );
        return res.json({ success: true, groupId: insert.rows[0].id });
      } else {
        const existingSymbols = Array.isArray(rows[0].symbols) ? rows[0].symbols : [];
        if (!existingSymbols.includes(symbol)) {
          existingSymbols.push(symbol);
          await query(
            `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(existingSymbols), rows[0].id]
          );
        }
        return res.json({ success: true, groupId: rows[0].id });
      }
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /remove
 */
router.post("/remove", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, symbol } = req.body;
    if (!groupId || !symbol) return res.status(400).json({ error: "groupId/symbol required" });

    const { rows } = await query(
      `SELECT symbols FROM user_watchlist_groups WHERE id = $1 AND user_id = $2::uuid`,
      [groupId, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "group not found" });

    const symbols = Array.isArray(rows[0].symbols) ? rows[0].symbols.filter((s: string) => s !== symbol) : [];
    await query(
      `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3::uuid`,
      [JSON.stringify(symbols), groupId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as watchlistRouter };
