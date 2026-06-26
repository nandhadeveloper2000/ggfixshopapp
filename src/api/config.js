const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';

function baseUrl(port) {
  return `http://${host}:${port}/`;
}

export const API_BASE_URL = baseUrl(8080);
export const AUTH_BASE    = baseUrl(8081);
export const TICKET_BASE  = baseUrl(8082);
export const USER_BASE    = baseUrl(8083);
export const SHOP_BASE    = baseUrl(8084);
export const TECHNICIAN_BASE = baseUrl(8085);
export const INVENTORY_BASE  = baseUrl(8086);
export const MARKETPLACE_BASE = baseUrl(8087);
export const PICKUP_BASE  = baseUrl(8088);
export const MASTER_BASE  = baseUrl(8091);
export const ORDER_BASE   = baseUrl(8092);
