// src/routes/icici/portfolio.ts
import { Router } from 'express';
import { breeze } from '../../config/breeze.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

/**
 * GET /api/icici/portfolio/holdings
 * Fetch portfolio holdings (stocks you own)
 */
router.get('/holdings', authenticateToken, async (req, res) => {
  try {
    // FIXED: Pass exchangeCode as STRING, not object
    const data = await breeze.getPortfolioHoldings('NSE');
    
    res.json({ 
      success: true, 
      holdings: data 
    });
  } catch (err: any) {
    console.error('Failed to fetch holdings:', err.message || err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch holdings',
      details: err.message 
    });
  }
});

/**
 * GET /api/icici/portfolio/positions
 * Fetch portfolio positions (open trades)
 */
router.get('/positions', authenticateToken, async (req, res) => {
  try {
    const data = await breeze.getPortfolioPositions();
    
    res.json({ 
      success: true, 
      positions: data 
    });
  } catch (err: any) {
    console.error('Failed to fetch positions:', err.message || err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch positions',
      details: err.message 
    });
  }
});

export { router as portfolioRouter };
