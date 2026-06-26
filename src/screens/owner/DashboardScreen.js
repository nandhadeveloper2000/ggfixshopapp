import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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
  Gift,
  Sparkles,
  Zap,
  MessageCircle,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { listShopChats } from '../../api/chat';
import {
  listNotifications,
  getUnreadCount as getNotifUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications';
import { Loader, SectionHeader, Badge, Card, EmptyState } from '../../components/rnr';
import { getSession } from '../../auth/session';
import { fetchMe, switchShop } from '../../api/auth';

// Swiggy / Zomato green palette — shared with Sell, Buy, Billing & AllBooking
// so every owner-side tab speaks the same visual language.
const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

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
        outForDelivery: Number(counts.READY ?? 0),
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
  { key: 'Billing',                label: 'Billing',        icon: Receipt,      color: '#2563EB',  bg: '#DBEAFE' },
  { key: 'Reports',                label: 'Reports',        icon: BarChart3,    color: GREEN,      bg: '#D1FAE5' },
  { key: 'ShopChatInbox',          label: 'Enquiry',        icon: MessageCircle, color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'OwnerEmployeeList',      label: 'Team',           icon: Users,        color: '#7C3AED',  bg: '#EDE9FE', via: 'parent' },
  { key: 'Buy',                    label: 'Buy',            icon: ShoppingBag,  color: '#EC4899',  bg: '#FCE7F3' },
  { key: 'Sell',                   label: 'Sell',           icon: Tag,          color: GREEN_DARK, bg: '#DCFCE7' },
];

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

