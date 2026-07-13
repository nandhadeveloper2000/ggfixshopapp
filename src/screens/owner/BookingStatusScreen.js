import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ClipboardCheck,
  HardHat,
  Wrench,
  CheckCircle2,
  Truck,
  RotateCcw,
  AlertTriangle,
  PackageCheck,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  Calendar,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { Loader } from '../../components/rnr';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.10,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

// Status tile config — each tile gets a two-stop gradient (light → dark of the
// same hue) to give a Swiggy/Zomato glassmorphic feel instead of flat blocks.
// statusList maps to the canonical backend status values used to query
// /tickets?status= on the report screen.
const TILES = [
  {
    key: 'SERVICE_ACCEPTED',
    label: 'Service Accepted',
    statusList: ['CREATED'],
    countKey: 'CREATED',
    gradient: ['#60A5FA', '#2563EB'],   // sky-400 → blue-600
    icon: ClipboardCheck,
    accent: '#2563EB',
  },
  {
    key: 'TECHNICIAN_ASSIGNED',
    label: 'Technician Assigned',
    statusList: ['ASSIGNED'],
    countKey: 'ASSIGNED',
    gradient: ['#7C3AED', '#4C1D95'],   // violet-600 → violet-900
    icon: HardHat,
    accent: '#7C3AED',
  },
  {
    key: 'IN_SERVICE_PROCESS',
    label: 'In Service Process',
    statusList: ['IN_DIAGNOSIS', 'IN_REPAIR'],
    gradient: ['#475569', '#1E293B'],   // slate-600 → slate-800
    icon: Wrench,
    accent: '#475569',
  },
  {
    key: 'WORK_COMPLETED',
    label: 'Work Completed',
    statusList: ['READY'],
    countKey: 'READY',
    gradient: ['#34D399', '#059669'],   // emerald-400 → emerald-600
    icon: CheckCircle2,
    accent: '#059669',
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    statusList: ['DELIVERED_PROCESSING'],
    countKey: 'DELIVERED_PROCESSING',
    gradient: ['#5EEAD4', '#0D9488'],   // teal-300 → teal-600
    icon: Truck,
    accent: '#0D9488',
  },
  {
    key: 'RE_ASSIGN_TECHNICIAN',
    label: 'Re-Assign Technician',
    statusList: ['REASSIGNED'],
    countKey: 'REASSIGNED',
    gradient: ['#FB923C', '#DC2626'],   // orange-400 → red-600
    icon: RotateCcw,
    accent: '#DC2626',
  },
  {
    key: 'WORK_PENDING',
    label: 'Work Pending',
    statusList: ['QUOTED', 'APPROVED'],
    gradient: ['#F87171', '#B91C1C'],   // red-400 → red-700
    icon: AlertTriangle,
    accent: '#B91C1C',
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    statusList: ['DELIVERED'],
    countKey: 'DELIVERED',
    gradient: ['#86EFAC', '#15803D'],   // green-300 → green-700
    icon: PackageCheck,
    accent: '#15803D',
  },
];

