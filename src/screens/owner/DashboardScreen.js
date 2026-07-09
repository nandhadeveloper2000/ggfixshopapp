import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PlusCircle,
  Receipt,
  BarChart3,
  HelpCircle,
  Users,
  ShoppingBag,
  Tag,
  CheckCircle2,
  UserCheck,
  Wrench,
  PackageCheck,
  Truck,
  PackageOpen,
  Clock,
  TrendingUp,
  Bell,
  ChevronRight,
  ShieldCheck,
  ArrowLeftRight,
  Store,
  X,
  Check,
  Search,
  Mic,
  MessageCircle,
  CalendarCheck,
  CalendarX,
  FileText,
  Hand,
  Smartphone,
  Phone,
  User,
  QrCode,
  Package,
  CalendarClock,
  LogOut,
  ShoppingCart,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { getDeviceCategories, getModelsByBrand } from '../../api/masterData';
import { listShopKycDocuments } from '../../api/shops';
import { getUnreadCount as getNotifUnreadCount } from '../../api/notifications';
import { Loader, SectionHeader, Badge, Card, EmptyState } from '../../components/rnr';
import { getSession } from '../../auth/session';
import { fetchMe, switchShop } from '../../api/auth';

// Swiggy / Zomato green palette — shared with Sell, Buy, Billing & AllBooking
// so every owner-side tab speaks the same visual language.
const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

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
      }
    : null;

  return { summary, loading, error, refresh: load };
}

const STATUSES = [
  { key: 'serviceAccepted',   label: 'Service Accepted',   icon: CheckCircle2, color: GREEN,       bg: '#DCFCE7', statusKey: 'SERVICE_ACCEPTED',     statusList: ['CREATED'],                  bgFull: '#60A5FA' },
  { key: 'technicianAssigned',label: 'Technician Assigned',icon: UserCheck,    color: '#0EA5E9',   bg: '#E0F2FE', statusKey: 'TECHNICIAN_ASSIGNED',  statusList: ['ASSIGNED'],                 bgFull: '#4C1D95' },
  { key: 'inServiceProcess',  label: 'In Service Process', icon: Wrench,       color: '#2563EB',   bg: '#DBEAFE', statusKey: 'IN_SERVICE_PROCESS',   statusList: ['IN_DIAGNOSIS', 'IN_REPAIR'], bgFull: '#334155' },
  { key: 'workCompleted',     label: 'Work Completed',     icon: PackageCheck, color: '#7C3AED',   bg: '#EDE9FE', statusKey: 'WORK_COMPLETED',       statusList: ['READY'],                    bgFull: '#22C55E' },
  { key: 'outForDelivery',    label: 'Out for Delivery',   icon: Truck,        color: '#F59E0B',   bg: '#FEF3C7', statusKey: 'OUT_FOR_DELIVERY',     statusList: ['DELIVERED_PROCESSING'],     bgFull: '#2DD4BF' },
  { key: 'delivered',         label: 'Delivered',          icon: PackageOpen,  color: GREEN_DARK,  bg: '#DCFCE7', statusKey: 'DELIVERED',            statusList: ['DELIVERED'],                bgFull: '#16A34A' },
  { key: 'workPending',       label: 'Work Pending',       icon: Clock,        color: '#EF4444',   bg: '#FEE2E2', statusKey: 'WORK_PENDING',         statusList: ['QUOTED', 'APPROVED'],       bgFull: '#EF4444' },
];

const QUICK_ACTIONS = [
  { key: 'RepairServiceBookingShop', label: 'New\nBooking', icon: PlusCircle,   color: GREEN_DARK, bg: '#DCFCE7', via: 'parent' },
  { key: 'OwnerPickupServiceList', label: 'Pickup',         icon: Truck,        color: '#B45309',  bg: '#FEF3C7', via: 'parent' },
  { key: 'Bookings',               label: 'All\nBookings',  icon: PackageCheck, color: '#0EA5E9',  bg: '#E0F2FE' },
  { key: 'Billing',                label: 'Invoices',       icon: Receipt,      color: '#2563EB',  bg: '#DBEAFE' },
  { key: 'BookingStatus',          label: 'Booking\nStatus', icon: BarChart3,   color: GREEN,      bg: '#D1FAE5' },
  { key: 'ShopChatInbox',          label: 'Enquiry',        icon: MessageCircle, color: '#F59E0B', bg: '#FEF3C7' },
];

// Emoji fallbacks for the Buy Categories rail — mirrors the customer app's
// category styling so both stores read the same. Used when a category has no
// image_url in master data.
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

