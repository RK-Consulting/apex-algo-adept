import { Router } from 'express';
import { breeze } from '../../config/breeze.js';
import { authenticateToken, AuthRequest } from '../../middleware/auth.js';

const router = Router();

router.post('/order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const order = await breeze.placeOrder({
      stockCode: req.body.stockCode,
      exchangeCode: req.body.exchangeCode || 'NSE',
      product: req.body.product || 'cash',
      action: req.body.action || 'buy',
      orderType: req.body.orderType || 'market',
      quantity: req.body.quantity || '1',
      price: req.body.price || '',
      validity: 'day',
    });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Order placement failed' });
  }
});

router.get('/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orders = await breeze.getOrderList({
      exchangeCode: 'NSE',
      fromDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      toDate: new Date().toISOString(),
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export { router as orderRouter };
