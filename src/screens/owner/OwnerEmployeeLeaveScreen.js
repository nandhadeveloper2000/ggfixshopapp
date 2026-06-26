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
import { ticketApi } from '../../api/client';
import { notify } from '../../components/confirm';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FILTERS = ['All', 'Approved', 'Processing', 'Rejected'];

function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(instant) {
  if (!instant) return '—';
  const d = new Date(instant);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function OwnerEmployeeLeaveScreen({ route, navigation }) {
  const employee = route.params?.employee;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState('All');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!employee?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await ticketApi.get(`/technicians/${employee.id}/leaves`, {
        query: { month, year },
      });
      setList(Array.isArray(res) ? res : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employee?.id, month, year]);

  React.useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    Leave: list.length,
    Processing: list.filter((l) => l.status === 'PROCESSING').length,
    Rejected: list.filter((l) => l.status === 'REJECTED').length,
    Approved: list.filter((l) => l.status === 'APPROVED').length,
  }), [list]);

  // Sort newest first so the latest leave bubbles to the top.
  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const ad = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const bd = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return bd - ad;
    });
  }, [list]);

  const recent = sorted[0];
  const previous = sorted.slice(1);
  const filteredPrevious = filter === 'All'
    ? previous
    : previous.filter((l) => l.status === filter.toUpperCase());

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const updateLeaveStatus = async (leaveId, status) => {
    try {
      await ticketApi.patch(`/technicians/${employee.id}/leaves/${leaveId}`, { body: { status } });
      load(true);
    } catch (e) {
      notify('Error', e.message || 'Could not update leave', { preset: 'error', haptic: 'error' });
    }
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
        {/* This Month — stats card */}
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
            <StatTile value={pad2(counts.Leave)}      label="Leave"      bg="#EC4899" />
            <StatTile value={pad2(counts.Processing)} label="Processing" bg="#F97316" />
            <StatTile value={pad2(counts.Rejected)}   label="Rejected"   bg="#EF4444" />
            <StatTile value={pad2(counts.Approved)}   label="Approved"   bg="#1E3A8A" />
          </View>
        </View>

        {/* Apply for leave (kept available — small, doesn't fight the layout) */}
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => navigation.navigate('OwnerEmployeeApplyLeave', { employee })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.applyBtnText}>Apply for leave</Text>
        </TouchableOpacity>

        {/* Recent Leave */}
        <Text style={styles.sectionHeader}>Recent Leave</Text>
        {loading && list.length === 0 ? (
          <ActivityIndicator size="small" color="#3B4FD7" style={{ marginVertical: 16 }} />
        ) : recent ? (
          <LeaveCard
            item={recent}
            ownerCanApprove={!!employee?.id}
            onApprove={() => updateLeaveStatus(recent.id, 'APPROVED')}
            onReject={() => updateLeaveStatus(recent.id, 'REJECTED')}
          />
        ) : (
          <Text style={styles.empty}>No recent leave.</Text>
        )}

        {/* Previous Leave */}
        <Text style={styles.sectionHeader}>Previous Leave</Text>
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

        {filteredPrevious.length === 0 ? (
          <Text style={styles.empty}>No previous leave requests.</Text>
        ) : (
          filteredPrevious.map((item) => (
            <LeaveCard
              key={item.id}
              item={item}
              ownerCanApprove={!!employee?.id}
              onApprove={() => updateLeaveStatus(item.id, 'APPROVED')}
              onReject={() => updateLeaveStatus(item.id, 'REJECTED')}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function pad2(n) { return String(n).padStart(2, '0'); }

function StatTile({ value, label, bg }) {
  return (
    <View style={styles.statTileWrap}>
      <View style={[styles.statTileTop, { backgroundColor: bg }]}>
        <Text style={styles.statTileTopText}>{label}</Text>
      </View>
      <View style={styles.statTileBottom}>
        <Text style={styles.statTileValue}>{value}</Text>
      </View>
    </View>
  );
}

function LeaveCard({ item, ownerCanApprove, onApprove, onReject }) {
  const status = (item.status || '').toUpperCase();
  const pillStyle =
    status === 'APPROVED' ? styles.pillApproved
      : status === 'REJECTED' ? styles.pillRejected
        : styles.pillProcessing;
  const pillLabel = status === 'PROCESSING' ? 'Processing'
    : status === 'APPROVED' ? 'Approved'
      : status === 'REJECTED' ? 'Rejected'
        : status;

  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveAccent} />
      <View style={styles.leaveInner}>
        <View style={styles.leaveTopRow}>
          <Text style={styles.leaveDate}>{formatDate(item.startDate)}</Text>
          <View style={[styles.statusPill, pillStyle]}>
            <Text style={styles.statusPillText}>{pillLabel}</Text>
          </View>
        </View>

        <View style={styles.leaveCols}>
          <View style={styles.leaveCol}>
            <Text style={styles.leaveColValue} numberOfLines={1}>{item.reason || '—'}</Text>
            <Text style={styles.leaveColLabel}>Leave Reason</Text>
          </View>
          <View style={styles.leaveCol}>
            <Text style={styles.leaveColValue}>{item.appliedDaysLabel || '—'}</Text>
            <Text style={styles.leaveColLabel}>Applied Days</Text>
          </View>
          <View style={styles.leaveCol}>
            <Text style={styles.leaveColValue} numberOfLines={1}>
              {formatDateTime(item.requestedAt)}
            </Text>
            <Text style={styles.leaveColLabel}>Request Date &amp; Time</Text>
          </View>
        </View>

        {status === 'PROCESSING' && ownerCanApprove && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.85}>
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.85}>
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },

  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },
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

  statTilesRow: { flexDirection: 'row', gap: 8 },
  statTileWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statTileTop: { paddingVertical: 5, alignItems: 'center' },
  statTileTopText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  statTileBottom: { paddingVertical: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  statTileValue: { fontSize: 18, fontWeight: '800', color: '#111827' },

  applyBtn: {
    marginTop: 12,
    backgroundColor: '#3B4FD7',
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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
  filterChipActive: { backgroundColor: '#3B4FD7', borderColor: '#3B4FD7' },
  filterChipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },

  leaveCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  leaveAccent: { width: 3, backgroundColor: '#7C3AED' },
  leaveInner: { flex: 1, padding: 10 },
  leaveTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leaveDate: { fontSize: 12, fontWeight: '700', color: '#111827' },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillProcessing: { backgroundColor: '#F97316' },
  pillApproved: { backgroundColor: '#22C55E' },
  pillRejected: { backgroundColor: '#EF4444' },
  statusPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  leaveCols: { flexDirection: 'row', marginTop: 8, gap: 8 },
  leaveCol: { flex: 1 },
  leaveColValue: { fontSize: 11, fontWeight: '700', color: '#111827' },
  leaveColLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, backgroundColor: '#22C55E', paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  approveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rejectBtn: { flex: 1, backgroundColor: '#DC2626', paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  empty: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 14 },
});
