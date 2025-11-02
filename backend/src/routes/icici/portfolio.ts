import { Router } from 'express';
import { breeze } from '../../config/breeze.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.get('/holdings', authenticateToken, async (req, res) => {
  try {
    const data = await breeze.getPortfolioHoldings({ exchangeCode: 'NSE' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

router.get('/positions', authenticateToken, async (req, res) => {
  try {
    const data = await breeze.getPortfolioPositions();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

export { router as portfolioRouter };
