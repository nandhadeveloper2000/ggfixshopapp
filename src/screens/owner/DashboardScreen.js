import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PlusCircle,
  Plus,
  Receipt,
  BarChart3,
  Users,
  PackageCheck,
  Truck,
  Clock,
  Bell,
  ChevronRight,
  ShieldCheck,
  Store,
  X,
  Check,
  Search,
  Mic,
  MessageCircle,
  FileText,
  Smartphone,
  User,
  QrCode,
  Package,
  CalendarClock,
  LogOut,
  ShoppingCart,
  PackageOpen,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { getDeviceCategories, getModelsByBrand } from '../../api/masterData';
import { listShopRepairBookings } from '../../api/orders';
import { listShopKycDocuments } from '../../api/shops';
import { getUnreadCount as getNotifUnreadCount } from '../../api/notifications';
import { Loader, SectionHeader } from '../../components/rnr';
import { getSession } from '../../auth/session';
import { fetchMe, switchShop } from '../../api/auth';

// Swiggy / Zomato green palette — shared with Sell, Buy, Billing & AllBooking
// so every owner-side tab speaks the same visual language.
const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';
const HERO_IMAGE = 'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1784700061/hero_z8j4sg.png';

// On regaining focus we refresh the Latest Bookings list silently, but only if
// the cached data is older than this. Stops Home from visibly re-loading every
// single time you return to it (e.g. right after the booking → assign flow).
const HOME_REFRESH_STALE_MS = 15000;


function useBookingCounts() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketApi.get('/tickets/counts');
      setCounts(data || {});
    } catch (e) {
      setError(e.message || 'Failed to load counts');
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = counts
    ? {
        serviceAccepted: Number(counts.CREATED ?? 0),
        technicianAssigned: Number(counts.assignedCount ?? 0),
        inServiceProcess: Number(counts.IN_DIAGNOSIS ?? 0) + Number(counts.IN_REPAIR ?? 0),
        workCompleted: Number(counts.READY ?? 0),
        outForDelivery: Number(counts.DELIVERED_PROCESSING ?? 0),
        delivered: Number(counts.DELIVERED ?? 0),
        workPending: Number(counts.QUOTED ?? 0) + Number(counts.APPROVED ?? 0),
        total: Number(counts.total ?? 0),
        revenue: Number(counts.revenue ?? counts.totalRevenue ?? counts.monthlyRevenue ?? 0),
      }
    : null;

  return { summary, loading, error, refresh: load };
}

const QUICK_ACTIONS = [
  { key: 'RepairServiceBookingShop', label: 'New Booking',  icon: PlusCircle,    via: 'parent' },
  { key: 'OwnerPickupServiceList',  label: 'Pickup',        icon: Truck,         via: 'parent' },
  { key: 'Bookings',                label: 'All Bookings',  icon: PackageCheck },
  { key: 'Billing',                 label: 'Invoices',      icon: Receipt },
  { key: 'OwnerSearch',             label: 'Customers',      icon: Users,         via: 'parent' },
  { key: 'ShopChatInbox',           label: 'Enquiry',        icon: MessageCircle, via: 'parent' },
  { key: 'BookingStatus',           label: 'Booking Status', icon: BarChart3 },
];

// Emoji fallbacks for the category rails — mirrors the customer app's category
// styling so both stores read the same. Used when a category has no image_url.
const BUY_CAT_META = {
  MOBILE:        { emoji: '📱' },
  SMARTPHONE:    { emoji: '📱' },
  LAPTOP:        { emoji: '💻' },
  SMARTWATCH:    { emoji: '⌚' },
  SMARTWATCHES:  { emoji: '⌚' },
  TABLET:        { emoji: '📲' },
  AUDIO:         { emoji: '🎧' },
  AUDIO_DEVICES: { emoji: '🎧' },
};
const BUY_CAT_DEFAULT = { emoji: '📦' };

