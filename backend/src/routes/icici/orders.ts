// backend/routes/icici/orders.ts
import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";
import { authenticateToken } from "../../middleware/auth.js";
import { checkIciciSession } from "../../middleware/checkIciciSession.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";

router.post("/orders/place",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.placeOrder
);

router.post("/orders/modify",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.modifyOrder
);

router.post("/orders/cancel",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.cancelOrder
);

router.get("/orders",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.orderbook
);

router.get("/portfolio/positions",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.positions
);

router.get("/portfolio/holdings",
  authenticateToken,
  checkIciciSession,
  ICICIOrderController.holdings
);

const router = Router();

export default router;
