// src/types/breezconnect.d.ts
declare module "breezeconnect" {
  /**
   * Official ICICI Breeze SDK (v1.0.29)
   * https://www.npmjs.com/package/breezeconnect
   */
  export class BreezeConnect {
    constructor();

    /** Set API key (appKey) */
    setApiKey(apiKey: string): void;

    /** Generate session using API secret */
    generateSession(apiSecret: string): Promise<any>;

    /** Set cached session token */
    setSessionToken(token: string): void;

    // === Market Data ===
    getQuotes(params?: {
      stockCode?: string;
      exchangeCode?: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): Promise<any>;

    getHistoricalDataV2(params: {
      interval: string;
      fromDate: string;
      toDate: string;
      stockCode: string;
      exchangeCode: string;
      productType?: string;
    }): Promise<any>;

    // === Portfolio ===
    getFunds(): Promise<any>;
    getHoldings(exchangeCode?: string): Promise<any>;
    getPortfolioHoldings(exchangeCode?: string): Promise<any>;
    getPortfolioPositions(): Promise<any>;

    // === Orders ===
    getOrderList(): Promise<any[]>;

    placeOrder(params: {
      stockCode: string;
      exchangeCode: string;
      productType: string;
      action: string;
      orderType: string;
      quantity: string | number;
      price?: string | number;
      validity?: string;
      disclosedQuantity?: string | number;
      stoploss?: string | number;
      triggerPrice?: string | number;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): Promise<any>;

    modifyOrder(params: {
      orderId: string;
      quantity?: string | number;
      price?: string | number;
      validity?: string;
      disclosedQuantity?: string | number;
      stoploss?: string | number;
      triggerPrice?: string | number;
    }): Promise<any>;

    cancelOrder(params: { orderId: string }): Promise<any>;

    // === WebSocket ===
    connect(): void;
    disconnect(): void;

    subscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
      feedType?: string;
    }): void;

    unsubscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): void;

    // Events
    on(event: "message", listener: (data: any) => void): this;
    on(event: "open" | "close" | "error", listener: () => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
  }
}
