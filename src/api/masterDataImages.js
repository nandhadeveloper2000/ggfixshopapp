/**
 * Resolve image source for master data (brands, models) from API.
 * Prefers base64 when present (no network), else falls back to imageUrl.
 * @param {{ imageBase64?: string | null, imageUrl?: string | null }} item - brand or model from GET /master/brands or /master/brands/:id/models
 * @param {string} [fallbackUrl] - optional fallback when both are missing
 * @returns {{ uri: string } | number} - source for <Image source={...} /> or require() for local
 */
export function getMasterImageSource(item, fallbackUrl) {
  if (!item) return fallbackUrl ? { uri: fallbackUrl } : { uri: '' };
  const b64 = item.imageBase64 && item.imageBase64.trim();
  if (b64) return { uri: `data:image/png;base64,${b64}` };
  const url = item.imageUrl && item.imageUrl.trim();
  if (url) return { uri: url };
  return fallbackUrl ? { uri: fallbackUrl } : { uri: '' };
}