export default function DashboardScreen({ navigation }) {
  const { summary, loading, error, refresh } = useBookingCounts();
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  // Lightweight poll of the chat inbox so the header bubble badge updates
  // even when the user never opens Messages. 30s is enough — they get the
  // real-time view inside the thread screen itself.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const list = await listShopChats();
        if (!cancelled) {
          const n = (list || []).reduce((a, t) => a + (t.unreadCount || 0), 0);
          setChatUnread(n);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Poll the shop-side notification feed for the Bell badge + modal contents.
  // Same cadence as the chat poll so a new booking lights up the bell without
  // the owner refreshing manually.
  const refreshNotifs = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        listNotifications().catch(() => []),
        getNotifUnreadCount().catch(() => 0),
      ]);
      setNotifs(list || []);
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

  // When the modal opens, do an immediate fetch so the most recent updates
  // are visible without waiting for the next 30s tick.
  useEffect(() => {
    if (!showNotifications) return;
    setNotifLoading(true);
    refreshNotifs().finally(() => setNotifLoading(false));
  }, [showNotifications, refreshNotifs]);

  const onTapNotification = useCallback(async (n) => {
    if (!n?.read) {
      try { await markNotificationRead(n.id); } catch {}
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setNotifUnread((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    // Drop the owner into their Bookings tab so they can find the affected
    // row — Dashboard sits inside the bottom-tab navigator, so we hop to the
    // parent to switch tabs without losing the back stack.
    const parent = navigation.getParent && navigation.getParent();
    if (parent) parent.navigate('Bookings');
  }, [navigation]);

  const onMarkAllRead = useCallback(async () => {
    try { await markAllNotificationsRead(); } catch {}
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    setNotifUnread(0);
  }, []);

  const reloadSession = useCallback(async () => {
    try { setSession(await fetchMe()); }
    catch { try { setSession(await getSession()); } catch { setSession(null); } }
  }, []);

  useEffect(() => { reloadSession(); }, [reloadSession]);

  const shopName = session?.shopName || (session?.shops?.find?.((s) => s.isActive)?.name) || 'Shop · Owner';
  const shops = session?.shops || [];
  // SHOP-scoped sessions (shop-mobile login) are locked to one shop — never
  // show the switcher even if `shops.length > 1` for some reason.
  const hasMultipleShops = session?.loginScope !== 'SHOP' && shops.length > 1;
  const greeting = useMemo(() => greetingFor(), []);

  const handleSwitch = async (shopId) => {
    if (!shopId || shopId === session?.shopId) { setShowSwitcher(false); return; }
    setSwitching(true);
    try {
      await switchShop(shopId);
      await reloadSession();
      await refresh();
      setShowSwitcher(false);
    } catch (e) {
      setShowSwitcher(false);
    } finally {
      setSwitching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const gotoParent = (route) => {
    const parent = navigation.getParent && navigation.getParent();
    if (parent) parent.navigate(route);
    else navigation.navigate(route);
  };

  if (loading && !summary) {
    return <Loader label="Loading dashboard..." />;
  }

  const total = summary?.total ?? 0;
  const activeCount = (summary?.serviceAccepted || 0) + (summary?.technicianAssigned || 0) + (summary?.inServiceProcess || 0);
  const deliveredCount = summary?.delivered || 0;

  return (
    <View className="flex-1 bg-background">
      {/* ─── Hero header (compact greeting + search pill) ──────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 8,
            paddingBottom: 18,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          {/* Top action row */}
          <View className="px-4 flex-row items-center">
            <View
              className="h-10 w-10 rounded-2xl bg-white/20 items-center justify-center mr-3"
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}
            >
              <Text className="text-white text-[13px] font-extrabold">{shopInitial(shopName)}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-white/85 text-[11px] font-semibold mr-1.5">{greeting},</Text>
                <View className="flex-row items-center bg-white/15 px-1.5 py-[2px] rounded-full">
                  <ShieldCheck size={9} color="#A7F3D0" />
                  <Text className="text-emerald-100 text-[8px] font-extrabold ml-0.5 tracking-wider">VERIFIED</Text>
                </View>
              </View>
              <Text className="text-white text-[16px] font-extrabold leading-5" numberOfLines={1}>
                {shopName}
              </Text>
            </View>

            {hasMultipleShops ? (
              <Pressable
                onPress={() => setShowSwitcher(true)}
                className="h-10 px-2.5 rounded-full bg-white/15 items-center justify-center active:opacity-80 flex-row mr-2"
              >
                <ArrowLeftRight size={14} color="#fff" />
                <Text className="text-white text-[11px] font-extrabold ml-1">{shops.length}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => navigation.navigate('ShopChatInbox')}
              className="h-10 w-10 rounded-full bg-white/15 items-center justify-center active:opacity-80 mr-2"
            >
              <MessageCircle size={16} color="#fff" />
              {chatUnread > 0 ? (
                <View
                  className="absolute -top-0.5 -right-0.5 rounded-full min-w-[16px] h-4 px-1 items-center justify-center"
                  style={{ backgroundColor: '#F59E0B', borderWidth: 1.5, borderColor: GREEN_DARK }}
                >
                  <Text className="text-white text-[9px] font-extrabold">{chatUnread > 9 ? '9+' : chatUnread}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setShowNotifications(true)}
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

          {/* Search pill (Swiggy/Zomato style) */}
          <Pressable
            onPress={() => gotoParent('Bookings')}
            className="mx-4 mt-4 bg-white rounded-2xl px-3.5 py-3 flex-row items-center active:opacity-90"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Search size={16} color={GREEN} />
            <Text className="text-text-muted text-[13px] ml-2 flex-1" numberOfLines={1}>
              Search bookings, customers, devices…
            </Text>
            <View className="h-5 w-px bg-border mx-2" />
            <Mic size={15} color={GREEN_DARK} />
          </Pressable>
        </LinearGradient>
      </SafeAreaView>

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
        {/* ─── KPI card (sits cleanly below header) ─────────────── */}
        <View className="px-4 mt-3">
          <Card padded={false} className="px-2 py-3 flex-row">
            <View className="flex-1 px-2">
              <Text className="text-[9px] font-extrabold text-text-muted tracking-[1.5px]">BOOKINGS</Text>
              <Text className="text-[20px] font-extrabold mt-0.5 leading-6" style={{ color: GREEN_DARK }}>{total}</Text>
              <View className="flex-row items-center">
                <TrendingUp size={9} color={GREEN} />
                <Text className="text-[9px] font-bold ml-0.5" style={{ color: GREEN_DARK }}>All-time</Text>
              </View>
            </View>
            <View className="w-px bg-border my-1" />
            <View className="flex-1 px-2">
              <Text className="text-[9px] font-extrabold text-text-muted tracking-[1.5px]">ACTIVE</Text>
              <Text className="text-[20px] font-extrabold mt-0.5 leading-6" style={{ color: '#B45309' }}>{activeCount}</Text>
              <Text className="text-[9px] font-bold text-text-muted">in pipeline</Text>
            </View>
            <View className="w-px bg-border my-1" />
            <View className="flex-1 px-2">
              <Text className="text-[9px] font-extrabold text-text-muted tracking-[1.5px]">DELIVERED</Text>
              <Text className="text-[20px] font-extrabold mt-0.5 leading-6" style={{ color: GREEN }}>{deliveredCount}</Text>
              <Text className="text-[9px] font-bold text-text-muted">closed jobs</Text>
            </View>
          </Card>
        </View>

        {/* ─── Quick Actions (4-col, Paytm-style circular icons) ── */}
        <SectionHeader title="Quick Actions" caption="What would you like to do?" />
        <View className="px-3 flex-row flex-wrap">
          {QUICK_ACTIONS.map((t) => {
            const Icon = t.icon;
            return (
              <View key={t.label} style={{ width: '25%' }} className="p-1">
                <Pressable
                  onPress={() => {
                    if (t.key?.startsWith('_')) return;
                    if (t.via === 'parent') gotoParent(t.key); else navigation.navigate(t.key);
                  }}
                  className="items-center py-2 active:opacity-70"
                >
                  <View
                    className="h-12 w-12 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: t.bg }}
                  >
                    <Icon size={20} color={t.color} />
                  </View>
                  <Text className="text-[10px] font-bold text-text mt-1.5 text-center leading-tight" numberOfLines={2}>
                    {t.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* ─── Promo banner (Swiggy offer-card vibe) ─────────────── */}
        <View className="px-4 mt-4">
          <Pressable onPress={() => gotoParent('RepairServiceBookingShop')} className="active:opacity-90">
            <LinearGradient
              colors={[GREEN, GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 16, overflow: 'hidden' }}
            >
              {/* decorative blobs */}
              <View style={{ position: 'absolute', right: -30, top: -30, height: 110, width: 110, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' }} />
              <View style={{ position: 'absolute', right: 30, bottom: -40, height: 80, width: 80, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View className="flex-row items-center">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center mb-1">
                    <Sparkles size={11} color="#DCFCE7" />
                    <Text className="text-white text-[9px] font-extrabold ml-1 tracking-[2px] opacity-90">TODAY'S BOOST</Text>
                  </View>
                  <Text className="text-white text-[17px] font-extrabold leading-6">Create a new booking</Text>
                  <Text className="text-white/90 text-[11px] mt-0.5">Walk-ins, pickups & quotations — under 30 seconds</Text>
                  <View className="bg-white self-start mt-2.5 px-3 py-1.5 rounded-full flex-row items-center">
                    <Text className="text-[11px] font-extrabold" style={{ color: GREEN_DARK }}>Create now</Text>
                    <ChevronRight size={12} color={GREEN_DARK} />
                  </View>
                </View>
                <View className="h-16 w-16 rounded-2xl bg-white/20 items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                  <Gift size={28} color="#fff" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ─── Live Pipeline (horizontal scroll cards) ──────────── */}
        <SectionHeader
          title="Live Pipeline"
          caption="Real-time bookings"
          action="View all"
          onAction={() => navigation.navigate('BookingStatus')}
        />
        {error ? (
          <View className="mx-4 bg-danger/10 border border-danger/30 rounded-2xl px-3 py-2.5">
            <Text className="text-[12px] text-danger font-semibold">{error}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
          >
            {STATUSES.map((s, idx) => {
              const Icon = s.icon;
              const value = summary?.[s.key] ?? 0;
              const isHot = value > 0;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => navigation.navigate('BookingStatusReport', {
                    statusKey: s.statusKey,
                    label: s.label,
                    statusList: s.statusList,
                    bg: s.bgFull,
                    icon: s.statusKey,
                  })}
                  className="active:opacity-80"
                  style={{ marginRight: idx === STATUSES.length - 1 ? 0 : 10 }}
                >
                  <Card padded={false} className="p-3" style={{ width: 150, borderLeftWidth: 3, borderLeftColor: s.color }}>
                    <View className="flex-row items-center justify-between">
                      <View
                        className="h-10 w-10 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: s.bg }}
                      >
                        <Icon size={18} color={s.color} />
                      </View>
                      {isHot ? (
                        <Badge
                          variant={value > 3 ? 'softDanger' : 'softWarning'}
                          className="px-1.5 py-[1px]"
                          textClassName="text-[9px]"
                        >
                          {value > 3 ? 'HOT' : 'NEW'}
                        </Badge>
                      ) : null}
                    </View>
                    <Text className="text-[22px] font-extrabold mt-2 leading-7" style={{ color: s.color }}>{value}</Text>
                    <Text className="text-[11px] text-text-muted leading-tight" numberOfLines={2}>{s.label}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ─── Today's snapshot (insight card) ──────────────────── */}
        <SectionHeader title="Today's Snapshot" caption="At a glance" />
        <View className="px-4">
          <Card className="flex-row items-center">
            <View
              className="h-12 w-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Zap size={20} color={GREEN_DARK} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-[11px] text-text-muted">Pipeline activity</Text>
              <Text className="text-[15px] font-extrabold text-text">
                {activeCount} active {activeCount === 1 ? 'job' : 'jobs'} · {deliveredCount} delivered
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Reports')}
              className="h-9 w-9 rounded-full bg-surface-muted items-center justify-center active:opacity-70"
            >
              <ChevronRight size={18} color="#0F172A" />
            </Pressable>
          </Card>
        </View>

      </ScrollView>

      {/* ─── Shop switcher modal ────────────────────────────────── */}
      <Modal visible={showSwitcher} transparent animationType="fade" onRequestClose={() => setShowSwitcher(false)}>
        <Pressable
          onPress={() => setShowSwitcher(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[17px] font-extrabold text-text">Switch Shop</Text>
              <Pressable onPress={() => setShowSwitcher(false)} hitSlop={8} className="h-8 w-8 rounded-full bg-surface-muted items-center justify-center">
                <X size={16} color="#0F172A" />
              </Pressable>
            </View>
            <Text className="text-[12px] text-text-muted mb-3">Choose which of your shops to manage.</Text>
            {shops.map((s) => {
              const active = s.id === session?.shopId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleSwitch(s.id)}
                  disabled={switching || active}
                  className="flex-row items-center py-3 px-3 rounded-2xl border mb-2"
                  style={{
                    backgroundColor: active ? '#F0FDF4' : '#FFFFFF',
                    borderColor: active ? GREEN : '#E5E7EB',
                  }}
                >
                  <View
                    className="h-9 w-9 rounded-2xl items-center justify-center mr-3"
                    style={{ backgroundColor: active ? GREEN : '#DCFCE7' }}
                  >
                    <Store size={16} color={active ? '#fff' : GREEN_DARK} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-extrabold"
                      style={{ color: active ? GREEN_DARK : '#0F172A' }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    <Text className="text-[11px] text-text-muted mt-0.5" numberOfLines={1}>{s.slug}</Text>
                  </View>
                  {active ? (
                    <View
                      className="h-7 w-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: '#DCFCE7' }}
                    >
                      <Check size={16} color={GREEN_DARK} />
                    </View>
                  ) : (
                    <ChevronRight size={16} color="#94A3B8" />
                  )}
                </Pressable>
              );
            })}
            {switching ? (
              <View className="flex-row items-center justify-center mt-2">
                <ActivityIndicator color={GREEN_DARK} />
                <Text className="text-[12px] text-text-muted ml-2">Switching…</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Notifications modal ────────────────────────────────── */}
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <Pressable
          onPress={() => setShowNotifications(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 28,
              minHeight: 240,
            }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Bell size={16} color="#0F172A" />
                <Text className="text-[17px] font-extrabold text-text ml-1.5">Notifications</Text>
                {notifUnread > 0 ? (
                  <View className="ml-2 rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEF3C7' }}>
                    <Text className="text-[10px] font-extrabold" style={{ color: '#B45309' }}>{notifUnread} new</Text>
                  </View>
                ) : null}
              </View>
              <View className="flex-row items-center">
                {notifUnread > 0 ? (
                  <Pressable onPress={onMarkAllRead} hitSlop={8} className="mr-2 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7' }}>
                    <Text className="text-[10.5px] font-extrabold" style={{ color: GREEN_DARK }}>Mark all read</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setShowNotifications(false)} hitSlop={8} className="h-8 w-8 rounded-full bg-surface-muted items-center justify-center">
                  <X size={16} color="#0F172A" />
                </Pressable>
              </View>
            </View>
            {notifLoading && notifs.length === 0 ? (
              <View className="py-8 items-center">
                <ActivityIndicator color={GREEN_DARK} />
                <Text className="text-[12px] text-text-muted mt-2">Loading notifications…</Text>
              </View>
            ) : notifs.length === 0 ? (
              <EmptyState
                icon={<Bell size={36} color={GREEN_DARK} />}
                title="You're all caught up"
                description={`Booking updates, payouts and team alerts for ${shopName} will appear here.`}
                className="py-8"
              />
            ) : (
              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {notifs.map((n, idx) => (
                  <Pressable
                    key={n.id}
                    onPress={() => onTapNotification(n)}
                    className="flex-row items-start py-3 active:opacity-80"
                    style={{
                      borderBottomWidth: idx === notifs.length - 1 ? 0 : 1,
                      borderColor: '#F1F5F9',
                    }}
                  >
                    <View
                      className="h-9 w-9 rounded-full items-center justify-center mr-3 mt-0.5"
                      style={{ backgroundColor: n.read ? '#F1F5F9' : '#DCFCE7' }}
                    >
                      <Bell size={16} color={n.read ? '#94A3B8' : GREEN_DARK} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text
                          className={`flex-1 text-[13.5px] ${n.read ? 'font-bold text-text-muted' : 'font-extrabold text-text'}`}
                          numberOfLines={1}
                        >
                          {n.title}
                        </Text>
                        {!n.read ? (
                          <View className="h-2 w-2 rounded-full ml-1" style={{ backgroundColor: '#F59E0B' }} />
                        ) : null}
                      </View>
                      {n.body ? (
                        <Text className="text-[11.5px] text-text-muted mt-0.5" numberOfLines={2}>
                          {n.body}
                        </Text>
                      ) : null}
                      <Text className="text-[10px] text-text-muted mt-1">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </Text>
                    </View>
                    <ChevronRight size={14} color="#94A3B8" style={{ marginTop: 8 }} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
