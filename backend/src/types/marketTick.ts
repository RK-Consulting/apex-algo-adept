// backend/src/types/marketTick.ts
export interface MarketTick {
  symbol: string;
  ltp: number;
  timestamp?: string;
  [key: string]: any;
}
