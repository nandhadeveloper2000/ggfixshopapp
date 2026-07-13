import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
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
  Search as SearchIcon,
  CircleCheck,
} from 'lucide-react-native';
import {
  SearchBar,
  EmptyState,
  Loader,
} from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import { getModelsByBrand } from '../../../api/masterData';

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

export default function BookingHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const numCols = winW >= 680 ? 2 : 1;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await ticketApi.get('/tickets', {
          query: {
            page: 0,
            size: 50,
            q: query || undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
          },
        });
        const content = Array.isArray(data) ? data : data?.content ?? data?.data ?? [];
        // Enrich each ticket with the model's catalog image and proper name —
        // tickets don't always carry deviceImageUrl / deviceDisplayName, but we
        // have brandId+modelId on every row.
        const brandIds = Array.from(new Set(content.map((t) => t.brandId).filter(Boolean)));
        const modelById = {};
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
          return {
            ...t,
            _modelName: m?.name || t.deviceDisplayName || t.modelName || null,
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
    [query, statusFilter],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => ({ total: items.length }), [items]);
  const activeFilters = (statusFilter !== 'ALL' ? 1 : 0) + (dateFilter ? 1 : 0);

  // Pad to an even count in 2-col mode so the last lone card stays half-width.
  const listData = numCols > 1 && items.length % 2 === 1
    ? [...items, { id: '__ghost__', _ghost: true }]
    : items;

  // ── Card row ──────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    if (item._ghost) return <View style={{ flex: 1, marginHorizontal: 0 }} />;
    const deviceName = item._modelName || item.deviceDisplayName || item.deviceModelName || item.modelName || 'Device';
    const deviceImage = item._modelImage || item.deviceImageUrl || null;
    const color = item.color;
    const trackingId = item.trackingId || (item.id ? item.id.slice(0, 8).toUpperCase() : '-');
    const statusMeta = STATUS_VARIANT[String(item.status || '').toUpperCase()] || { label: item.status || 'Pending', tone: 'amber' };
    const customerName = item.customerName || item.customerFullName || item.customer?.name || '-';
    const phone = item.customerPhone || item.customer?.phone || '';
    const services = item.repairServicesSummary || (item.services?.map?.((s) => s.serviceName).join(', ')) || '';
    const tone = TONE_STYLE[statusMeta.tone] || TONE_STYLE.amber;

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
        {/* Top row: image + name/tracking + status pill */}
        <View className="flex-row items-start">
          <View className="h-14 w-14 rounded-2xl bg-success/10 items-center justify-center mr-3 overflow-hidden">
            {deviceImage ? (
              <Image source={{ uri: deviceImage }} style={{ width: 56, height: 56 }} resizeMode="cover" />
            ) : (
              <Smartphone size={24} color={ACCENT_GREEN} />
            )}
          </View>
          <View className="flex-1 pr-2">
            <View className="flex-row items-center mb-0.5">
              <View
                className="rounded-md px-1.5 py-0.5 mr-1.5"
                style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)' }}
              >
                <Text className="text-[9.5px] font-extrabold" style={{ color: ACCENT_GREEN }}>
                  #{trackingId}
                </Text>
              </View>
            </View>
            <Text className="text-[14px] font-extrabold text-text" numberOfLines={1}>{deviceName}</Text>
            {color ? (
              <Text className="text-[10.5px] text-text-muted mt-0.5" numberOfLines={1}>Color: {color}</Text>
            ) : null}
          </View>
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
          >
            <Text className="text-[9.5px] font-extrabold" style={{ color: tone.fg }}>
              {statusMeta.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Divider + detail rows */}
        <View className="h-px bg-border my-2.5" />
        <Row icon={<User size={11} color="#64748B" />} label="Customer" value={customerName} />
        {phone ? <Row icon={<Phone size={11} color="#64748B" />} label="Mobile" value={phone} /> : null}
        {services ? <Row icon={<Wrench size={11} color="#64748B" />} label="Services" value={services} /> : null}

        {/* Footer CTA */}
        <View className="flex-row items-center justify-end mt-2">
          <Text className="text-[11px] font-extrabold mr-0.5" style={{ color: ACCENT_GREEN }}>View details</Text>
          <ChevronRight size={13} color={ACCENT_GREEN} />
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* ── White header ─────────────────────────────────── */}
      <View
        className="border-b border-border"
        style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 16 }}
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
            <Text className="text-text text-[19px] font-extrabold mt-0.5" numberOfLines={1}>
              {counts.total} {counts.total === 1 ? 'booking' : 'bookings'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Search + filter row below header ────────────────── */}
      <View className="px-4" style={{ marginTop: 12 }}>
        <View
          className="bg-card rounded-2xl p-2.5"
          style={{
            shadowColor: '#0F172A',
            shadowOpacity: 0.10,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}
        >
          <View className="flex-row items-center">
            <View className="flex-1 mr-2">
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search Tracking ID, name, mobile…"
                onClear={() => setQuery('')}
              />
            </View>
            <Pressable
              onPress={() => setShowFilters((v) => !v)}
              className="h-10 px-3 rounded-2xl items-center justify-center flex-row active:opacity-80"
              style={{
                backgroundColor: showFilters || activeFilters > 0 ? ACCENT_GREEN : '#F1F5F9',
                borderWidth: showFilters || activeFilters > 0 ? 0 : 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Filter size={14} color={showFilters || activeFilters > 0 ? '#fff' : '#0F172A'} />
              {activeFilters > 0 ? (
                <View className="ml-1 px-1.5 rounded-full" style={{ backgroundColor: '#fff' }}>
                  <Text className="text-[10px] font-extrabold" style={{ color: ACCENT_GREEN }}>
                    {activeFilters}
                  </Text>
                </View>
              ) : (
                <Text className="text-[12px] font-extrabold ml-1 text-text">Filters</Text>
              )}
            </Pressable>
          </View>

          {/* Active filter chips row */}
          {activeFilters > 0 ? (
            <View className="flex-row flex-wrap mt-2">
              {statusFilter !== 'ALL' ? (
                <Pressable
                  onPress={() => setStatusFilter('ALL')}
                  className="flex-row items-center rounded-full pl-2.5 pr-1.5 py-1 mr-2 active:opacity-80"
                  style={{ backgroundColor: ACCENT_GREEN }}
                >
                  <Text className="text-white text-[10px] font-extrabold mr-1">
                    {STATUS_FILTERS.find((f) => f.key === statusFilter)?.label}
                  </Text>
                  <X size={10} color="#fff" />
                </Pressable>
              ) : null}
              {dateFilter ? (
                <Pressable
                  onPress={() => setDateFilter(null)}
                  className="flex-row items-center rounded-full pl-2.5 pr-1.5 py-1 mr-2 active:opacity-80"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  <Text className="text-white text-[10px] font-extrabold mr-1">{dateFilter}</Text>
                  <X size={10} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Expanded filter panel */}
          {showFilters ? (
            <View
              className="rounded-2xl p-3 mt-2"
              style={{ backgroundColor: 'rgba(22, 163, 74, 0.05)', borderWidth: 1, borderColor: 'rgba(22, 163, 74, 0.25)' }}
            >
              <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mb-2">
                BOOKING STATUS
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
                {STATUS_FILTERS.map((s) => (
                  <FilterPill
                    key={s.key}
                    label={s.label}
                    active={statusFilter === s.key}
                    onPress={() => setStatusFilter(s.key)}
                  />
                ))}
              </ScrollView>

              <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mb-2">
                BOOKING TIME
              </Text>
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

              <View className="flex-row mt-3">
                <Pressable
                  onPress={() => { setStatusFilter('ALL'); setDateFilter(null); setQuery(''); setShowFilters(false); }}
                  className="flex-1 mr-1.5 py-2.5 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' }}
                >
                  <Text className="text-[12px] font-extrabold text-text">Clear all</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowFilters(false); load(true); }}
                  className="flex-1 ml-1.5 rounded-xl active:opacity-90 overflow-hidden"
                >
                  <LinearGradient
                    colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  >
                    <CircleCheck size={13} color="#fff" />
                    <Text className="text-[12px] font-extrabold text-white ml-1.5">Apply</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
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
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState
              icon={<ClipboardList size={26} color={ACCENT_GREEN} />}
              title="No bookings found"
              description={query || statusFilter !== 'ALL' || dateFilter ? 'Try clearing filters.' : 'Bookings will appear here as they are created.'}
              actionLabel={query || statusFilter !== 'ALL' || dateFilter ? 'Clear filters' : null}
              onAction={() => { setQuery(''); setStatusFilter('ALL'); setDateFilter(null); }}
            />
          }
        />
      )}
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
