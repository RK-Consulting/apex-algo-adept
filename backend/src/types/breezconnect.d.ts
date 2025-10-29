declare module "breezeconnect" {
  export class BreezeConnect {
    constructor();
    generateSession(apiKey: string, apiSecret: string): Promise<any>;
    setToken(token: string): void;
    getProfile(): Promise<any>;
    getQuotes(params?: any): Promise<any>;
    getPortfolioHoldings(): Promise<any>;
    placeOrder(params: any): Promise<any>;
    modifyOrder(params: any): Promise<any>;
    cancelOrder(params: any): Promise<any>;
  }
}
