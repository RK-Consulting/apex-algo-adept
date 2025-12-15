// backend/src/services/iciciOrderService.ts
import {
  placeOrder as breezePlace,
  getOrders as breezeGetOrders,
  getOrderDetail as breezeGetDetail,
  cancelOrder as breezeCancel,
  modifyOrder as breezeModify,
  getPortfolioPositions,
  getPortfolioHoldings,
  getFunds,
  getMargins
} from "../services/breezeClient.js";

export const placeOrder = async (userId: string, orderData: any) => {
  return breezePlace(userId, orderData);
};

export const getOrders = async (userId: string, exchangeCode: string, fromDate: string, toDate: string) => {
  return breezeGetOrders(userId, exchangeCode, fromDate, toDate);
};

export const getOrderDetail = async (userId: string, exchangeCode: string, orderId: string) => {
  return breezeGetDetail(userId, exchangeCode, orderId);
};

export const cancelOrder = async (userId: string, exchangeCode: string, orderId: string) => {
  return breezeCancel(userId, exchangeCode, orderId);
};

export const modifyOrder = async (userId: string, modifyData: any) => {
  return breezeModify(userId, modifyData);
};

export const getPositions = async (userId: string) => {
  return getPortfolioPositions(userId);
};

export const getHoldings = async (userId: string, exchangeCode: string, fromDate?: string, toDate?: string) => {
  return getPortfolioHoldings(userId, exchangeCode, fromDate, toDate);
};

export const getFundsBalance = async (userId: string) => {
  return getFunds(userId);
};

export const getMargin = async (userId: string, exchangeCode: string) => {
  return getMargins(userId, exchangeCode);
};
