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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color tokens — match the mockup's dot legend.
const STATUS_COLORS = {
  LEAVE: '#DB2777',      // pink
  LATE: '#EAB308',       // yellow
  PERMISSION: '#F97316', // orange
  WEEK_OFF: '#F472B6',   // light pink
  HOLIDAY: '#16A34A',    // green
};
const RING_COLORS = {
  present: '#16A34A',
  late: '#EAB308',
  permission: '#F97316',
  leaves: '#DB2777',
  holidays: '#1E3A8A',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function OwnerEmployeeAttendanceScreen({ route }) {
  const employee = route.params?.employee;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!employee?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await ticketApi.get(`/technicians/${employee.id}/attendance`, {
        query: { month, year },
      });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employee?.id, month, year]);

  React.useEffect(() => { load(); }, [load]);

  // Map ISO date → daily record, for O(1) lookup while rendering the grid.
  const recordsByDate = useMemo(() => {
    const map = {};
    (data?.dailyRecords || []).forEach((r) => { if (r.date) map[r.date] = r; });
    return map;
  }, [data]);

  // Build the 6×7 calendar grid for the selected month.
  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const startOffset = first.getDay(); // 0=Sun
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${year}-${pad2(month)}-${pad2(d)}`;
      cells.push({ day: d, iso, record: recordsByDate[iso] || null });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [year, month, recordsByDate]);

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><Text style={styles.error}>Employee not found</Text></View>
      </SafeAreaView>
    );
  }

  const present = data?.presentDays ?? 0;
  const late = data?.lateHours ?? '0';
  const permission = data?.permissionCount ?? 0;
  const leaves = data?.leaveDays ?? 0;
  const holidays = data?.holidayCount ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* Overview card with calendar */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.cardTitle}>Attendance Overview</Text>
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

          {loading && !data ? (
            <ActivityIndicator size="large" color="#3B4FD7" style={{ marginVertical: 24 }} />
          ) : (
            <>
              {/* Stat ring circles */}
              <View style={styles.statRow}>
                <StatRing value={present} label="Present" color={RING_COLORS.present} />
                <StatRing value={`${late} Hrs`} label="Late" color={RING_COLORS.late} />
                <StatRing value={pad2(permission)} label="Permission" color={RING_COLORS.permission} />
                <StatRing value={pad2(leaves)} label="Leaves" color={RING_COLORS.leaves} />
                <StatRing value={pad2(holidays)} label="Holidays" color={RING_COLORS.holidays} />
              </View>

              {/* Calendar */}
              <View style={styles.calendar}>
                <View style={styles.calRowHeader}>
                  {DOW.map((d, i) => (
                    <Text key={d} style={[styles.calHeaderCell, i === 0 && styles.calHeaderSunday]}>
                      {d}
                    </Text>
                  ))}
                </View>
                {grid.map((week, wi) => (
                  <View key={wi} style={styles.calRow}>
                    {week.map((cell, ci) => {
                      if (!cell) return <View key={ci} style={styles.calCell} />;
                      const isSunday = ci === 0;
                      const status = (cell.record?.status || '').toUpperCase();
                      // Treat Sundays as week-off when no other status is set.
                      const effectiveStatus = status || (isSunday ? 'WEEK_OFF' : null);
                      const dotColor = STATUS_COLORS[effectiveStatus];
                      return (
                        <View key={ci} style={styles.calCell}>
                          <Text style={[styles.calCellNum, isSunday && styles.calCellSunday]}>
                            {cell.day}
                          </Text>
                          {dotColor ? <View style={[styles.calDot, { backgroundColor: dotColor }]} /> : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                {[
                  ['Leave', STATUS_COLORS.LEAVE],
                  ['Late', STATUS_COLORS.LATE],
                  ['Permission', STATUS_COLORS.PERMISSION],
                  ['Week off', STATUS_COLORS.WEEK_OFF],
                  ['Holiday', STATUS_COLORS.HOLIDAY],
                ].map(([label, color]) => (
                  <View key={label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.legendText}>{label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Daily list (mockup 3) — list of day cards with check-in/out + status pill */}
        <View style={styles.dailySection}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyTitle}>Attendance Monthly</Text>
            <View style={styles.dailyMonthPill}>
              <Text style={styles.dailyMonthText}>{MONTHS[month - 1]} {year}</Text>
              <View style={styles.dailyMonthBtn}>
                <Ionicons name="calendar" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {(data?.dailyRecords && data.dailyRecords.length > 0) ? (
            data.dailyRecords.map((day) => <DayCard key={day.date} day={day} />)
          ) : (
            <Text style={styles.empty}>No attendance records for this month.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRing({ value, label, color }) {
  return (
    <View style={styles.statRingWrap}>
      <View style={[styles.statRing, { borderColor: color }]}>
        <Text style={styles.statRingValue}>{value}</Text>
      </View>
      <Text style={[styles.statRingLabel, { color }]}>{label}</Text>
    </View>
  );
}

function DayCard({ day }) {
  const status = (day.status || 'GENERAL').toUpperCase();
  const dateLabel = formatDateLabel(day);
  if (status === 'LEAVE') {
    return (
      <View style={[styles.dayCard, styles.dayCardLeave]}>
        <View style={styles.dayLeftAccent} />
        <View style={styles.dayInner}>
          <View style={styles.dayTopRow}>
            <Text style={styles.dayDate}>{dateLabel}</Text>
            <View style={[styles.dayPill, styles.dayPillLeave]}>
              <Text style={styles.dayPillTextOn}>Leave</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
  if (status === 'WEEK_OFF') {
    return (
      <View style={[styles.dayCard, styles.dayCardWeekOff]}>
        <View style={styles.dayLeftAccent} />
        <View style={styles.dayInner}>
          <View style={styles.dayTopRow}>
            <Text style={styles.dayDate}>{dateLabel}</Text>
            <View style={[styles.dayPill, styles.dayPillWeekOff]}>
              <Text style={styles.dayPillTextOn}>Week Off</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
  const isLate = status === 'LATE';
  const isPermission = status === 'PERMISSION';
  return (
    <View style={styles.dayCard}>
      <View style={styles.dayLeftAccent} />
      <View style={styles.dayInner}>
        <View style={styles.dayTopRow}>
          <Text style={styles.dayDate}>{dateLabel}</Text>
          <View style={styles.dayTopRight}>
            <View style={[styles.dayPill, styles.dayPillGeneral]}>
              <Text style={styles.dayPillText}>General</Text>
            </View>
            {isPermission ? (
              <View style={[styles.dayPill, styles.dayPillPermission]}>
                <Text style={styles.dayPillText}>{day.notes || 'Permission'}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.dayCols}>
          <View style={styles.dayCol}>
            <Text style={[styles.dayColValue, isLate && styles.dayColValueLate]}>
              {formatTime12(day.checkInTime)}
            </Text>
            <Text style={styles.dayColLabel}>Check In</Text>
          </View>
          <View style={styles.dayCol}>
            <Text style={styles.dayColValue}>{formatTime12(day.checkOutTime)}</Text>
            <Text style={styles.dayColLabel}>Check Out</Text>
          </View>
          <View style={styles.dayCol}>
            <Text style={[styles.dayColValue, isLate && styles.dayColValueLate]}>
              {day.workingHours && day.workingHours !== '0' ? day.workingHours : '—'}
            </Text>
            <Text style={styles.dayColLabel}>Working HR's</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function formatTime12(t) {
  if (!t || typeof t !== 'string') return '—';
  const [hhRaw, mm] = t.split(':');
  const hh = Number(hhRaw);
  if (Number.isNaN(hh)) return '—';
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh - 1 + 12) % 12) + 1;
  return `${pad2(h12)}:${pad2(Number(mm || 0))} ${period}`;
}

function formatDateLabel(day) {
  if (!day?.date) return day?.dayLabel || '—';
  // Parse ISO YYYY-MM-DD locally so the day-of-week doesn't drift by a day under
  // negative-offset timezones (new Date('2026-06-06') is UTC midnight).
  const parts = String(day.date).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const dd = Number(parts[2]);
  if (!y || !m || !dd) return day?.dayLabel || '—';
  const d = new Date(y, m - 1, dd);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${dow}, ${pad2(dd)} ${MONTHS_SHORT[m - 1]} ${y}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },

  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  monthPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  monthPillSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statRingWrap: { alignItems: 'center', flex: 1 },
  statRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  statRingValue: { fontSize: 12, fontWeight: '800', color: '#111827' },
  statRingLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },

  calendar: { marginTop: 4, marginBottom: 8 },
  calRowHeader: { flexDirection: 'row', marginBottom: 6 },
  calRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },
  calHeaderSunday: { color: '#DC2626' },
  calCellNum: { fontSize: 13, fontWeight: '600', color: '#111827' },
  calCellSunday: { color: '#DC2626' },
  calDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#374151', fontWeight: '500' },

  dailySection: { marginTop: 14 },
  dailyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dailyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dailyMonthPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dailyMonthText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  dailyMonthBtn: {
    backgroundColor: '#7C3AED',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dayCardLeave: { backgroundColor: '#FCA5A5' },
  dayCardWeekOff: { backgroundColor: '#F9A8D4' },
  dayLeftAccent: { width: 3, backgroundColor: '#7C3AED' },
  dayInner: { flex: 1, padding: 10 },
  dayTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTopRight: { flexDirection: 'row', gap: 6 },
  dayDate: { fontSize: 12, fontWeight: '700', color: '#111827' },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dayPillGeneral: { backgroundColor: '#DCFCE7' },
  dayPillPermission: { backgroundColor: '#FEE2E2' },
  dayPillLeave: { backgroundColor: '#EF4444' },
  dayPillWeekOff: { backgroundColor: '#DB2777' },
  dayPillText: { fontSize: 10, fontWeight: '700', color: '#111827' },
  dayPillTextOn: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  dayCols: { flexDirection: 'row', marginTop: 8 },
  dayCol: { flex: 1 },
  dayColValue: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  dayColValueLate: { color: '#DC2626' },
  dayColLabel: { fontSize: 10, color: '#6B7280', marginTop: 2 },

  empty: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingVertical: 20 },
});
