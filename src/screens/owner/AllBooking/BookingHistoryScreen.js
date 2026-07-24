import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone,
  ChevronRight,
  Filter,
  Phone,
  Wrench,
  ClipboardList,
  X,
  ArrowLeft,
  User,
  CircleCheck,
  Calendar,
  Clock,
  Truck,
  FileText,
} from 'lucide-react-native';
import {
  SearchBar,
  EmptyState,
  Loader,
} from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import { getModelsByBrand, getRamOptions, getStorageOptions, parseModelNumbers } from '../../../api/masterData';

// Swiggy / Zomato green palette — same as the booking-flow screens.
const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

// Status → label + tinted background colour for the badge. The status family
// (warning / primary / success / danger) decides the colour without bringing
// back the legacy Badge component which doesn't match the green theme.
const STATUS_VARIANT = {
  CREATED:              { label: 'Service Accepted',     tone: 'amber' },
  ASSIGNED:             { label: 'Technician Assigned',  tone: 'blue' },
  IN_DIAGNOSIS:         { label: 'In Diagnosis',         tone: 'purple' },
  IN_REPAIR:            { label: 'In Service Process',   tone: 'purple' },
  QUOTED:               { label: 'Re-Estimated',         tone: 'amber' },
  APPROVED:             { label: 'Customer Approved',    tone: 'blue' },
  READY:                { label: 'Ready for Delivery',   tone: 'green' },
  INVOICE_GENERATED:    { label: 'Invoice Generated',    tone: 'amber' },
  INVOICE_READY:        { label: 'Invoice Ready',        tone: 'amber' },
  DELIVERED_PROCESSING: { label: 'Delivered Processing', tone: 'amber' },
  DELIVERED:            { label: 'Delivered',            tone: 'green' },
  CANCELLED:            { label: 'Cancelled',            tone: 'red' },
  RETURNED:             { label: 'Returned',             tone: 'red' },
};

const TONE_STYLE = {
  amber:  { bg: 'rgba(245, 158, 11, 0.12)', fg: '#B45309', border: 'rgba(245, 158, 11, 0.35)' },
  blue:   { bg: 'rgba(59, 130, 246, 0.12)', fg: '#1D4ED8', border: 'rgba(59, 130, 246, 0.35)' },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', fg: '#6D28D9', border: 'rgba(168, 85, 247, 0.35)' },
  green:  { bg: 'rgba(22, 163, 74, 0.12)',  fg: BRAND_GREEN_DARK, border: 'rgba(22, 163, 74, 0.35)' },
  red:    { bg: 'rgba(239, 68, 68, 0.12)',  fg: '#B91C1C', border: 'rgba(239, 68, 68, 0.35)' },
};

// Quick status tabs shown below the search bar — each is a group of raw
// statuses. Tapping one filters the list to that group; the count is derived
// live from the loaded bookings so the numbers always match what's on screen.
const TABS = [
  { key: 'ALL',         label: 'All Bookings', icon: FileText,    color: ACCENT_GREEN, bg: '#DCFCE7' },
  { key: 'IN_PROGRESS', label: 'In Progress',  icon: Clock,       color: '#2563EB',    bg: '#DBEAFE' },
  { key: 'PICKUP',      label: 'Pickup',       icon: Truck,       color: '#7C3AED',    bg: '#EDE9FE' },
  { key: 'COMPLETED',   label: 'Completed',    icon: CircleCheck, color: ACCENT_GREEN, bg: '#DCFCE7' },
];

const STATUS_FILTERS = [
  { key: 'ALL',                  label: 'All' },
  { key: 'CREATED',              label: 'Accepted' },
  { key: 'IN_REPAIR',            label: 'In Service' },
  { key: 'READY',                label: 'Ready' },
  { key: 'INVOICE_GENERATED',    label: 'Invoice' },
  { key: 'INVOICE_READY',        label: 'Invoice Ready' },
  { key: 'DELIVERED_PROCESSING', label: 'Delivering' },
  { key: 'DELIVERED',            label: 'Delivered' },
  { key: 'CANCELLED',            label: 'Cancelled' },
];

