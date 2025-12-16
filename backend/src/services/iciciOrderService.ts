// backend/src/services/iciciOrderService.ts
/**
 * ICICI Order Service - Centralised, typed wrappers for Breeze API order operations
 *
 * Benefits:
 * - Single point for order-related calls
 * - Easy to add logging, validation, metrics, or caching
 * - Type-safe and future-proof
 * - Uses the main breezeRequest gateway for consistency
 */

import { breezeRequest } from "../services/breezeClient.js";

/**
 * Place a new order
 */
export const placeOrder = async (userId: string, orderData: any): Promise<any> => {
  return await breezeRequest(userId, "POST", "/api/v1/order", orderData);
};

/**
 * Get order list (current or historical)
 */
export const getOrders = async (
  userId: string,
  exchangeCode: string,
  fromDate: string,
  toDate: string
): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/order", {
    exchange_code: exchangeCode,
    from_date: fromDate,
    to_date: toDate,
  });
};

/**
 * Get details of a specific order
 */
export const getOrderDetail = async (
  userId: string,
  exchangeCode: string,
  orderId: string
): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/order", {
    exchange_code: exchangeCode,
    order_id: orderId,
  });
};

/**
 * Cancel an existing order
 */
export const cancelOrder = async (
  userId: string,
  exchangeCode: string,
  orderId: string
): Promise<any> => {
  return await breezeRequest(userId, "DELETE", "/api/v1/order", {
    exchange_code: exchangeCode,
    order_id: orderId,
  });
};

/**
 * Modify an existing order
 */
export const modifyOrder = async (userId: string, modifyData: any): Promise<any> => {
  return await breezeRequest(userId, "PUT", "/api/v1/order", modifyData);
};

/**
 * Get current portfolio positions
 */
export const getPositions = async (userId: string): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/portfoliopositions", {});
};

/**
 * Get portfolio holdings
 */
export const getHoldings = async (
  userId: string,
  exchangeCode: string,
  fromDate?: string,
  toDate?: string
): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/portfolioholdings", {
    exchange_code: exchangeCode,
    from_date: fromDate || "",
    to_date: toDate || "",
  });
};

/**
 * Get available funds balance
 */
export const getFundsBalance = async (userId: string): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/funds", {});
};

/**
 * Get margin information
 */
export const getMargin = async (userId: string, exchangeCode: string): Promise<any> => {
  return await breezeRequest(userId, "GET", "/api/v1/margin", {
    exchange_code: exchangeCode,
  });
};
