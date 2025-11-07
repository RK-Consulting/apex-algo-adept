// src/routes/icici/orders.ts
import { Router } from 'express';
import { breeze } from '../../config/breeze.js';
import { authenticateToken, AuthRequest } from '../../middleware/auth.js';

const router = Router();

/**
 * POST /api/icici/orders/order
 * Place a new order
 */
router.post('/order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      stockCode,
      exchangeCode = 'NSE',
      productType = 'cash',   // 'product' → 'productType'
      action = 'buy',
      orderType = 'market',
      quantity = '1',
      price = '',
      validity = 'day',
    } = req.body;

    if (!stockCode) {
      return res.status(400).json({ error: 'stockCode is required' });
    }

    const order = await breeze.placeOrder({
      stockCode,
      exchangeCode,
      productType,           // Correct field name
      action,
      orderType,
      quantity,
      price: price || undefined,
      validity,
      //validityDate: new Date().toISOString(),
      //userRemark: 'AlphaForge Order',
    });

    res.json({ success: true, order });
  } catch (err: any) {
    console.error('Order placement failed:', err.message || err);
    res.status(500).json({ error: 'Order placement failed', details: err.message });
  }
});

/**
 * GET /api/icici/orders/orders
 * Get recent order history (last 7 days)
 */
router.get('/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // getOrderList() takes NO arguments
    const orders = await breeze.getOrderList();

    // Filter locally for last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentOrders = orders.filter((order: any) => {
      const orderTime = new Date(order.order_date || order.transaction_time).getTime();
      return orderTime >= sevenDaysAgo;
    });

    res.json({ success: true, orders: recentOrders });
  } catch (err: any) {
    console.error('Failed to fetch orders:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

export { router as orderRouter };
