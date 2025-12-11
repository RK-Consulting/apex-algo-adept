// backend/src/services/iciciOrderService.ts
import { getBreezeInstance } from "../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:orders");

interface OrderParams {
  stock_code: string;
  exchange_code: string;
  product: string;
  action: string;
  order_type: string;
  quantity: string;
  price: string;
  validity: string;
  [key: string]: string;
}

export class ICICIOrderService {
  static async placeOrder(userId: string, params: OrderParams) {
    try {
      const breeze = await getBreezeInstance(userId);
      const data = await breeze.placeOrder(params);
      return data;
    } catch (err: any) {
      log("Place order error for %s: %O", userId, err);
      throw err;
    }
  }

  // Similar for modifyOrder, cancelOrder, etc. (add as needed)

  static async getOrderBook(userId: string) {
    const breeze = await getBreezeInstance(userId);
    return await breeze.getOrderBook();
  }

  static async getPositions(userId: string) {
    const breeze = await getBreezeInstance(userId);
    return await breeze.getPositions();
  }

  static async getHoldings(userId: string) {
    const breeze = await getBreezeInstance(userId);
    return await breeze.getHoldings();
  }
}
