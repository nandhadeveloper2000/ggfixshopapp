import { orderApi } from './client';

function unwrap(list) {
  return Array.isArray(list) ? list : (list?.content ?? list?.data ?? []);
}

// Shop-owner notification feed — order-service /shop/notifications, scoped by
// the shopId claim on the JWT (NOT /notifications, which is the customer feed
// and rejects shop tokens because it looks up customer_user_id).
//
// These are non-critical background reads fired on Dashboard mount. order-service
// can return 401 for them even when the session is perfectly valid (auth-service
// and the other services accept the same token). So we pass skipAuthExpiry to
// stop a notifications 401 from wiping the session and bouncing the user back to
// Login. The feed just stays empty instead.
export async function listNotifications() {
  return unwrap(await orderApi.get('/shop/notifications', { skipAuthExpiry: true }));
}
export async function getUnreadCount() {
  const r = await orderApi.get('/shop/notifications/unread-count', { skipAuthExpiry: true });
  return r?.count ?? 0;
}
export async function markNotificationRead(id) {
  return await orderApi.post(`/shop/notifications/${id}/read`);
}
export async function markAllNotificationsRead() {
  return await orderApi.post('/shop/notifications/read-all');
}
