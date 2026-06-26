import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listShopRepairBookings } from '../../api/orders';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FILTERS = ['All', 'Completed', 'In Process', 'Pending'];

// Map raw booking.status / latest-event status into a UI bucket the cards key off.
function bucketize(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('COMPLETE') || s === 'DELIVERED' || s === 'CLOSED') return 'COMPLETED';
  if (s.includes('PENDING') || s.includes('AWAIT') || s === 'SPARE_ORDERED') return 'PENDING';
  if (
    s.includes('IN_SERVICE')
    || s.includes('IN_PROCESS')
    || s.includes('STARTED')
    || s === 'SERVICE_ACCEPTED'
    || s === 'ASSIGNED'
    || s === 'CONFIRMED'
    || s === 'PICKUP_SCHEDULED'
  ) return 'IN_PROCESS';
  return 'IN_PROCESS';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(instant) {
  if (!instant) return '—';
  return new Date(instant).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Compose a "device" line out of the brand/model/RAM/storage fields the booking carries.
function deviceLine(b) {
  const parts = [];
  if (b.modelName) parts.push(b.modelName);
  else if (b.brandName) parts.push(b.brandName);
  if (b.ramLabel || b.storageLabel) {
    parts.push(`${b.ramLabel || ''}${b.ramLabel && b.storageLabel ? ' / ' : ''}${b.storageLabel || ''}`.trim());
  }
  if (b.issueSummary) parts.push(b.issueSummary);
  return parts.join(' - ') || 'Repair booking';
}

function trackingId(b) {
  return b.trackingId || b.ticketCode || `CSPEN${String(b.id || '').replace(/[^0-9]/g, '').slice(0, 8) || '——'}`;
}

export default function OwnerEmployeeWorkingRecordScreen({ route, navigation }) {
  const employee = route.params?.employee;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const all = await listShopRepairBookings();
      setList(Array.isArray(all) ? all : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Keep only bookings actually assigned to this employee. The order-service
  // currently exposes `assignedPickupPersonId` (UUID) for pickup persons and
  // a denormalized `technicianName` string for service technicians, so we
  // match on either path. (Adding a proper `assignedTechnicianId` column on
  // repair_bookings would let this become a server-side filter.)
  const mineAll = useMemo(() => {
    if (!employee?.id) return [];
    return list.filter((b) => {
      if (b.assignedPickupPersonId === employee.id) return true;
      if (b.technicianName && employee.name && b.technicianName.trim() === employee.name.trim()) return true;
      return false;
    });
  }, [list, employee?.id, employee?.name]);

  // Scope to the picked month so the stats only reflect tasks created/updated then.
  const mine = useMemo(() => {
    return mineAll.filter((b) => {
      const t = b.updatedAt || b.createdAt;
      if (!t) return true;
      const d = new Date(t);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [mineAll, year, month]);

  const counts = useMemo(() => {
    let pending = 0, inProcess = 0, completed = 0;
    mine.forEach((b) => {
      const bk = bucketize(b.status);
      if (bk === 'PENDING') pending += 1;
      else if (bk === 'COMPLETED') completed += 1;
      else inProcess += 1;
    });
    return { inProcess, pending, completed, total: mine.length };
  }, [mine]);

  const sortedDesc = useMemo(() => {
    return [...mine].sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bt - at;
    });
  }, [mine]);

  const recentPending = sortedDesc.find((b) => bucketize(b.status) === 'PENDING');
  const recentInProcess = sortedDesc.find((b) => bucketize(b.status) === 'IN_PROCESS');

  const previousCompleted = sortedDesc.filter((b) => {
    const bk = bucketize(b.status);
    if (filter === 'All') return true;
    if (filter === 'Completed') return bk === 'COMPLETED';
    if (filter === 'In Process') return bk === 'IN_PROCESS';
    if (filter === 'Pending') return bk === 'PENDING';
    return false;
  });

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const openBooking = (b) => {
    navigation.navigate('OwnerPickupServiceDetail', { id: b.id, booking: b });
  };

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><Text style={styles.error}>Employee not found</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* This Month — stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsHeaderTitle}>This Month</Text>
            <View style={styles.monthPill}>
              <Text style={styles.monthPillText}>{MONTHS[month - 1]} {year}</Text>
              <TouchableOpacity onPress={() => stepMonth(-1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Ionicons name="chevron-back" size={14} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.monthPillSep} />
              <TouchableOpacity onPress={() => stepMonth(1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statTilesRow}>
            <StatTile
              value={String(counts.inProcess).padStart(2, '0')}
              label="In Process"
              hint="Active"
              icon="sync"
              bg="#3B4FD7"
            />
            <StatTile
              value={String(counts.pending).padStart(2, '0')}
              label="Pending"
              hint="Waiting"
              icon="alert-circle"
              bg="#EF4444"
            />
            <StatTile
              value={String(counts.completed).padStart(3, '0')}
              label="Completed"
              hint="Finished"
              icon="checkmark-done"
              bg="#22C55E"
            />
            <StatTile
              value={String(counts.total).padStart(3, '0')}
              label="Total"
              hint="Overall"
              icon="stats-chart"
              bg="#7C3AED"
            />
          </View>
        </View>

        {loading && list.length === 0 && (
          <ActivityIndicator size="small" color="#3B4FD7" style={{ marginVertical: 20 }} />
        )}

        {/* Recent Pending */}
        <Text style={styles.sectionHeader}>Recent Pending</Text>
        {recentPending ? (
          <TaskCard
            booking={recentPending}
            bucket="PENDING"
            onPress={() => openBooking(recentPending)}
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        ) : (
          <Text style={styles.empty}>No pending tasks.</Text>
        )}

        {/* In Process */}
        <Text style={styles.sectionHeader}>In Process</Text>
        {recentInProcess ? (
          <TaskCard
            booking={recentInProcess}
            bucket="IN_PROCESS"
            onPress={() => openBooking(recentInProcess)}
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        ) : (
          <Text style={styles.empty}>No tasks in progress.</Text>
        )}

        {/* Previous Completed (with filter chips) */}
        <Text style={styles.sectionHeader}>Previous Completed</Text>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {previousCompleted.length === 0 ? (
          <Text style={styles.empty}>No tasks found.</Text>
        ) : (
          previousCompleted.map((b) => (
            <TaskCard
              key={b.id}
              booking={b}
              bucket={bucketize(b.status)}
              onPress={() => openBooking(b)}
              onRefresh={() => load(true)}
              refreshing={refreshing}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ value, label, hint, icon, bg }) {
  return (
    <View style={styles.statTileWrap}>
      <View style={[styles.statTileTop, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={11} color="#FFFFFF" />
        <Text style={styles.statTileTopText}>{label}</Text>
      </View>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileHint}>{hint}</Text>
    </View>
  );
}

function TaskCard({ booking, bucket, onPress, onRefresh, refreshing }) {
  const isPending = bucket === 'PENDING';
  const isInProcess = bucket === 'IN_PROCESS';
  const isCompleted = bucket === 'COMPLETED';

  const stepLine =
    isPending ? 'Spare part has been ordered. Service is Pending'
      : isInProcess ? 'Technician Work Started'
        : 'Technician Work Completed';
  const stepColor =
    isPending ? '#DC2626'
      : isInProcess ? '#3B4FD7'
        : '#15803D';

  const footerLine =
    isPending ? `Pending On ${formatDateTime(booking.updatedAt || booking.createdAt)}`
      : isInProcess ? `In Service Process On ${formatDateTime(booking.updatedAt || booking.createdAt)}`
        : `Completed On ${formatDateTime(booking.updatedAt || booking.createdAt)}`;

  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.taskAccent} />
      <View style={styles.taskInner}>
        <View style={styles.taskTopRow}>
          <Text style={styles.taskDate}>{formatDate(booking.createdAt)}</Text>
          <Text style={styles.taskTracking}>#{trackingId(booking)}</Text>
        </View>
        <View style={styles.taskMiddleRow}>
          <Text style={styles.taskDevice} numberOfLines={2}>{deviceLine(booking)}</Text>
        </View>
        <View style={styles.taskBottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.taskStep, { color: stepColor }]}>{stepLine}</Text>
            <Text style={styles.taskFooter}>{footerLine}</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.7}
            style={styles.taskStatusIcon}
          >
            {isPending && (
              <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Ionicons name="refresh" size={14} color="#DC2626" />
                )}
              </View>
            )}
            {isInProcess && (
              <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#3B4FD7" />
                ) : (
                  <Ionicons name="refresh" size={14} color="#3B4FD7" />
                )}
              </View>
            )}
            {isCompleted && (
              <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#15803D" />
                ) : (
                  <Ionicons name="refresh" size={14} color="#15803D" />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },

  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12 },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  monthPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  monthPillSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' },

  statTilesRow: { flexDirection: 'row', gap: 6 },
  statTileWrap: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    overflow: 'hidden',
    paddingBottom: 8,
    alignItems: 'center',
  },
  statTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingVertical: 5,
  },
  statTileTopText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  statTileValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 6 },
  statTileHint: { fontSize: 9, color: '#9CA3AF', marginTop: 1, fontWeight: '600' },

  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  filterChipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },

  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  taskAccent: { width: 3, backgroundColor: '#7C3AED' },
  taskInner: { flex: 1, padding: 10 },
  taskTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskDate: { fontSize: 12, fontWeight: '700', color: '#111827' },
  taskTracking: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  taskMiddleRow: { marginTop: 4 },
  taskDevice: { fontSize: 11, color: '#374151' },
  taskBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  taskStep: { fontSize: 11, fontWeight: '700' },
  taskFooter: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  taskStatusIcon: { marginLeft: 8 },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  empty: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 14 },
});