const DATE_FILTERS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last 3 Months', 'Last 6 Months'];

// ── Grouping helpers (drive the tab counts + tab filtering) ───────────────
function isPickup(t) {
  const st = String(t.status || '').toUpperCase();
  return t.serviceMode === 'PICKUP' || st.startsWith('PICKUP');
}
function groupOf(t) {
  if (isPickup(t)) return 'PICKUP';
  return String(t.status || '').toUpperCase() === 'DELIVERED' ? 'COMPLETED' : 'IN_PROGRESS';
}

// Client-side date-range filter (createdAt vs the chosen chip).
function inDateRange(d, filter) {
  if (!filter || !d) return true;
  const date = new Date(d);
  if (isNaN(date.getTime())) return true;
  const now = new Date();
  const startOfDay = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y; };
  const today = startOfDay(now);
  const dDay = startOfDay(date);
  const DAY = 86400000;
  switch (filter) {
    case 'Today':         return dDay.getTime() === today.getTime();
    case 'Yesterday':     return dDay.getTime() === today.getTime() - DAY;
    case 'This Week':     { const wk = new Date(today); wk.setDate(today.getDate() - today.getDay()); return date >= wk; }
    case 'This Month':    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    case 'Last 3 Months': { const m = new Date(today); m.setMonth(today.getMonth() - 3); return date >= m; }
    case 'Last 6 Months': { const m = new Date(today); m.setMonth(today.getMonth() - 6); return date >= m; }
    default: return true;
  }
}

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function BookingHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const numCols = winW >= 680 ? 2 : 1;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('ALL');            // quick group filter
  const [statusFilter, setStatusFilter] = useState('ALL'); // detailed status (panel)
  const [dateFilter, setDateFilter] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all bookings (search server-side; status/date/tab filtering happens
  // client-side so the tab counts always reflect the full result set).
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await ticketApi.get('/tickets', {
          query: { page: 0, size: 50, q: query || undefined },
        });
        const content = Array.isArray(data) ? data : data?.content ?? data?.data ?? [];
        // Enrich each ticket with the model's catalog image and proper name —
        // tickets don't always carry deviceImageUrl / deviceDisplayName, but we
        // have brandId+modelId on every row.
        const brandIds = Array.from(new Set(content.map((t) => t.brandId).filter(Boolean)));
        const modelById = {};
        // Master RAM/Storage options so the ticket's option UUIDs can be shown as
        // human labels ("8 GB" / "128 GB") on the card's RAM · Storage line.
        const [ramOpts, storageOpts] = await Promise.all([
          getRamOptions().catch(() => []),
          getStorageOptions().catch(() => []),
        ]);
        const ramById = {}; (ramOpts || []).forEach((r) => { ramById[r.id] = r.label; });
        const storageById = {}; (storageOpts || []).forEach((s) => { storageById[s.id] = s.label; });
        if (brandIds.length) {
          await Promise.all(brandIds.map(async (bId) => {
            try {
              const models = await getModelsByBrand(bId);
              (models || []).forEach((m) => { modelById[m.id] = m; });
            } catch (_) {}
          }));
        }
        const enriched = content.map((t) => {
          const m = t.modelId ? modelById[t.modelId] : null;
          const modelUrl = m?.imageUrl || (m?.imageBase64 ? `data:image/png;base64,${m.imageBase64}` : null);
          const ramLabel = t.ramOptionId ? ramById[t.ramOptionId] : null;
          const storageLabel = t.storageOptionId ? storageById[t.storageOptionId] : null;
          return {
            ...t,
            _modelName: m?.name || t.deviceDisplayName || t.modelName || null,
            _modelNumber: parseModelNumbers(m?.modelNumber).join(' · ') || null,
            _ramStorage: [ramLabel, storageLabel].filter(Boolean).join(' + ') || null,
            _modelImage: t.deviceImageUrl || modelUrl || null,
          };
        });
        setItems(enriched);
      } catch (e) {
        setError(e.message || 'Failed to load bookings');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live tab counts from the loaded set.
  const counts = useMemo(() => {
    let inProgress = 0, pickup = 0, completed = 0;
    for (const t of items) {
      const g = groupOf(t);
      if (g === 'PICKUP') pickup++;
      else if (g === 'COMPLETED') completed++;
      else inProgress++;
    }
    return { ALL: items.length, IN_PROGRESS: inProgress, PICKUP: pickup, COMPLETED: completed };
  }, [items]);

  // Apply tab group + detailed status + date filters, all client-side.
  const visible = useMemo(() => items.filter((t) => {
    if (tab !== 'ALL' && groupOf(t) !== tab) return false;
    if (statusFilter !== 'ALL' && String(t.status || '').toUpperCase() !== statusFilter) return false;
    if (dateFilter && !inDateRange(t.createdAt, dateFilter)) return false;
    return true;
  }), [items, tab, statusFilter, dateFilter]);

  const activeFilters = (statusFilter !== 'ALL' ? 1 : 0) + (dateFilter ? 1 : 0);

  // Selecting a tab is the primary quick filter — clear the detailed status so
  // the two status controls never silently intersect to an empty list.
  const selectTab = (key) => { setTab(key); setStatusFilter('ALL'); };

  // Pad to an even count in 2-col mode so the last lone card stays half-width.
  const listData = numCols > 1 && visible.length % 2 === 1
    ? [...visible, { id: '__ghost__', _ghost: true }]
    : visible;

  // ── Card row ──────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    if (item._ghost) return <View style={{ flex: 1, marginHorizontal: 0 }} />;
    const deviceName = item._modelName || item.deviceDisplayName || item.deviceModelName || item.modelName || 'Device';
    const deviceImage = item._modelImage || item.deviceImageUrl || null;
    const specs = [item._modelNumber, item._ramStorage].filter(Boolean).join(' · ');
    const color = item.color;
    const trackingId = item.trackingId || (item.id ? item.id.slice(0, 8).toUpperCase() : '-');
    const statusMeta = STATUS_VARIANT[String(item.status || '').toUpperCase()] || { label: item.status || 'Pending', tone: 'amber' };
    const customerName = item.customerName || item.customerFullName || item.customer?.name || '-';
    const phone = item.customerPhone || item.customer?.phone || '';
    const services = item.repairServicesSummary || (item.services?.map?.((s) => s.serviceName).join(', ')) || '';
    const tone = TONE_STYLE[statusMeta.tone] || TONE_STYLE.amber;
    const dateStr = formatDate(item.createdAt);
    const timeStr = formatTime(item.createdAt);

    return (
      <Pressable
        onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })}
        className="bg-card rounded-2xl mb-3 active:opacity-90"
        style={{
          flex: numCols > 1 ? 1 : undefined,
          padding: 12,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#0F172A',
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        {/* Top: image + info (left) + status/date/time (right) */}
        <View className="flex-row items-start">
          <View className="h-16 w-16 rounded-2xl bg-success/10 items-center justify-center mr-3 overflow-hidden">
            {deviceImage ? (
              <Image source={{ uri: deviceImage }} style={{ width: 64, height: 64 }} resizeMode="cover" />
            ) : (
              <Smartphone size={26} color={ACCENT_GREEN} />
            )}
          </View>

          <View className="flex-1 flex-row">
            {/* left info column */}
            <View className="flex-1 pr-2">
              <View className="self-start rounded-md px-1.5 py-0.5 mb-1" style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)' }}>
                <Text className="text-[9.5px] font-extrabold" style={{ color: ACCENT_GREEN }}>#{trackingId}</Text>
              </View>
              <Text className="text-[14.5px] font-extrabold text-text" numberOfLines={1}>{deviceName}</Text>
              {specs ? (
                <Text className="text-[10.5px] text-text-muted mt-0.5" numberOfLines={1}>{specs}</Text>
              ) : null}
              {color ? (
                <Text className="text-[10.5px] text-text-muted mt-0.5" numberOfLines={1}>Color: {color}</Text>
              ) : null}
            </View>

            {/* right meta column: status pill, then date + time */}
            <View className="items-end" style={{ maxWidth: 118 }}>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
              >
                <Text className="text-[9px] font-extrabold" style={{ color: tone.fg }} numberOfLines={1}>
                  {statusMeta.label.toUpperCase()}
                </Text>
              </View>
              {dateStr ? (
                <View className="flex-row items-center mt-2">
                  <Calendar size={11} color="#64748B" />
                  <Text className="text-[10.5px] text-text-muted font-semibold ml-1">{dateStr}</Text>
                </View>
              ) : null}
              {timeStr ? (
                <Text className="text-[10.5px] text-text-muted mt-0.5">{timeStr}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Divider + detail rows */}
        <View className="h-px bg-border my-2.5" />
        <Row icon={<User size={11} color="#64748B" />} label="Customer" value={customerName} />
        {phone ? <Row icon={<Phone size={11} color="#64748B" />} label="Mobile" value={phone} /> : null}

        {/* Services + View details on the same footer line */}
        <View className="flex-row items-center mt-1">
          <View className="flex-1 flex-row items-center pr-2">
            <View className="w-4 items-center mr-1.5"><Wrench size={11} color="#64748B" /></View>
            <Text className="text-[10px] text-text-muted w-16">Services</Text>
            <Text className="text-[11.5px] text-text flex-1 font-semibold" numberOfLines={1}>{services || '—'}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[11px] font-extrabold mr-0.5" style={{ color: ACCENT_GREEN }}>View details</Text>
            <ChevronRight size={13} color={ACCENT_GREEN} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* ── White header: back + title + Filters button ──────────── */}
      <View
        className="border-b border-border"
        style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 16 }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            className="h-10 w-10 rounded-full bg-surface-muted items-center justify-center mr-3 active:opacity-70"
          >
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-text-muted text-[11px] font-bold tracking-widest">ALL BOOKINGS</Text>
            <Text className="text-text text-[20px] font-extrabold mt-0.5" numberOfLines={1}>
              {counts.ALL} {counts.ALL === 1 ? 'Booking' : 'Bookings'}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            className="flex-row items-center rounded-full px-3.5 py-2 active:opacity-80"
            style={{ backgroundColor: showFilters || activeFilters > 0 ? ACCENT_GREEN : '#ECFDF3' }}
          >
            <Filter size={15} color={showFilters || activeFilters > 0 ? '#fff' : ACCENT_GREEN} />
            <Text
              className="text-[13px] font-extrabold ml-1.5"
              style={{ color: showFilters || activeFilters > 0 ? '#fff' : ACCENT_GREEN }}
            >
              Filters
            </Text>
            {activeFilters > 0 ? (
              <View className="ml-1.5 px-1.5 rounded-full" style={{ backgroundColor: '#fff' }}>
                <Text className="text-[10px] font-extrabold" style={{ color: ACCENT_GREEN }}>{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* ── Full-width search bar ────────────────────────────────── */}
      <View className="px-4" style={{ marginTop: 12 }}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search by Tracking ID, Customer name, Mobile…"
          onClear={() => setQuery('')}
        />
      </View>

      {/* ── Status count row (icon + count, fixed row of 4) ──────── */}
      <View className="flex-row" style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 2 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => selectTab(t.key)}
              className="flex-1 flex-row items-center justify-center rounded-2xl mx-1 active:opacity-80"
              style={{
                paddingVertical: 10,
                backgroundColor: active ? '#F0FDF4' : '#FFFFFF',
                borderWidth: 1.5,
                borderColor: active ? ACCENT_GREEN : '#E5E7EB',
              }}
            >
              <View className="h-7 w-7 rounded-full items-center justify-center mr-1.5" style={{ backgroundColor: t.bg }}>
                <Icon size={15} color={t.color} strokeWidth={2.3} />
              </View>
              <Text className="text-[16px] font-extrabold text-text">{counts[t.key] ?? 0}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View className="mx-4 mt-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.10)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.35)' }}
        >
          <Text className="text-[12px] text-danger font-bold">{error}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <Loader label="Loading bookings..." />
      ) : (
        <FlatList
          data={listData}
          key={numCols}
          numColumns={numCols}
          columnWrapperStyle={numCols > 1 ? { gap: 12 } : undefined}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={ACCENT_GREEN} colors={[ACCENT_GREEN]} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState
              icon={<ClipboardList size={26} color={ACCENT_GREEN} />}
              title="No bookings found"
              description={query || tab !== 'ALL' || statusFilter !== 'ALL' || dateFilter ? 'Try clearing filters.' : 'Bookings will appear here as they are created.'}
              actionLabel={query || tab !== 'ALL' || statusFilter !== 'ALL' || dateFilter ? 'Clear filters' : null}
              onAction={() => { setQuery(''); setTab('ALL'); setStatusFilter('ALL'); setDateFilter(null); }}
            />
          }
        />
      )}

      {/* ── Filter popup (modal, slides up from bottom) ──────────── */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilters(false)} />
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[16px] font-extrabold text-text">Filters</Text>
              <Pressable
                onPress={() => setShowFilters(false)}
                hitSlop={8}
                className="h-8 w-8 rounded-full items-center justify-center"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                <X size={16} color="#0F172A" />
              </Pressable>
            </View>

            <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mb-2">BOOKING STATUS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
              {STATUS_FILTERS.map((s) => (
                <FilterPill
                  key={s.key}
                  label={s.label}
                  active={statusFilter === s.key}
                  onPress={() => { setStatusFilter(s.key); setTab('ALL'); }}
                />
              ))}
            </ScrollView>

            <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mb-2">BOOKING TIME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {DATE_FILTERS.map((d) => (
                <FilterPill
                  key={d}
                  label={d}
                  active={dateFilter === d}
                  onPress={() => setDateFilter(dateFilter === d ? null : d)}
                />
              ))}
            </ScrollView>

            <View className="flex-row mt-4">
              <Pressable
                onPress={() => { setStatusFilter('ALL'); setDateFilter(null); setTab('ALL'); setQuery(''); }}
                className="flex-1 mr-1.5 py-3 rounded-xl items-center active:opacity-70"
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' }}
              >
                <Text className="text-[13px] font-extrabold text-text">Clear all</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFilters(false)}
                className="flex-1 ml-1.5 rounded-xl active:opacity-90 overflow-hidden"
              >
                <LinearGradient
                  colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  <CircleCheck size={14} color="#fff" />
                  <Text className="text-[13px] font-extrabold text-white ml-1.5">Apply</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function Row({ icon, label, value, numberOfLines }) {
  return (
    <View className="flex-row items-center py-0.5">
      <View className="w-4 items-center mr-1.5">{icon}</View>
      <Text className="text-[10px] text-text-muted w-16">{label}</Text>
      <Text className="text-[11.5px] text-text flex-1 font-semibold" numberOfLines={numberOfLines || 1}>{value}</Text>
    </View>
  );
}

function FilterPill({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-1 px-3 py-1.5 rounded-full active:opacity-80"
      style={{
        backgroundColor: active ? ACCENT_GREEN : '#fff',
        borderWidth: 1,
        borderColor: active ? ACCENT_GREEN : '#E5E7EB',
        shadowColor: active ? ACCENT_GREEN : 'transparent',
        shadowOpacity: active ? 0.20 : 0,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: active ? 2 : 0,
      }}
    >
      <Text
        className="text-[11.5px] font-extrabold"
        style={{ color: active ? '#fff' : '#475569' }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
