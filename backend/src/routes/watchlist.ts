// backend/src/routes/watchlist.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import debug from "debug";

const log = debug("apex:watchlist");
const router = Router();

/**
 * GET /api/watchlist
 * Returns groups for authenticated user
 * Response: { success: true, groups: [{ id, name, symbols, position }] }
 */
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { rows } = await query(
      `SELECT id, group_name, symbols, position, created_at, updated_at
       FROM user_watchlist_groups
       WHERE user_id = $1
       ORDER BY position ASC, created_at ASC`,
      [userId]
    );

    // map DB columns to expected shape
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
    next(err);
  }
});

/**
 * POST /api/watchlist/update-groups
 * Persist entire groups array from client (simpler to keep client-server in sync)
 * Body: { groups: [{ id?, name, symbols, position? }] }
 */
router.post("/update-groups", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groups } = req.body;
    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: "groups array required" });
    }

    // We'll perform simple server-side upsert:
    // 1) Mark existing groups for user (fetch ids)
    const { rows: existing } = await query(
      `SELECT id FROM user_watchlist_groups WHERE user_id = $1`,
      [userId]
    );
    const existingIds = new Set(existing.map((r) => r.id));

    // 2) Upsert each group (insert if no id, update if id exists)
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
           WHERE id = $4 AND user_id = $5`,
          [name, JSON.stringify(symbols), position, id, userId]
        );
        existingIds.delete(id);
      } else {
        // insert
        await query(
          `INSERT INTO user_watchlist_groups (user_id, group_name, symbols, position)
           VALUES ($1, $2, $3, $4)`,
          [userId, name, JSON.stringify(symbols), position]
        );
      }
    }

    // 3) Delete any groups that were removed client-side
    if (existingIds.size > 0) {
      const toDelete = Array.from(existingIds);
      await query(
        `DELETE FROM user_watchlist_groups WHERE id = ANY($1::uuid[]) AND user_id = $2`,
        [toDelete, userId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/watchlist/add
 * Add a single symbol to a given group (optional convenience endpoint)
 * Body: { groupId, symbol }
 */
router.post("/add", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    // if group provided, update, else create or append to default group
    if (groupId) {
      const { rows } = await query(
        `SELECT symbols FROM user_watchlist_groups WHERE id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: "group not found" });
      const symbols = Array.isArray(rows[0].symbols) ? rows[0].symbols : [];
      if (!symbols.includes(symbol)) symbols.push(symbol);
      await query(
        `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(symbols), groupId, userId]
      );
      return res.json({ success: true, groupId });
    } else {
      // create default group if missing
      const { rows } = await query(
        `SELECT id, symbols FROM user_watchlist_groups WHERE user_id = $1 ORDER BY position ASC LIMIT 1`,
        [userId]
      );
      if (rows.length === 0) {
        const insert = await query(
          `INSERT INTO user_watchlist_groups (user_id, group_name, symbols, position) VALUES ($1, $2, $3, 0) RETURNING id`,
          [userId, "Default", JSON.stringify([symbol])]
        );
        return res.json({ success: true, groupId: insert.rows[0].id });
      } else {
        const groupId0 = rows[0].id;
        const symbols = Array.isArray(rows[0].symbols) ? rows[0].symbols : [];
        if (!symbols.includes(symbol)) symbols.push(symbol);
        await query(
          `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(symbols), groupId0]
        );
        return res.json({ success: true, groupId: groupId0 });
      }
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/watchlist/remove
 * Body: { groupId, symbol }
 */
router.post("/remove", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, symbol } = req.body;
    if (!groupId || !symbol) return res.status(400).json({ error: "groupId and symbol required" });

    const { rows } = await query(
      `SELECT symbols FROM user_watchlist_groups WHERE id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "group not found" });

    const symbols = Array.isArray(rows[0].symbols) ? rows[0].symbols.filter((s: string) => s !== symbol) : [];
    await query(
      `UPDATE user_watchlist_groups SET symbols = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(symbols), groupId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as watchlistRouter };
