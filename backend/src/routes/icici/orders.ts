// backend/src/routes/icici/orders.ts

import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";

const router = Router();

// ----- Orders -----
router.post("/place", authenticateToken, ICICIOrderController.placeOrder);

router.post("/modify", authenticateToken, ICICIOrderController.modifyOrder);

router.post("/cancel", authenticateToken, ICICIOrderController.cancelOrder);

router.get("/orders", authenticateToken, ICICIOrderController.getOrderBook);

// ----- Portfolio -----
router.get("/positions", authenticateToken, ICICIOrderController.getPositions);

router.get("/holdings", authenticateToken, ICICIOrderController.getHoldings);

export const iciciOrderRoutes = router;
export default router;