function sumKeys(counts, keys) {
  return keys.reduce((acc, k) => acc + Number(counts?.[k] || 0), 0);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function BookingStatusScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await ticketApi.get('/tickets/counts');
      setCounts(data || {});
    } catch (e) {
      setError(e.message || 'Failed to load counts');
      setCounts({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthLabel = useMemo(
    () => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    [],
  );

  const totals = useMemo(() => {
    const total = Number(counts?.total || 0);
    const active = sumKeys(counts, ['CREATED', 'ASSIGNED', 'IN_DIAGNOSIS', 'IN_REPAIR', 'QUOTED', 'APPROVED']);
    const closed = sumKeys(counts, ['DELIVERED']);
    return { total, active, closed };
  }, [counts]);

  if (loading) return <Loader label="Loading status..." />;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Slim top header */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            <ChevronLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text className="flex-1 text-text text-[17px] font-extrabold" numberOfLines={1}>
            Booking Status
          </Text>
          <Pressable
            onPress={() => navigation.navigate('BookingPreviousReport')}
            className="px-3 py-1.5 rounded-full flex-row items-center"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            <History size={12} color="#0F172A" />
            <Text className="text-text text-[11px] font-extrabold ml-1.5" numberOfLines={1}>
              Previous
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={BRAND_GREEN_DARK}
            colors={[BRAND_GREEN_DARK]}
          />
        }
      >
        {/* Previous Reports banner — Swiggy/Zomato-style gradient card at
            the top so the report archive is one tap away. */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <Pressable
            onPress={() => navigation.navigate('BookingPreviousReport')}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={[cardShadow, { borderRadius: 18, overflow: 'hidden' }]}
          >
            <LinearGradient
              colors={['#15803D', '#22C55E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <History size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-white text-[14.5px] font-extrabold" style={{ letterSpacing: 0.1 }}>
                    Previous Reports
                  </Text>
                  <View
                    className="ml-2 px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
                  >
                    <Text className="text-white text-[9.5px] font-extrabold" style={{ letterSpacing: 0.5 }}>
                      ARCHIVE
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-[11.5px] font-semibold mt-0.5"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                  numberOfLines={1}
                >
                  Browse month-by-month status snapshots
                </Text>
              </View>
              <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
              >
                <ChevronRight size={18} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Compact title row */}
        <View className="flex-row items-end justify-between px-5 mt-4 mb-3">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Sparkles size={12} color={BRAND_GREEN_DARK} />
              <Text
                className="ml-1 text-[10.5px] font-bold"
                style={{ color: BRAND_GREEN_DARK, letterSpacing: 1 }}
              >
                {monthLabel.toUpperCase()}
              </Text>
            </View>
            <Text className="text-[18px] font-extrabold text-gray-900 mt-0.5" style={{ letterSpacing: -0.3 }}>
              This month at a glance
            </Text>
          </View>
        </View>

        {/* KPI strip */}
        <View className="px-4">
          <View
            className="bg-white rounded-2xl flex-row p-4"
            style={cardShadow}
          >
            <KpiCell
              icon={Activity}
              tint="#DCFCE7"
              accent={BRAND_GREEN_DARK}
              label="TOTAL"
              value={totals.total}
            />
            <View className="w-px self-stretch mx-2" style={{ backgroundColor: '#F1F5F9' }} />
            <KpiCell
              icon={TrendingUp}
              tint="#FEF3C7"
              accent="#B45309"
              label="ACTIVE"
              value={totals.active}
            />
            <View className="w-px self-stretch mx-2" style={{ backgroundColor: '#F1F5F9' }} />
            <KpiCell
              icon={CheckCircle2}
              tint="#DBEAFE"
              accent="#1D4ED8"
              label="DELIVERED"
              value={totals.closed}
            />
          </View>
        </View>

        {/* Section header */}
        <View className="flex-row items-end justify-between px-5 mt-5 mb-3">
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-gray-900" style={{ letterSpacing: -0.2 }}>
              Booking status summary
            </Text>
            <Text className="text-[11.5px] text-gray-500 mt-0.5">
              Tap a status to open the detailed report
            </Text>
          </View>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: '#DCFCE7' }}
          >
            <Text
              className="text-[10.5px] font-extrabold"
              style={{ color: BRAND_GREEN_DARK }}
            >
              {TILES.length} statuses
            </Text>
          </View>
        </View>

        {error ? (
          <View className="px-4 pb-3">
            <View
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
            >
              <Text className="text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>
                {error}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tile grid — Swiggy-style gradient cards */}
        <View className="flex-row flex-wrap" style={{ paddingHorizontal: 10 }}>
          {TILES.map((t) => {
            const Icon = t.icon;
            const value = t.countKey
              ? Number(counts?.[t.countKey] || 0)
              : sumKeys(counts, t.statusList);
            return (
              <View key={t.key} style={{ width: '50%', padding: 6 }}>
                <Pressable
                  onPress={() =>
                    navigation.navigate('BookingStatusReport', {
                      statusKey: t.key,
                      label: t.label,
                      statusList: t.statusList,
                      bg: t.accent,
                      icon: t.key,
                    })
                  }
                  android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
                  style={[cardShadow, { borderRadius: 22, overflow: 'hidden' }]}
                >
                  <LinearGradient
                    colors={t.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 14,
                      paddingTop: 14,
                      paddingBottom: 16,
                      minHeight: 160,
                      position: 'relative',
                    }}
                  >
                    {/* Decorative blob */}
                    <View
                      style={{
                        position: 'absolute',
                        right: -28,
                        top: -28,
                        width: 100,
                        height: 100,
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.10)',
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        left: -20,
                        bottom: -30,
                        width: 80,
                        height: 80,
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                      }}
                    />

                    {/* Top row: glass icon + count badge */}
                    <View className="flex-row items-start justify-between">
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: 'rgba(255,255,255,0.22)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.30)',
                        }}
                      >
                        <Icon size={22} color="#FFFFFF" strokeWidth={2.4} />
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: '#FFFFFF',
                          minWidth: 40,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          className="font-extrabold"
                          style={{ color: t.accent, fontSize: 13, letterSpacing: -0.2 }}
                        >
                          {pad2(value)}
                        </Text>
                      </View>
                    </View>

                    {/* Label */}
                    <Text
                      className="text-white text-[14px] font-extrabold mt-auto"
                      numberOfLines={2}
                      style={{ marginTop: 18, letterSpacing: -0.1 }}
                    >
                      {t.label}
                    </Text>

                    {/* Footer hint */}
                    <View className="flex-row items-center mt-2">
                      <Text className="text-white/85 text-[10.5px] font-bold">View report</Text>
                      <ChevronRight size={12} color="rgba(255,255,255,0.9)" />
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

function KpiCell({ icon: Icon, tint, accent, label, value }) {
  return (
    <View className="flex-1 items-center">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Icon size={16} color={accent} strokeWidth={2.4} />
      </View>
      <Text
        className="text-[20px] font-extrabold"
        style={{ color: accent, letterSpacing: -0.4 }}
      >
        {value}
      </Text>
      <Text
        className="text-[9.5px] font-extrabold mt-0.5"
        style={{ color: '#94A3B8', letterSpacing: 1 }}
      >
        {label}
      </Text>
    </View>
  );
}

export const STATUS_TILE_META = TILES.reduce((acc, t) => {
  acc[t.key] = t;
  return acc;
}, {});
