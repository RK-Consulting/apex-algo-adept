// backend/src/routes/icici/orders.ts

import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";

const router = Router();

// Order operations
router.post("/place", authenticateToken, ICICIOrderController.placeOrder);
router.post("/modify", authenticateToken, ICICIOrderController.modifyOrder);
router.post("/cancel", authenticateToken, ICICIOrderController.cancelOrder);

// Fetch orders
router.get("/orders", authenticateToken, ICICIOrderController.orderbook);

// Portfolio
router.get("/positions", authenticateToken, ICICIOrderController.positions);
router.get("/holdings", authenticateToken, ICICIOrderController.holdings);

export const iciciOrderRoutes = router;
export default router;
