// backend/src/services/iciciOrderService.ts
/**
 * ICICI Order Service - Thin wrappers around BreezeClient functions
 * 
 * Purpose:
 * - Centralize all order-related Breeze API calls
 * - Provide clean, typed interface for controllers
 * - Allow future enhancements (logging, metrics, validation) in one place
 * 
 * All functions are named exports → imported as namespace in controllers
 */

import {
  placeOrder as breezePlace,
  getOrders as breezeGetOrders,
  getOrderDetail as breezeGetDetail,
  cancelOrder as breezeCancel,
  modifyOrder as breezeModify,
  getPortfolioPositions,
  getPortfolioHoldings,
  getFunds,
  getMargins,
} from "../services/breezeClient.js";

/**
 * Place a new order
 */
export const placeOrder = async (userId: string, orderData: any): Promise<any> => {
  return await breezePlace(userId, orderData);
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
  return await breezeGetOrders(userId, exchangeCode, fromDate, toDate);
};

/**
 * Get details of a specific order
 */
export const getOrderDetail = async (
  userId: string,
  exchangeCode: string,
  orderId: string
): Promise<any> => {
  return await breezeGetDetail(userId, exchangeCode, orderId);
};

/**
 * Cancel an existing order
 */
export const cancelOrder = async (
  userId: string,
  exchangeCode: string,
  orderId: string
): Promise<any> => {
  return await breezeCancel(userId, exchangeCode, orderId);
};

/**
 * Modify an existing order
 */
export const modifyOrder = async (userId: string, modifyData: any): Promise<any> => {
  return await breezeModify(userId, modifyData);
};

/**
 * Get current portfolio positions
 */
export const getPositions = async (userId: string): Promise<any> => {
  return await getPortfolioPositions(userId);
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
  return await getPortfolioHoldings(userId, exchangeCode, fromDate, toDate);
};

/**
 * Get available funds balance
 */
export const getFundsBalance = async (userId: string): Promise<any> => {
  return await getFunds(userId);
};

/**
 * Get margin information
 */
export const getMargin = async (userId: string, exchangeCode: string): Promise<any> => {
  return await getMargins(userId, exchangeCode);
};