// Employee Management menu — Employee List + Leave Report open existing
// screens; Attendance / Leave / Late / Permission open the all-staff report
// screen in the matching mode.
const EMPLOYEE_MENU = [
  { key: 'list',        label: 'Employee List', desc: 'View & manage your staff',   icon: Users,         route: 'OwnerEmployeeList' },
  { key: 'attendance',  label: 'Attendance',    desc: 'Daily attendance, all staff', icon: CalendarCheck, route: 'OwnerStaffReport', params: { mode: 'attendance' } },
  { key: 'leave',       label: 'Leave',         desc: 'Leave days this month',       icon: CalendarX,     route: 'OwnerStaffReport', params: { mode: 'leave' } },
  { key: 'late',        label: 'Late',          desc: 'Late hours by employee',      icon: Clock,         route: 'OwnerStaffReport', params: { mode: 'late' } },
  { key: 'permission',  label: 'Permission',    desc: 'Permission records',          icon: Hand,          route: 'OwnerStaffReport', params: { mode: 'permission' } },
  { key: 'leaveReport', label: 'Leave Report',  desc: 'Approve leave requests',      icon: FileText,      route: 'OwnerLeaveRequests' },
];

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
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarRendered, setSidebarRendered] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [hasKycDocs, setHasKycDocs] = useState(false);
  // Timestamp of the last Latest-Bookings load + an in-flight guard, used to
  // throttle/dedupe the on-focus refresh so returning to Home doesn't
  // refetch/flicker on every focus (or double-load with the mount effect).
  const latestLoadedAtRef = useRef(0);
  const latestLoadingRef = useRef(false);

  // Fill the screen: phones keep the compact grid; tablets/large screens get
  // more columns so the content uses the full width instead of stretching a
  // few tiles across it.
  const { width: winW } = useWindowDimensions();
  const isTablet = winW >= 680;
  const qaCols = isTablet ? 8 : 4;
  const empCols = isTablet ? 6 : 3;
  const buyTileW = isTablet
    ? Math.max(96, Math.floor((winW - 32 - 12 * Math.max(0, buyCats.length - 1)) / Math.max(1, buyCats.length)))
    : 84;
  const panelW = Math.min(360, winW * 0.82);

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
      setLatest(groupBookingsByDay(enriched.slice(0, 12)));
    } catch {
      // Keep the cached list on a background refresh failure — don't blank the
      // screen (that reads as a jarring reload).
    } finally {
      latestLoadedAtRef.current = Date.now();
      latestLoadingRef.current = false;
    }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // Refresh the bell badge whenever the dashboard regains focus. The heavier
  // bookings-list refetch is throttled + silent (no loader, no blanking) so
  // returning to Home — e.g. right after the booking/assign flow — doesn't
  // visibly reload. The mount load above stamps the timestamp, so the first
  // focus (fired right after mount) is skipped instead of double-loading.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      refreshNotifs();
      if (Date.now() - latestLoadedAtRef.current > HOME_REFRESH_STALE_MS) loadLatest();
    });
    return unsub;
  }, [navigation, refreshNotifs, loadLatest]);

  const reloadSession = useCallback(async () => {
    try { setSession(await fetchMe()); }
    catch { try { setSession(await getSession()); } catch { setSession(null); } }
  }, []);

  useEffect(() => { reloadSession(); }, [reloadSession]);

  // Buy Categories rail — same source as the customer app's Buy home so the
  // owner browses the marketplace by the same category set. Silent on failure.
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
      await loadLatest();
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
    await Promise.all([refresh(), loadLatest()]);
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

  const kpis = [
    { label: 'Bookings',  value: total,          sub: 'All-time',    icon: PackageCheck, onPress: () => gotoParent('Bookings') },
    { label: 'Active',    value: activeCount,    sub: 'In pipeline', icon: Clock,        onPress: () => navigation.navigate('BookingStatus') },
    { label: 'Delivered', value: deliveredCount, sub: 'Completed',   icon: PackageOpen,  onPress: () => navigation.navigate('BookingStatus') },
  ];

  return (
    <View className="flex-1 bg-background">
      {/* ─── Hero header (compact greeting + search pill) ──────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 6,
            paddingBottom: 14,
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22,
          }}
        >
          {/* Top action row */}
          <View className="px-4 flex-row items-center py-1">
            <Pressable
              onPress={() => setShowSidebar(true)}
              className="h-10 w-10 rounded-2xl bg-white/20 items-center justify-center mr-3 active:opacity-80"
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}
            >
              <Text className="text-white text-[13px] font-extrabold">{shopInitial(shopName)}</Text>
            </Pressable>
            <View className="flex-1 mr-2">
              <Text className="text-white/80 text-[11px] font-semibold" numberOfLines={1}>{greeting},</Text>
              <View className="flex-row items-center mt-0.5">
                <Text
                  className="text-white text-[16.5px] font-extrabold leading-5 mr-1.5"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {shopName}
                </Text>
                <View
                  className="flex-row items-center bg-white/15 px-1.5 py-[2px] rounded-full"
                  style={{ flexShrink: 0 }}
                >
                  <ShieldCheck size={9} color="#A7F3D0" />
                  <Text className="text-emerald-100 text-[8px] font-extrabold ml-0.5 tracking-wider">VERIFIED</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('OwnerNotifications')}
              className="h-10 w-10 rounded-full bg-white/15 items-center justify-center active:opacity-80"
            >
              <Bell size={16} color="#fff" />
              {notifUnread > 0 ? (
                <View
                  className="absolute -top-0.5 -right-0.5 rounded-full min-w-[16px] h-4 px-1 items-center justify-center"
                  style={{ backgroundColor: '#F59E0B', borderWidth: 1.5, borderColor: GREEN_DARK }}
                >
                  <Text className="text-white text-[9px] font-extrabold">
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ─── Separated search bar (sits below the header, sticky) ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 }}>
        <Pressable
          onPress={() => gotoParent('Bookings')}
          className="bg-white rounded-2xl px-3.5 py-3 flex-row items-center active:opacity-90"
          style={{
            borderWidth: 1,
            borderColor: '#E5E7EB',
            shadowColor: '#0F172A',
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <Search size={16} color={GREEN} />
          <Text className="text-text-muted text-[13px] ml-2 flex-1" numberOfLines={1}>
            Search bookings, customers, devices…
          </Text>
          <View className="h-5 w-px bg-border mx-2" />
          <Mic size={15} color={GREEN_DARK} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN_DARK}
            colors={[GREEN_DARK]}
          />
        }
      >
        {/* ─── Stats (Bookings / Active / Delivered) ────────────── */}
        <View className="px-3 mt-3 flex-row">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Pressable
                key={k.label}
                onPress={k.onPress}
                className="flex-1 mx-1 bg-white rounded-2xl p-3 active:opacity-80"
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.05,
                  shadowRadius: 7,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center">
                  <View className="h-8 w-8 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: '#F1F5F9' }}>
                    <Icon size={15} color="#0F172A" />
                  </View>
                  <Text className="text-[22px] font-extrabold leading-7 text-text">{k.value}</Text>
                </View>
                <Text className="text-[10px] font-extrabold text-text-muted tracking-wide mt-1">{k.label}</Text>
                <Text className="text-[9.5px] text-text-muted">{k.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Quick Actions (4-col, Paytm-style circular icons) ── */}
        <SectionHeader title="Quick Actions" caption="What would you like to do?" />
        <View className="px-3 flex-row flex-wrap">
          {QUICK_ACTIONS.map((t) => {
            const Icon = t.icon;
            return (
              <View key={t.label} style={{ width: `${100 / qaCols}%` }} className="p-1.5">
                <Pressable
                  onPress={() => {
                    if (t.key?.startsWith('_')) return;
                    if (t.via === 'parent') gotoParent(t.key); else navigation.navigate(t.key);
                  }}
                  className="items-center active:opacity-80"
                >
                  <View
                    className="h-14 w-14 rounded-2xl items-center justify-center bg-white"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.06,
                      shadowRadius: 7,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 2,
                    }}
                  >
                    <Icon size={22} color="#0F172A" />
                  </View>
                  <Text
                    className="text-[10px] font-bold text-text mt-1.5 text-center leading-tight"
                    numberOfLines={2}
                    style={{ minHeight: 24 }}
                  >
                    {t.label.replace('\n', ' ')}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* ─── Employee Management (horizontal rail + View all) ──── */}
        <SectionHeader
          title="Employee Management"
          caption="Team, attendance & leave"
          action="View all"
          onAction={() => gotoParent('OwnerEmployeeList')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
        >
          {EMPLOYEE_MENU.map((m, idx) => {
            const Icon = m.icon;
            return (
              <Pressable
                key={m.key}
                onPress={() => gotoParent(m.route, m.params)}
                className="items-center active:opacity-80"
                style={{ width: buyTileW, marginRight: idx === EMPLOYEE_MENU.length - 1 ? 0 : 12 }}
              >
                <View
                  className="h-16 w-16 rounded-2xl items-center justify-center bg-white"
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#0F172A',
                    shadowOpacity: 0.06,
                    shadowRadius: 7,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 2,
                  }}
                >
                  <Icon size={22} color="#0F172A" />
                </View>
                <Text
                  className="text-[10px] font-bold text-text mt-1.5 text-center leading-tight"
                  numberOfLines={2}
                  style={{ minHeight: 24, width: buyTileW }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Sell Categories (same category set as Buy; taps jump straight
            into the owner sell flow for that category, like OwnerSellHome). ── */}
        {buyCats.length > 0 ? (
          <>
            <SectionHeader
              title="Sell"
              caption="Start a sell listing by category"
              action="See all"
              onAction={() => navigation.navigate('Sell')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
            >
              {buyCats.map((c, idx) => {
                const code = (c.code || '').toUpperCase();
                const meta = BUY_CAT_META[code] || BUY_CAT_DEFAULT;
                const uri = buyCatImage(c);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => navigation.navigate('SelectBrand', {
                      flow: 'OWNER_LIST',
                      categoryId: c.id,
                      categoryCode: code,
                      categoryName: c.name,
                    })}
                    className="items-center active:opacity-80"
                    style={{ width: buyTileW, marginRight: idx === buyCats.length - 1 ? 0 : 12 }}
                  >
                    <View
                      className="h-16 w-16 rounded-2xl items-center justify-center bg-white"
                      style={{
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        shadowColor: '#0F172A',
                        shadowOpacity: 0.07,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 3,
                      }}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={{ width: 40, height: 40 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
                      )}
                    </View>
                    <Text
                      className="text-[11px] font-bold text-text mt-1.5 text-center"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ width: '100%' }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* ─── Buy Categories (mirrors the customer Buy home) ─────── */}
        {buyCats.length > 0 ? (
          <>
            <SectionHeader
              title="Buy"
              caption="Shop marketplace deals by category"
              action="See all"
              onAction={() => navigation.navigate('Buy', { categoryId: null })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
            >
              {buyCats.map((c, idx) => {
                const code = (c.code || '').toUpperCase();
                const meta = BUY_CAT_META[code] || BUY_CAT_DEFAULT;
                const uri = buyCatImage(c);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => navigation.navigate('Buy', {
                      categoryId: c.id,
                      categoryCode: code,
                      categoryName: c.name,
                    })}
                    className="items-center active:opacity-80"
                    style={{ width: buyTileW, marginRight: idx === buyCats.length - 1 ? 0 : 12 }}
                  >
                    <View
                      className="h-16 w-16 rounded-2xl items-center justify-center bg-white"
                      style={{
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        shadowColor: '#0F172A',
                        shadowOpacity: 0.07,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 3,
                      }}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={{ width: 40, height: 40 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
                      )}
                    </View>
                    <Text
                      className="text-[11px] font-bold text-text mt-1.5 text-center"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ width: '100%' }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* ─── Latest Bookings (grouped by day, current date first) ─ */}
        {latest.length > 0 ? (
          <>
            <SectionHeader
              title="Latest Bookings"
              caption="Newest first, day by day"
              action="View all"
              onAction={() => gotoParent('Bookings')}
            />
            <View className="px-4">
              {latest.map((group) => (
                <View key={group.key}>
                  <Text className="text-[11px] font-extrabold text-text-muted mt-1 mb-2 tracking-wide">
                    {dayLabel(group.date)}
                  </Text>
                  {group.items.map((t) => {
                    const img = t._modelImage;
                    const num = t.trackingId || (t.id ? t.id.slice(0, 8).toUpperCase() : '-');
                    const name = t.customerName || t.customerFullName || t.customer?.name || '-';
                    const phone = t.customerPhone || t.customer?.phone || '';
                    const device = t._modelName || t.deviceDisplayName || t.modelName || 'Device';
                    return (
                      <View
                        key={t.id}
                        className="bg-white rounded-2xl p-3 mb-2.5"
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          shadowColor: '#0F172A',
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: 2,
                        }}
                      >
                        <View className="flex-row items-center">
                          <View
                            className="h-14 w-14 rounded-xl items-center justify-center mr-3 overflow-hidden"
                            style={{ backgroundColor: '#F1F5F9' }}
                          >
                            {img ? (
                              <Image source={{ uri: img }} style={{ width: 56, height: 56 }} resizeMode="contain" />
                            ) : (
                              <Smartphone size={24} color={GREEN_DARK} />
                            )}
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className="text-[10px] font-extrabold mr-1.5" style={{ color: GREEN_DARK }}>#{num}</Text>
                              <Text className="text-[11px] text-text-muted flex-1" numberOfLines={1}>{device}</Text>
                            </View>
                            <View className="flex-row items-center mt-0.5">
                              <Text className="text-[13.5px] font-extrabold text-text" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
                              <Phone size={11} color="#94A3B8" style={{ marginLeft: 8 }} />
                              <Text className="text-[11.5px] text-text-muted ml-1" numberOfLines={1}>{phone || '—'}</Text>
                            </View>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => navigation.navigate('TicketDetail', { ticketId: t.id })}
                          className="mt-2 flex-row items-center justify-end active:opacity-70"
                        >
                          <Text className="text-[12px] font-extrabold" style={{ color: GREEN_DARK }}>View Details</Text>
                          <ChevronRight size={14} color={GREEN_DARK} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : null}

      </ScrollView>

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
