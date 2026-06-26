import { shopApi, authApi } from './client';

function unwrap(list) {
  return Array.isArray(list) ? list : (list?.content ?? list?.data ?? []);
}

export async function listShops(q) {
  return unwrap(await shopApi.get('/shops', { query: q ? { q } : undefined }));
}

/**
 * Pickup-enabled shops within {radiusKm} of (lat,lng). Reads live data from
 * auth-service's Postgres (the source of truth for shop coords / pickup
 * windows) instead of shop-service which still runs its own in-memory H2 in
 * dev. Public endpoint — no auth header needed.
 *
 * If lat/lng are missing we just return [] (caller should request GPS first).
 */
export async function listNearbyShops({ lat, lng, radiusKm } = {}) {
  if (lat == null || lng == null) return [];
  return unwrap(await authApi.get('/auth/shops/pickup-nearby', { query: { lat, lng, radiusKm } }));
}
/**
 * Public shop detail. Reads from auth-service Postgres (same source as the
 * pickup-nearby feed) — shop-service still runs an isolated H2 in dev that
 * doesn't know about owner-created shops. When (lat,lng) are provided, the
 * server also returns distanceKm.
 */
export async function getShop(id, { lat, lng } = {}) {
  const query = lat != null && lng != null ? { lat, lng } : undefined;
  return await authApi.get(`/auth/shops/${id}/public`, { query });
}
export async function getShopBySlug(slug) {
  return await shopApi.get(`/shops/by-slug/${slug}`);
}
export async function getShopPickupSlots(id) {
  return unwrap(await shopApi.get(`/shops/${id}/pickup-slots`));
}

// ---- Owner pickup slot management ----
// Per-day capacity slots backed by shop_pickup_slots.
// dayOfWeek follows ISO-8601 (1=Mon..7=Sun); null = "any day".
// Backend validates start<end and rejects overlapping slots for the same day.
export async function addShopPickupSlot(shopId, slot) {
  return await shopApi.post(`/shops/${shopId}/pickup-slots`, { body: slot });
}
export async function updateShopPickupSlot(shopId, slotId, slot) {
  return await shopApi.put(`/shops/${shopId}/pickup-slots/${slotId}`, { body: slot });
}
export async function deleteShopPickupSlot(shopId, slotId) {
  return await shopApi.del(`/shops/${shopId}/pickup-slots/${slotId}`);
}

// ---- Shop KYC documents ----
// Backed by shop-service /shops/{shopId}/kyc-documents
// (entity: shop_kyc_documents, migration 33).
export async function listShopKycDocuments(shopId) {
  return unwrap(await shopApi.get(`/shops/${shopId}/kyc-documents`));
}
export async function saveShopKycDocuments(shopId, documents) {
  return await shopApi.post(`/shops/${shopId}/kyc-documents`, { body: { documents } });
}
export async function deleteShopKycDocument(shopId, docType) {
  return await shopApi.del(`/shops/${shopId}/kyc-documents/${encodeURIComponent(docType)}`);
}
