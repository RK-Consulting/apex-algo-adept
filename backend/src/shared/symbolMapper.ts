// backend/utils/symbolMapper.ts
/**
 * Map user-friendly symbol names to the format Breeze expects.
 * - For indices like NIFTY, BANKNIFTY etc. return index indicator.
 * - For stocks return stock code (e.g., RELIANCE).
 */

export function mapSymbolForBreeze(symbol: string) {
  const s = String(symbol).trim().toUpperCase();

  // Common index mappings — adjust to your Breeze symbols
  const indexMap: Record<string, string> = {
    "NIFTY": "NIFTY 50",
    "NIFTY 50": "NIFTY 50",
    "SENSEX": "SENSEX",
    "BANKNIFTY": "NIFTY BANK",
    "INDIAVIX": "INDIA VIX",
    // add more as needed
  };

  if (indexMap[s]) {
    return { type: "index", payload: indexMap[s] };
  }

  // default: equity stock
  return { type: "stock", payload: s };
}
