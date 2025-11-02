import { Router } from 'express';
import { breeze } from '../../config/breeze.js';
import { pool } from '../../config/database.js';

const router = Router();

router.get('/subscribe', async (req, res) => {
  try {
    breeze.wsConnect();

    breeze.on(async (tick: any) => {
      const data = tick.data || tick;
      await pool.query(
        `INSERT INTO market_ticks(symbol, exchange, last_price, open, high, low, volume, timestamp)
         VALUES($1,$2,$3,$4,$5,$6,$7, NOW())`,
        [
          data.stock_code || data.symbol,
          data.exchange_code || 'NSE',
          data.ltp || data.last_price,
          data.open,
          data.high,
          data.low,
          data.ttq || data.volume,
        ]
      );
    });

    await breeze.subscribeFeeds({ exchangeCode: 'NSE', stockCode: 'RELIANCE' });
    res.json({ success: true, message: 'Subscribed to live feed for RELIANCE' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.get('/quotes/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const resp = await breeze.getQuotes({
      stockCode: symbol,
      exchangeCode: 'NSE',
      productType: 'cash',
    });
    res.json(resp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Quote fetch failed' });
  }
});

export { router as marketRouter };
