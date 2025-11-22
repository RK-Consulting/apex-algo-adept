// backend/src/routes/icici.ts
/**
 * Single ICICI router aggregator.
 * Mount this at /api/icici in your app.
 *
 * It composes:
 *  - /broker      -> iciciBrokerRouter (store/retrieve/complete)
 *  - /stream      -> iciciStreamControlRouter (subscribe/unsubscribe)
 *  - /status      -> icici/status.ts (simple connection status)
 */

import { Router } from "express";
import { iciciBrokerRouter } from "./iciciBroker.js";
import { iciciStreamControlRouter } from "./iciciStreamControlRouter.js";
import { iciciStatusRouter } from "./icici/status.js";

const router = Router();

router.use("/broker", iciciBrokerRouter);
router.use("/stream", iciciStreamControlRouter);
router.use("/", iciciStatusRouter);

export { router as iciciRouter };
