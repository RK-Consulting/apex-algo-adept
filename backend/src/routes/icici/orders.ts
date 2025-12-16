// backend/src/routes/icici/orders.ts
import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import * as OrderService from "../../services/iciciOrderService.js";
import { ICICIOrderController } from '../../controllers/iciciOrderController.js';  // Assume updated
import { authenticateToken } from '../../middleware/auth.js';  // Correct

const router = Router();
const orderController = new ICICIOrderController();

// All order routes protected + rate limited
router.use(authenticateJWT, iciciLimiter);
// Protected Order Routes
router.post('/place', authenticateToken, orderController.placeOrder.bind(orderController));
router.get('/history', authenticateToken, orderController.getOrderHistory.bind(orderController));
router.get('/list', authenticateToken, orderController.getOrders.bind(orderController));
router.get('/detail', authenticateToken, orderController.getOrderDetail.bind(orderController));
router.delete('/cancel', authenticateToken, orderController.cancelOrder.bind(orderController));
router.put('/modify', authenticateToken, orderController.modifyOrder.bind(orderController));


router.post("/place", async (req: any, res) => {
  try {
    const result = await OrderService.placeOrder(req.user.userId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/list", async (req: any, res) => {
  try {
    const { exchangeCode, fromDate, toDate } = req.query;
    const result = await OrderService.getOrders(req.user.userId, exchangeCode as string, fromDate as string, toDate as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/detail/:orderId", async (req: any, res) => {
  try {
    const { exchangeCode } = req.query;
    const result = await OrderService.getOrderDetail(req.user.userId, exchangeCode as string, req.params.orderId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/cancel", async (req: any, res) => {
  try {
    const { exchangeCode, orderId } = req.body;
    const result = await OrderService.cancelOrder(req.user.userId, exchangeCode, orderId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/modify", async (req: any, res) => {
  try {
    const result = await OrderService.modifyOrder(req.user.userId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
