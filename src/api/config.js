const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';

function baseUrl(port) {
  return `http://${host}:${port}/`;
}

// Prefer an explicit per-service base from .env (EXPO_PUBLIC_*_BASE, e.g. the
// live EC2 deployment). Falls back to EXPO_PUBLIC_API_HOST + the fixed port for
// local dev. Trailing slash is normalized so `new URL(path, base)` resolves right.
function svc(envValue, port) {
  const v = typeof envValue === 'string' ? envValue.trim() : '';
  if (v) return v.endsWith('/') ? v : `${v}/`;
  return baseUrl(port);
}

export const API_BASE_URL      = baseUrl(8080);
export const AUTH_BASE         = svc(process.env.EXPO_PUBLIC_AUTH_BASE, 8081);
export const TICKET_BASE       = svc(process.env.EXPO_PUBLIC_TICKET_BASE, 8082);
export const USER_BASE         = svc(process.env.EXPO_PUBLIC_USER_BASE, 8083);
export const SHOP_BASE         = svc(process.env.EXPO_PUBLIC_SHOP_BASE, 8084);
export const TECHNICIAN_BASE   = svc(process.env.EXPO_PUBLIC_TECHNICIAN_BASE, 8085);
export const INVENTORY_BASE    = svc(process.env.EXPO_PUBLIC_INVENTORY_BASE, 8086);
export const MARKETPLACE_BASE  = svc(process.env.EXPO_PUBLIC_MARKETPLACE_BASE, 8087);
export const PICKUP_BASE       = svc(process.env.EXPO_PUBLIC_PICKUP_BASE, 8088);
export const NOTIFICATION_BASE = svc(process.env.EXPO_PUBLIC_NOTIFICATION_BASE, 8089);
export const SUBSCRIPTION_BASE = svc(process.env.EXPO_PUBLIC_SUBSCRIPTION_BASE, 8090);
export const MASTER_BASE       = svc(process.env.EXPO_PUBLIC_MASTER_DATA_BASE, 8091);
export const ORDER_BASE        = svc(process.env.EXPO_PUBLIC_ORDER_BASE, 8092);
