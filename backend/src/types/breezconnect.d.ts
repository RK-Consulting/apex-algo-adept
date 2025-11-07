declare module "breezeconnect" {
  /**
   * Main BreezeConnect class
   * Official SDK: https://www.npmjs.com/package/breezeconnect
   */
  export class BreezeConnect {
    /** Create a new instance. No arguments required. */
    constructor();

    /**
     * Set the API key (appKey) before generating session.
     * @param apiKey Your ICICI Breeze API Key
     */
    setApiKey(apiKey: string): void;

    /**
     * Generate a session token.
     * @param apiSecret Your API Secret (not the session token)
     * @returns Session response with `session_token`
     */
    generateSession(apiSecret: string): Promise<{
      Success: {
        session_token: string;
        user_id: string;
      };
    }>;

    /**
     * Set an already-generated session token (optional, if you cached it).
     */
    setSessionToken(token: string): void;

    /** Get customer profile */
    getCustomerProfile(): Promise<any>;

    /** Get live quotes */
    getQuotes(params?: {
      stockCode?: string;
      exchangeCode?: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): Promise<any>;

    /** Get portfolio holdings */
    getPortfolioHoldings(exchangeCode?: string): Promise<any>;

    /** Get portfolio positions */
    getPortfolioPositions(): Promise<any>;

    /** Get order list */
    getOrderList(): Promise<any>;

    /** Get historical data (v2) */
    getHistoricalDataV2(params: {
      interval: string;
      fromDate: string;
      toDate: string;
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): Promise<any>;

    /** Get funds / margin details */
    getFunds(): Promise<any>;

    /** Get holdings (alias for getPortfolioHoldings) */
    getHoldings(exchangeCode?: string): Promise<any>;

    /** Place order */
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

    /** Modify existing order */
    modifyOrder(params: {
      orderId: string;
      quantity?: string | number;
      price?: string | number;
      validity?: string;
      disclosedQuantity?: string | number;
      stoploss?: string | number;
      triggerPrice?: string | number;
    }): Promise<any>;

    /** Cancel order */
    cancelOrder(params: { orderId: string }): Promise<any>;

    /* WebSocket Methods */

    /** Connect to WebSocket */
    connect(): void;

    /** Disconnect WebSocket */
    disconnect(): void;

    /** Subscribe to market data */
    subscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
      feedType?: string;
    }): void;

    /** Unsubscribe */
    unsubscribeFeeds(params: {
      stockCode: string;
      exchangeCode: string;
      productType?: string;
      expiryDate?: string;
      right?: string;
      strikePrice?: string;
    }): void;

    /** Event: 'message' - receives real-time ticks */
    on(event: 'message', listener: (data: any) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: any) => void): this;

    /** Remove listener */
    off(event: string, listener: (...args: any[]) => void): this;
  }
}



//old breeze SDK
//declare module "breezeconnect" {
  //export class BreezeConnect {
    //constructor();
    //generateSession(apiKey: string, apiSecret: string): Promise<any>;
    //setToken(token: string): void;
    //getProfile(): Promise<any>;
    //getQuotes(params?: any): Promise<any>;
    //getPortfolioHoldings(): Promise<any>;
    //getOrderList(): Promise<any>;
    //placeOrder(params: any): Promise<any>;
    //modifyOrder(params: any): Promise<any>;
    //cancelOrder(params: any): Promise<any>;
  //}
//}

