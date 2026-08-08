// backend/src/types/breezeconnect.d.ts
declare module "breezeconnect" {
  /**
   * Type definitions for ICICI BreezeConnect SDK (v1.0.32)
   * Updated for latest API behavior and WebSocket feed structure.
   */
  export class BreezeConnect {
    constructor();

    /** Set your Breeze API key (appKey) */
    setApiKey(apiKey: string): void;

    /**
     * Generate session using API secret.
     * Breeze internally generates session_token.
     */
    generateSession(apiSecret: string): Promise<{
      status?: string;
      success?: boolean;
      session_token?: string;
      data?: { session_token?: string };
    }>;

    /** Reuse stored Breeze session token */
    setSessionToken(token: string): void;

    /* ============================================================
       MARKET DATA
    ============================================================ */

    /** Get real-time market quotes */
    getQuotes(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): Promise<{
      success?: boolean;
      data?: Record<string, unknown>;
    }>;

    /** Latest OHLC API */
    getHistoricalDataV2(params: {
      interval: string;
      fromDate: string;
      toDate: string;
      stockCode: string;
      exchangeCode: string;
      productType?: string;
    }): Promise<{
      success?: boolean;
      Success?: unknown[];
      data?: unknown[];
    }>;

    /* ============================================================
       PORTFOLIO
    ============================================================ */

    /** Fetch available funds */
    getFunds(): Promise<Record<string, unknown>>;

    /** Holdings (preferred new API) */
    getPortfolioHoldings(exchangeCode?: string): Promise<Record<string, unknown>[]>;

    /** Fallback older API */
    getHoldings(exchangeCode?: string): Promise<Record<string, unknown>[]>;

    /** Open positions */
    getPortfolioPositions(): Promise<Record<string, unknown>[]>;

    /* ============================================================
       ORDERS
    ============================================================ */

    /** List all recent orders */
    getOrderList(): Promise<Record<string, unknown>[]>;

    /** Place a new order */
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
      userRemark?: string;
    }): Promise<Record<string, unknown>>;

    /** Modify an order */
    modifyOrder(params: {
      orderId: string;
      quantity?: string | number;
      price?: string | number;
      validity?: string;
      disclosedQuantity?: string | number;
      stoploss?: string | number;
      triggerPrice?: string | number;
    }): Promise<Record<string, unknown>>;

    /** Cancel order */
    cancelOrder(params: { orderId: string }): Promise<Record<string, unknown>>;

    /* ============================================================
       WEBSOCKET (REAL-TIME FEED)
    ============================================================ */

    /** Open WebSocket connection */
    connect(): void;

    /** Close WebSocket connection */
    disconnect(): void;

    /**
     * Subscribe to Breeze WebSocket feeds
     * feedType defaults internally (LTP feed)
     */
    subscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
      feedType?: string; // "1" | "2" | "3" depending on feed type
    }): void;

    /** Unsubscribe feed */
    unsubscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): void;

    /* ============================================================
       EVENTS (WebSocket)
    ============================================================ */

    on(event: "message", listener: (data: unknown) => void): this;
    on(event: "open", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (error: unknown) => void): this;

    off(event: string, listener: (...args: unknown[]) => void): this;
  }
}