function buyCatImage(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// Account sidebar menu (opened from the header avatar) — mirrors the My
// Account screen's profile list. KYC routes to View/Intro based on submission.
const ACCOUNT_MENU = [
  { route: 'OwnerPersonalInfo',  label: 'Personal Information',   sub: 'Name, mobile, email',       icon: User },
  { route: 'OwnerQrCode',        label: 'My QR Code',             sub: 'Share your shop',           icon: QrCode },
  { route: 'OwnerShopInfo',      label: 'Shop Information',        sub: 'Address, hours, GST',       icon: Store },
  { route: 'KYC',                label: 'KYC Documents',          sub: 'Aadhar, PAN, GST / Udyam',  icon: FileText },
  { route: 'OwnerPickupSlots',   label: 'Service Pickup Options', sub: 'Slot timings & zones',      icon: Truck },
  { route: 'MarketplaceOrders',  label: 'My Orders',              sub: 'Marketplace purchases',     icon: Package },
  { route: 'OwnerCart',          label: 'My Cart',                sub: 'Items in your cart',        icon: ShoppingCart },
  { route: 'OwnerEmployeeList',  label: 'Employee Management',     sub: 'Add, edit & track team',    icon: Users },
  { route: 'OwnerLeaveRequests', label: 'Leave Requests',         sub: 'Approve or reject leave',   icon: CalendarClock },
];

// ── Latest Bookings: group by calendar day, current date first ──────────
function dayLabel(date) {
  if (!date) return 'Earlier';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function groupBookingsByDay(list) {
  const groups = new Map();
  for (const t of list) {
    const d = t.createdAt ? new Date(t.createdAt) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'unknown';
    if (!groups.has(key)) groups.set(key, { key, date: d, items: [] });
    groups.get(key).items.push(t);
  }
  const arr = Array.from(groups.values());
  arr.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  arr.forEach((g) => g.items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  return arr;
}

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function shopInitial(name) {
  if (!name) return 'G';
  const letters = String(name).trim().split(/\s+/).map((w) => w[0]).join('');
  return letters.slice(0, 2).toUpperCase() || 'G';
}

export default function DashboardScreen({ navigation, onLogout }) {
  const { summary, loading, error, refresh } = useBookingCounts();
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState(null);
  const [showShopList, setShowShopList] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [buyCats, setBuyCats] = useState([]);
  const [latest, setLatest] = useState([]);
  const [pickupCount, setPickupCount] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarRendered, setSidebarRendered] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [hasKycDocs, setHasKycDocs] = useState(false);
  // Timestamp of the last Latest-Bookings load + an in-flight guard, used to
  // throttle/dedupe the on-focus refresh so returning to Home doesn't
  // refetch/flicker on every focus (or double-load with the mount effect).
  const latestLoadedAtRef = useRef(0);
  const latestLoadingRef = useRef(false);

  // ── Responsive layout system ─────────────────────────────────────────────
  // Every size below scales off the live window width, so the dashboard reads
  // well from a 320px phone up to a tablet instead of hard-coding pixels.
  const { width: winW } = useWindowDimensions();
  const isSmall  = winW < 360;
  const isTablet = winW >= 680;
  const PAGE_PAD = isSmall ? 14 : 18;              // page side gutter
  const contentW = winW - PAGE_PAD * 2;            // usable content width

  // Snapshot: all 5 cards on a single compact row. Floor the width so rounding
  // never wraps the last card onto a new line.
  const statCols   = 5;
  const statGap    = 6;
  const statCardW  = Math.floor((contentW - statGap * (statCols - 1)) / statCols);
  const statValueF = isTablet ? 15 : isSmall ? 11 : 12.5;

  // Quick actions: 4 across on phones, 8 on tablets.
  const qaCols  = isTablet ? 8 : 4;
  const qaIcon  = isSmall ? 46 : 52;
  const qaGlyph = isSmall ? 22 : 24;

  // Category rail tiles (Marketplace / Sell).
  const catTile = isSmall ? 68 : 74;
  const catIcon = isSmall ? 56 : 62;

  // Latest-booking cards.
  const bookingCardW = isSmall ? 150 : 160;

  const panelW = Math.min(360, winW * 0.82);

  // Shared elevation presets — keeps the shadow language consistent.
  const cardShadow = { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
  const heroShadow = { shadowColor: GREEN, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 };

  // Slide the sidebar drawer in from the left; keep it mounted through the
  // slide-out so the close animation plays before unmount.
  useEffect(() => {
    if (showSidebar) {
      setSidebarRendered(true);
      Animated.timing(slideAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setSidebarRendered(false);
      });
    }
  }, [showSidebar]);

  // Poll the shop-side notification feed for the Bell badge + modal contents.
  // Same cadence as the chat poll so a new booking lights up the bell without
  // the owner refreshing manually.
  const refreshNotifs = useCallback(async () => {
    try {
      const count = await getNotifUnreadCount().catch(() => 0);
      setNotifUnread(Number(count) || 0);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => { if (!cancelled) await refreshNotifs(); };
    tick();
    const id = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshNotifs]);

  // Latest Bookings — most recent tickets, enriched with the model's catalog
  // image (same trick as BookingHistoryScreen), grouped by day with today first.
  const loadLatest = useCallback(async () => {
    if (latestLoadingRef.current) return; // dedupe overlapping loads (mount + first focus)
    latestLoadingRef.current = true;
    try {
      const data = await ticketApi.get('/tickets', { query: { page: 0, size: 20 } });
      const content = Array.isArray(data) ? data : data?.content ?? data?.data ?? [];
      const brandIds = Array.from(new Set(content.map((t) => t.brandId).filter(Boolean)));
      const modelById = {};
      if (brandIds.length) {
        await Promise.all(brandIds.map(async (bId) => {
          try { (await getModelsByBrand(bId) || []).forEach((m) => { modelById[m.id] = m; }); } catch {}
        }));
      }
      const enriched = content.map((t) => {
        const m = t.modelId ? modelById[t.modelId] : null;
        const modelUrl = m?.imageUrl || (m?.imageBase64 ? `data:image/png;base64,${m.imageBase64}` : null);
        return {
          ...t,
          _modelImage: t.deviceImageUrl || modelUrl || null,
          _modelName: m?.name || t.deviceDisplayName || t.modelName || null,
        };
      });
      enriched.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      // Dashboard shows only the newest handful; "View all" jumps to the full
      // Bookings screen for the rest.
      setLatest(groupBookingsByDay(enriched.slice(0, 6)));
    } catch {
      // Keep the cached list on a background refresh failure — don't blank the
      // screen (that reads as a jarring reload).
    } finally {
      latestLoadedAtRef.current = Date.now();
      latestLoadingRef.current = false;
    }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // Pickup snapshot count — repair pickups live in order-service repair_bookings
  // (serviceMode === 'PICKUP'), not in /tickets/counts, so fetch them here.
  const loadPickups = useCallback(async () => {
    try {
      const data = await listShopRepairBookings();
      const n = (Array.isArray(data) ? data : []).filter((b) => b.serviceMode === 'PICKUP').length;
      setPickupCount(n);
    } catch {}
  }, []);

  useEffect(() => { loadPickups(); }, [loadPickups]);

  // Refresh the bell badge whenever the dashboard regains focus. The heavier
  // bookings-list refetch is throttled + silent (no loader, no blanking) so
  // returning to Home — e.g. right after the booking/assign flow — doesn't
  // visibly reload. The mount load above stamps the timestamp, so the first
  // focus (fired right after mount) is skipped instead of double-loading.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      refreshNotifs();
      loadPickups();
      if (Date.now() - latestLoadedAtRef.current > HOME_REFRESH_STALE_MS) loadLatest();
    });
    return unsub;
  }, [navigation, refreshNotifs, loadLatest, loadPickups]);

  const reloadSession = useCallback(async () => {
    try { setSession(await fetchMe()); }
    catch { try { setSession(await getSession()); } catch { setSession(null); } }
  }, []);

  useEffect(() => { reloadSession(); }, [reloadSession]);

  // Category rail — same source as the customer app's Buy home so the owner
  // browses the marketplace by the same category set. Silent on failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getDeviceCategories();
        // Fixed display order: Mobile → Laptop → Tablet → Smartwatches → Audio Device.
        // Unknown categories fall to the end (keeping their API order among them).
        const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatches', 'audio device'];
        const rank = (c) => {
          const i = ORDER.indexOf((c.name || '').trim().toLowerCase());
          return i === -1 ? ORDER.length : i;
        };
        if (!cancelled) {
          setBuyCats(
            (list || [])
              .filter((c) => c.isActive !== false)
              .sort((a, b) => rank(a) - rank(b)),
          );
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // When the sidebar opens, resolve KYC submission status so that row routes to
  // View (already uploaded) vs Intro (first time), matching My Account.
  useEffect(() => {
    if (!showSidebar) return;
    const sid = session?.shopId;
    if (!sid) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listShopKycDocuments(sid);
        if (!cancelled) setHasKycDocs(Array.isArray(list) && list.length > 0);
      } catch { if (!cancelled) setHasKycDocs(false); }
    })();
    return () => { cancelled = true; };
  }, [showSidebar, session?.shopId]);

  const shopName = session?.shopName || (session?.shops?.find?.((s) => s.isActive)?.name) || 'Shop · Owner';
  const shops = session?.shops || [];
  // Shop front photo for the header avatar — same source OwnerQrCode uses.
  // Falls back to the shop initials when no image is set.
  const activeShop = session?.activeShop || shops.find?.((s) => s.isActive) || null;
  // Shop-mobile logins show the SHOP front image; owner logins show the owner's
  // profile avatar (falling back to the shop image when they haven't set one).
  const isShopLogin = session?.loginScope === 'SHOP' || session?.loginType === 'SHOP_LOGIN';
  const shopImage = isShopLogin
    ? (activeShop?.frontImageUrl || null)
    : (session?.avatarUrl || activeShop?.frontImageUrl || null);
  // SHOP-scoped sessions (shop-mobile login) are locked to one shop — never
  // show the switcher even if `shops.length > 1` for some reason.
  const hasMultipleShops = session?.loginScope !== 'SHOP' && shops.length > 1;
  // Only a true shop OWNER (owner-wide session) may add another business
  // location. Shop-mobile logins (loginScope === 'SHOP') and any non-owner role
  // that falls through to the owner navigator must not see "Add Shop".
  const canAddShop = session?.loginScope !== 'SHOP'
    && (session?.roles || []).includes('SHOP_OWNER');
  const greeting = useMemo(() => greetingFor(), []);

  const handleSwitch = async (shopId) => {
    if (!shopId || shopId === session?.shopId) { setShowShopList(false); return; }
    setSwitching(true);
    try {
      await switchShop(shopId);
      await reloadSession();
      await refresh();
      await Promise.all([loadLatest(), loadPickups()]);
    } catch (e) {
      // keep the sidebar open on failure so the user can retry
    } finally {
      setSwitching(false);
      setShowShopList(false);
      setShowSidebar(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadLatest(), loadPickups()]);
    setRefreshing(false);
  };

  const gotoParent = (route, params) => {
    const parent = navigation.getParent && navigation.getParent();
    if (parent) parent.navigate(route, params);
    else navigation.navigate(route, params);
  };

  if (loading && !summary) {
    return <Loader label="Loading dashboard..." />;
  }

  const total = summary?.total ?? 0;
  const activeCount = (summary?.serviceAccepted || 0) + (summary?.technicianAssigned || 0) + (summary?.inServiceProcess || 0);
  const deliveredCount = summary?.delivered || 0;
  const revenue = Number(summary?.revenue ?? summary?.totalRevenue ?? summary?.monthlyRevenue ?? 0);
  const recentBookings = latest.flatMap((group) => group.items);

  // One merged "business snapshot" — replaces the old KPI row + duplicated
  // Today's Summary. Each card is tappable to its detail screen.
  const stats = [
    { label: 'Bookings',  value: total,                                sub: 'All time',       icon: PackageCheck, color: '#16A34A', bg: '#DCFCE7', onPress: () => gotoParent('Bookings') },
    { label: 'Active',    value: activeCount,                          sub: 'In pipeline',    icon: Clock,        color: '#2563EB', bg: '#DBEAFE', onPress: () => navigation.navigate('BookingStatus') },
    { label: 'Pickup',    value: pickupCount,                          sub: 'Repair pickups', icon: Truck,        color: '#0D9488', bg: '#CCFBF1', onPress: () => gotoParent('OwnerPickupServiceList') },
    { label: 'Delivered', value: deliveredCount,                       sub: 'Completed',      icon: PackageOpen,  color: '#D97706', bg: '#FEF3C7', onPress: () => navigation.navigate('BookingStatus') },
    { label: 'Revenue',   value: `₹ ${revenue.toLocaleString('en-IN')}`, sub: 'This month',    icon: Receipt,      color: '#7C3AED', bg: '#F3E8FF', onPress: () => gotoParent('Reports') },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F7F9' }}>
      {/* ─── Hero header (greeting + shop identity + bell) ─────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View style={{ backgroundColor: '#FFFFFF', paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ paddingHorizontal: PAGE_PAD }} className="flex-row items-center">
            <Pressable
              onPress={() => setShowSidebar(true)}
              className="rounded-full items-center justify-center mr-3 active:opacity-80 overflow-hidden"
              style={{
                height: 52, width: 52,
                backgroundColor: GREEN_DARK,
                shadowColor: GREEN_DARK,
                shadowOpacity: 0.2,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              {shopImage ? (
                <Image source={{ uri: shopImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text className="text-white font-extrabold" style={{ fontSize: 19 }}>{shopInitial(shopName)}</Text>
              )}
            </Pressable>
            <View className="flex-1 mr-3">
              <Text className="text-text-muted font-medium" style={{ fontSize: 13 }} numberOfLines={1}>{greeting},</Text>
              <View className="flex-row items-center mt-0.5">
                <Text
                  className="text-text font-bold mr-2"
                  numberOfLines={1}
                  style={{ fontSize: isSmall ? 16 : 18, lineHeight: isSmall ? 20 : 22, flexShrink: 1 }}
                >
                  {shopName}
                </Text>
                <View
                  className="flex-row items-center px-2 py-1 rounded-full"
                  style={{ flexShrink: 0, backgroundColor: '#ECFDF3' }}
                >
                  <ShieldCheck size={12} color={GREEN} />
                  <Text className="font-extrabold ml-1 tracking-wider" style={{ fontSize: 9, color: GREEN_DARK }}>VERIFIED</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('OwnerNotifications')}
              className="rounded-full items-center justify-center active:opacity-80"
              style={{ height: 46, width: 46, backgroundColor: '#F1F5F4' }}
            >
              <Bell size={22} color="#0F172A" strokeWidth={2.1} />
              {notifUnread > 0 ? (
                <View
                  className="absolute rounded-full"
                  style={{ top: 9, right: 9, width: 10, height: 10, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF' }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* ─── Sticky search bar (sits below the header) ─────────── */}
      <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 2, paddingBottom: 6, backgroundColor: '#FFFFFF' }}>
        <Pressable
          onPress={() => gotoParent('OwnerSearch')}
          className="bg-white rounded-3xl flex-row items-center active:opacity-90"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: '#DDE3DF',
            ...cardShadow,
          }}
        >
          <Search size={22} color="#0F172A" strokeWidth={2} />
          <Text className="text-text-muted ml-3 flex-1" style={{ fontSize: 15 }} numberOfLines={1}>
            Search bookings, customers, devices…
          </Text>
          <Mic size={20} color="#94A3B8" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN_DARK}
            colors={[GREEN_DARK]}
          />
        }
      >
        {/* ─── Hero banner (tap → start a new booking) ──────────── */}
        <Pressable
          onPress={() => gotoParent('RepairServiceBookingShop')}
          className="overflow-hidden rounded-3xl active:opacity-95"
          style={{ marginHorizontal: PAGE_PAD, marginTop: 14, ...heroShadow }}
        >
          <Image
            source={{ uri: HERO_IMAGE }}
            resizeMode="contain"
            style={{ width: '100%', aspectRatio: 2076 / 757, backgroundColor: '#E9F9E9' }}
          />
        </Pressable>

        {/* ─── Business snapshot (single compact row of 5) ──────── */}
        <View
          style={{
            paddingHorizontal: PAGE_PAD,
            marginTop: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Pressable
                key={s.label}
                onPress={s.onPress}
                className="active:opacity-80 items-center"
                style={{
                  width: statCardW,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  borderWidth: 1,
                  borderColor: '#EDF1EE',
                  ...cardShadow,
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{ height: 30, width: 30, borderRadius: 9, backgroundColor: s.bg }}
                >
                  <Icon size={16} color={s.color} strokeWidth={2.4} />
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  className="text-text font-extrabold mt-2"
                  style={{ fontSize: statValueF, width: '100%', textAlign: 'center' }}
                >
                  {s.value}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-text-muted font-semibold mt-0.5"
                  style={{ fontSize: 8.5, width: '100%', textAlign: 'center' }}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Quick Actions (icon grid, 4-up phone · 8-up tablet) ─ */}
        <View
          style={{
            marginHorizontal: PAGE_PAD,
            marginTop: 6,
            borderRadius: 24,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#EDF1EE',
            paddingHorizontal: 8,
            paddingTop: 14,
            paddingBottom: 8,
            ...cardShadow,
          }}
        >
          <Text className="text-text font-extrabold px-1 mb-1" style={{ fontSize: 16 }}>Quick Actions</Text>
          <View className="flex-row flex-wrap">
            {QUICK_ACTIONS.map((t) => {
              const Icon = t.icon;
              return (
                <View key={t.label} style={{ width: `${100 / qaCols}%`, paddingVertical: 8 }}>
                  <Pressable
                    onPress={() => { if (t.via === 'parent') gotoParent(t.key); else navigation.navigate(t.key); }}
                    className="items-center active:opacity-70"
                  >
                    <View
                      className="items-center justify-center"
                      style={{ width: qaIcon, height: qaIcon, borderRadius: 16, backgroundColor: '#F0FDF4' }}
                    >
                      <Icon size={qaGlyph} color={GREEN} strokeWidth={2.3} />
                    </View>
                    <Text
                      className="text-text font-semibold text-center"
                      numberOfLines={1}
                      style={{ fontSize: isSmall ? 10 : 11, marginTop: 6 }}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── Latest Bookings (horizontal cards) ────────────────── */}
        {recentBookings.length > 0 ? (
          <>
            <SectionHeader
              title="Latest Bookings"
              action="View all"
              onAction={() => navigation.navigate('Bookings')}
              className="mt-5"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: 4 }}
            >
              {recentBookings.slice(0, 6).map((t, idx) => {
                const img = t._modelImage;
                const num = t.trackingId || (t.id ? t.id.slice(0, 8).toUpperCase() : '-');
                const device = t._modelName || t.deviceDisplayName || t.modelName || 'Device';
                const customer = t.customerName || t.customerFullName || t.customer?.name || 'Customer';
                const status = String(t.status || 'NEW').replaceAll('_', ' ');
                const isDone = /DELIVERED|COMPLETED|READY/.test(status);
                const isPickup = /PICKUP/.test(status);
                const statusColor = isDone ? '#7C3AED' : isPickup ? '#D97706' : GREEN;
                const statusBg = isDone ? '#F3E8FF' : isPickup ? '#FFF7E6' : '#DCFCE7';
                return (
                  <Pressable
                    key={t.id || `${num}-${idx}`}
                    onPress={() => navigation.navigate('TicketDetail', { ticketId: t.id })}
                    className="bg-white rounded-3xl active:opacity-80"
                    style={{
                      width: bookingCardW,
                      marginRight: 12,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: '#EDF1EE',
                      ...cardShadow,
                    }}
                  >
                    <View
                      className="items-center justify-center overflow-hidden"
                      style={{ height: 94, borderRadius: 16, backgroundColor: '#F6FAF7' }}
                    >
                      {img
                        ? <Image source={{ uri: img }} style={{ width: '82%', height: '82%' }} resizeMode="contain" />
                        : <Smartphone size={34} color={GREEN_DARK} />}
                      <View className="absolute px-2 py-0.5 rounded-full" style={{ top: 8, left: 8, backgroundColor: statusBg }}>
                        <Text className="font-extrabold" style={{ fontSize: 8.5, color: statusColor }} numberOfLines={1}>{status}</Text>
                      </View>
                    </View>
                    <Text className="font-bold mt-2" style={{ fontSize: 10, color: '#64748B' }} numberOfLines={1}>#{num}</Text>
                    <Text className="text-text font-extrabold mt-0.5" style={{ fontSize: 14 }} numberOfLines={1}>{device}</Text>
                    <Text className="text-text-muted mt-0.5" style={{ fontSize: 11 }} numberOfLines={1}>{customer}</Text>
                    <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: '#EEF2EF' }}>
                      <Text className="font-extrabold" style={{ fontSize: 10, color: GREEN_DARK }}>View details</Text>
                      <ChevronRight size={14} color={GREEN_DARK} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* ─── Marketplace categories (mirrors the customer Buy home) ─ */}
        {buyCats.length > 0 ? (
          <>
            <SectionHeader
              title="Marketplace"
              caption="Browse devices & accessories by category"
              action="See all"
              onAction={() => navigation.navigate('Buy', { categoryId: null })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingVertical: 4 }}
            >
              {buyCats.map((c, idx) => {
                const code = (c.code || '').toUpperCase();
                const meta = BUY_CAT_META[code] || BUY_CAT_DEFAULT;
                const uri = buyCatImage(c);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => navigation.navigate('Buy', { categoryId: c.id, categoryCode: code, categoryName: c.name })}
                    className="items-center active:opacity-80"
                    style={{ width: catTile, marginRight: idx === buyCats.length - 1 ? 0 : 12 }}
                  >
                    <View
                      className="items-center justify-center bg-white"
                      style={{ width: catIcon, height: catIcon, borderRadius: 18, borderWidth: 1, borderColor: '#E7ECE8', ...cardShadow }}
                    >
                      {uri
                        ? <Image source={{ uri }} style={{ width: catIcon * 0.6, height: catIcon * 0.6 }} resizeMode="contain" />
                        : <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>}
                    </View>
                    <Text
                      className="text-text font-bold text-center mt-1.5"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ fontSize: 11, width: catTile }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* ─── Sell by category (owner sell flow entry) ──────────── */}
        {buyCats.length > 0 ? (
          <>
            <SectionHeader
              title="Sell by category"
              caption="Create a listing for a device you have"
              action="Sell"
              onAction={() => navigation.navigate('Sell')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingVertical: 4 }}
            >
              {buyCats.map((c, idx) => {
                const code = (c.code || '').toUpperCase();
                const meta = BUY_CAT_META[code] || BUY_CAT_DEFAULT;
                const uri = buyCatImage(c);
                return (
                  <Pressable
                    key={`sell-${c.id}`}
                    onPress={() => gotoParent('SelectBrand', { flow: 'OWNER_LIST', categoryId: c.id, categoryCode: code, categoryName: c.name })}
                    className="items-center active:opacity-80"
                    style={{ width: catTile, marginRight: idx === buyCats.length - 1 ? 0 : 12 }}
                  >
                    <View
                      className="items-center justify-center bg-white"
                      style={{ width: catIcon, height: catIcon, borderRadius: 18, borderWidth: 1, borderColor: '#DDEEE1', ...cardShadow }}
                    >
                      {uri
                        ? <Image source={{ uri }} style={{ width: catIcon * 0.6, height: catIcon * 0.6 }} resizeMode="contain" />
                        : <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>}
                    </View>
                    <Text
                      className="text-text font-bold text-center mt-1.5"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ fontSize: 11, width: catTile }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => gotoParent('RepairServiceBookingShop')}
        className="rounded-full items-center justify-center active:opacity-90"
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          width: 56,
          height: 56,
          backgroundColor: GREEN_DARK,
          shadowColor: GREEN_DARK,
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.6} />
      </Pressable>

      {/* ─── Account sidebar (opened from the header avatar) ────── */}
      <Modal visible={sidebarRendered} transparent animationType="none" onRequestClose={() => setShowSidebar(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View
            style={{
              width: '82%',
              maxWidth: 360,
              backgroundColor: '#FFFFFF',
              transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-panelW, 0] }) }],
            }}
          >
            <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
              <LinearGradient
                colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingTop: 10, paddingBottom: 16, paddingHorizontal: 16 }}
              >
                <View className="flex-row items-center">
                  <View
                    className="h-12 w-12 rounded-2xl bg-white/20 items-center justify-center mr-3"
                    style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                  >
                    <Text className="text-white text-[15px] font-extrabold">{shopInitial(shopName)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-[15px] font-extrabold" numberOfLines={1}>
                      {session?.name || 'Shop Owner'}
                    </Text>
                    <Text className="text-white/85 text-[11.5px]" numberOfLines={1}>{shopName}</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowSidebar(false)}
                    hitSlop={8}
                    className="h-8 w-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>
              </LinearGradient>
            </SafeAreaView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
              {/* Manage Account → expands the shop list inline (no popup) */}
              <Pressable
                onPress={() => setShowShopList((v) => !v)}
                className="flex-row items-center px-4 active:opacity-70"
                style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
              >
                <View className="h-9 w-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#F1F5F9' }}>
                  <Store size={17} color="#0F172A" />
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-extrabold text-text">Manage Account</Text>
                  <Text className="text-[11px] text-text-muted mt-0.5" numberOfLines={1}>
                    {shops.length > 1 ? `Switch between ${shops.length} shops` : (shopName || 'Your shop')}
                  </Text>
                </View>
                <ChevronRight
                  size={16}
                  color="#CBD5E1"
                  style={{ transform: [{ rotate: showShopList ? '90deg' : '0deg' }] }}
                />
              </Pressable>
              {showShopList ? (
                <View style={{ backgroundColor: '#F8FAFC' }}>
                  {shops.length === 0 ? (
                    <Text className="px-4 py-3 text-[12px] text-text-muted">No other shops linked.</Text>
                  ) : (
                    shops.map((s) => {
                      const active = s.id === session?.shopId;
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => handleSwitch(s.id)}
                          disabled={switching || active}
                          className="flex-row items-center px-4 active:opacity-70"
                          style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}
                        >
                          <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: active ? GREEN : '#E2E8F0' }}>
                            <Store size={14} color={active ? '#fff' : '#64748B'} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[12.5px] font-bold" style={{ color: active ? GREEN_DARK : '#0F172A' }} numberOfLines={1}>{s.name}</Text>
                            {s.slug ? <Text className="text-[10.5px] text-text-muted" numberOfLines={1}>{s.slug}</Text> : null}
                          </View>
                          {active ? <Check size={15} color={GREEN_DARK} /> : <ChevronRight size={14} color="#CBD5E1" />}
                        </Pressable>
                      );
                    })
                  )}
                  {switching ? (
                    <View className="flex-row items-center px-4 py-2">
                      <ActivityIndicator color={GREEN_DARK} size="small" />
                      <Text className="ml-2 text-[11px] text-text-muted">Switching…</Text>
                    </View>
                  ) : null}
                  {canAddShop ? (
                    <Pressable
                      onPress={() => { setShowSidebar(false); gotoParent('OwnerShopInfo'); }}
                      className="flex-row items-center px-4 active:opacity-70"
                      style={{ paddingVertical: 10 }}
                    >
                      <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: '#F1F5F9' }}>
                        <PlusCircle size={16} color="#0F172A" />
                      </View>
                      <Text className="text-[12.5px] font-extrabold" style={{ color: GREEN_DARK }}>Add Shop</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {ACCOUNT_MENU.map((m) => {
                const Icon = m.icon;
                return (
                  <Pressable
                    key={m.route}
                    onPress={() => {
                      setShowSidebar(false);
                      const dest = m.route === 'KYC' ? (hasKycDocs ? 'OwnerKycView' : 'OwnerKycIntro') : m.route;
                      gotoParent(dest);
                    }}
                    className="flex-row items-center px-4 active:opacity-70"
                    style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <View
                      className="h-9 w-9 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: '#F1F5F9' }}
                    >
                      <Icon size={17} color="#0F172A" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13.5px] font-extrabold text-text">{m.label}</Text>
                      <Text className="text-[11px] text-text-muted mt-0.5" numberOfLines={1}>{m.sub}</Text>
                    </View>
                    <ChevronRight size={16} color="#CBD5E1" />
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Pinned Log Out — always visible at the bottom */}
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF' }}>
              <Pressable
                onPress={() => { setShowSidebar(false); if (onLogout) onLogout(); }}
                className="flex-row items-center px-4 py-3 active:opacity-70"
                style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
              >
                <View
                  className="h-9 w-9 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: '#FEF2F2' }}
                >
                  <LogOut size={17} color="#DC2626" />
                </View>
                <Text className="text-[13.5px] font-extrabold" style={{ color: '#DC2626' }}>Log Out</Text>
              </Pressable>
            </SafeAreaView>
          </Animated.View>

          {/* Tap-to-close overlay (fades with the drawer) */}
          <Animated.View style={{ flex: 1, opacity: slideAnim }}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' }}
              onPress={() => setShowSidebar(false)}
            />
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
}
