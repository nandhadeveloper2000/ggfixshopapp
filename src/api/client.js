import { Platform } from 'react-native';
import {
  AUTH_BASE,
  MASTER_BASE,
  TICKET_BASE,
  TECHNICIAN_BASE,
  SHOP_BASE,
  INVENTORY_BASE,
  MARKETPLACE_BASE,
  PICKUP_BASE,
  ORDER_BASE,
  USER_BASE,
} from './config';
import { getToken, clearSession, notifyAuthExpired } from '../auth/session';

async function request(baseUrlOrNull, method, path, { query, body, headers, skipAuthExpiry } = {}) {
  let base = baseUrlOrNull && typeof baseUrlOrNull === 'string' ? baseUrlOrNull.trim() : '';
  if (!base || !base.startsWith('http')) base = AUTH_BASE;
  else if (!base.endsWith('/')) base = base + '/';
  const url = new URL(path, base);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const token = await getToken();
  const urlString = url.toString();
  let res;
  try {
    res = await fetch(urlString, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const baseHint =
      baseUrlOrNull && typeof baseUrlOrNull === 'string' && baseUrlOrNull.includes('localhost')
        ? ' (note: localhost on a phone means the phone itself)'
        : '';
    const msg = e?.message || 'Network request failed';
    const err = new Error(`Network request failed${baseHint}. URL: ${urlString}. ${msg}`);
    err.status = 0;
    throw err;
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    // Only 401 means the bearer token is missing/invalid/expired. A 403 is a
    // real authorization failure for that resource and should not clear the
    // session or cause repeated login/retry churn.
    if (res.status === 401 && token && !skipAuthExpiry) {
      await clearSession();
      notifyAuthExpired();
    }
    const message = res.status === 401 && token
      ? 'Your session has expired. Please log in again.'
      : (json && (json.message || json.error)) || text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

// Multipart file upload. Does NOT set Content-Type so fetch can add the
// multipart boundary itself. `file` is an expo-image-picker asset { uri }.
async function uploadRequest(baseUrlOrNull, path, { uri, name, type, fields } = {}) {
  let base = baseUrlOrNull && typeof baseUrlOrNull === 'string' ? baseUrlOrNull.trim() : '';
  if (!base || !base.startsWith('http')) base = AUTH_BASE;
  else if (!base.endsWith('/')) base = base + '/';
  const urlString = new URL(path, base).toString();

  const form = new FormData();
  const filename = name || 'upload.jpg';
  if (Platform.OS === 'web') {
    // On web the picker gives a blob:/data: URI — fetch it into a real Blob so
    // FormData produces a valid multipart body (RN's { uri } shape is native-only).
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, filename);
  } else {
    form.append('file', { uri, name: filename, type: type || 'image/jpeg' });
  }
  if (fields) Object.entries(fields).forEach(([k, v]) => { if (v != null) form.append(k, String(v)); });

  const token = await getToken();
  let res;
  try {
    res = await fetch(urlString, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
  } catch (e) {
    const err = new Error(`Upload failed. URL: ${urlString}. ${e?.message || 'Network request failed'}`);
    err.status = 0;
    throw err;
  }

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    if (res.status === 401 && token) { await clearSession(); notifyAuthExpired(); }
    const message = (json && (json.message || json.error)) || text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return json;
}

function createClient(baseUrl) {
  return {
    get: (path, opts) => request(baseUrl, 'GET', path, opts),
    post: (path, opts) => request(baseUrl, 'POST', path, opts),
    put: (path, opts) => request(baseUrl, 'PUT', path, opts),
    patch: (path, opts) => request(baseUrl, 'PATCH', path, opts),
    del: (path, opts) => request(baseUrl, 'DELETE', path, opts),
    upload: (path, opts) => uploadRequest(baseUrl, path, opts),
  };
}

export const authApi = createClient(AUTH_BASE);
export const masterApi = createClient(MASTER_BASE);
export const ticketApi = createClient(TICKET_BASE);
export const technicianApi = createClient(TECHNICIAN_BASE);
export const shopApi = createClient(SHOP_BASE);
export const inventoryApi = createClient(INVENTORY_BASE);
export const marketplaceApi = createClient(MARKETPLACE_BASE);
export const pickupApi = createClient(PICKUP_BASE);
export const orderApi = createClient(ORDER_BASE);
export const userApi = createClient(USER_BASE);
