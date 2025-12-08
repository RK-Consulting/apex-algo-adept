// backend/routes/icici/orders.ts
import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";

const router = Router();

router.post("/orders/place", authenticateToken, ICICIOrderController.placeOrder);
router.post("/orders/modify", authenticateToken, ICICIOrderController.modifyOrder);
router.post("/orders/cancel", authenticateToken, ICICIOrderController.cancelOrder);

router.get("/orders", authenticateToken, ICICIOrderController.orderbook);
router.get("/portfolio/positions", authenticateToken, ICICIOrderController.positions);
router.get("/portfolio/holdings", authenticateToken, ICICIOrderController.holdings);

export default router;
