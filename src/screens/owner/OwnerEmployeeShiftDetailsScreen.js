import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ticketApi } from '../../api/client';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Schedule window: 9 AM through 10 PM (matches the mockup's 09:00 - 10:00 next-day range).
const SCHEDULE_HOURS = Array.from({ length: 14 }, (_, i) => 9 + i);

function pad2(n) {
  return String(n).padStart(2, '0');
}

function hourLabel(h24) {
  const h12 = ((h24 - 1) % 12) + 1;
  return `${pad2(h12)}:00`;
}

// Parse a server time string ("HH:mm" / "HH:mm:ss") into { hour, minute, label }.
function parseTime(t) {
  if (!t || typeof t !== 'string') return null;
  const [hh, mm] = t.split(':');
  const hour = Number(hh);
  const minute = Number(mm || 0);
  if (Number.isNaN(hour)) return null;
  const h12 = ((hour - 1 + 12) % 12) + 1;
  return { hour, minute, label: `${pad2(h12)}:${pad2(minute)}` };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function OwnerEmployeeShiftDetailsScreen({ route, navigation }) {
  const employee = route.params?.employee;
  const todayIso = isoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewAsList, setViewAsList] = useState(false);

  const loadDay = useCallback(async (dateStr) => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const res = await ticketApi.get(`/technicians/${employee.id}/attendance/day`, {
        query: { date: dateStr },
      });
      setDayData(res);
    } catch {
      setDayData(null);
    } finally {
      setLoading(false);
    }
  }, [employee?.id]);

  React.useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  const selected = new Date(selectedDate);
  const dayLong = DAYS_LONG[selected.getDay()];
  const monthYear = selected.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Week strip starts Monday → Sunday (matches the mockup's Mon-Sun order).
  const mondayStart = new Date(selected);
  const dow = selected.getDay(); // 0 = Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  mondayStart.setDate(selected.getDate() + mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mondayStart);
    x.setDate(mondayStart.getDate() + i);
    return x;
  });

  const checkIn = parseTime(dayData?.checkInTime);
  const checkOut = parseTime(dayData?.checkOutTime);

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.error}>Employee not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header row: big date + Today button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{selected.getDate()}</Text>
          <View>
            <Text style={styles.headerDayLong}>{dayLong}</Text>
            <Text style={styles.headerMonth}>{monthYear}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => setSelectedDate(todayIso)}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={15} color="#16A34A" />
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((dt) => {
          const dateStr = isoDate(dt);
          const isSelected = dateStr === selectedDate;
          const isSunday = dt.getDay() === 0;
          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.weekDay,
                isSunday && !isSelected && styles.weekDaySunday,
                isSelected && styles.weekDaySelected,
              ]}
              onPress={() => setSelectedDate(dateStr)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.weekDayName,
                  isSunday && !isSelected && styles.weekDayTextSunday,
                  isSelected && styles.weekDayTextSelected,
                ]}
              >
                {DAYS_SHORT[dt.getDay()]}
              </Text>
              <Text
                style={[
                  styles.weekDayNum,
                  isSunday && !isSelected && styles.weekDayTextSunday,
                  isSelected && styles.weekDayTextSelected,
                ]}
              >
                {pad2(dt.getDate())}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Schedule timeline */}
      <ScrollView contentContainerStyle={styles.scheduleContent}>
        <View style={styles.scheduleHeaderRow}>
          <Text style={styles.scheduleTitle}>Schedule</Text>
          <TouchableOpacity
            style={styles.viewListBtn}
            onPress={() => setViewAsList((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="list" size={16} color="#16A34A" />
            <Text style={styles.viewListBtnText}>{viewAsList ? 'View as timeline' : 'View as list'}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#16A34A" style={{ marginVertical: 24 }} />
        ) : viewAsList ? (
          <View style={styles.listWrap}>
            {checkIn ? (
              <View style={styles.listRow}>
                <View style={[styles.listDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.listRowLabel}>Check-In Time</Text>
                <Text style={styles.listRowValue}>{checkIn.label}</Text>
              </View>
            ) : null}
            {checkOut ? (
              <View style={styles.listRow}>
                <View style={[styles.listDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.listRowLabel}>Check-Out Time</Text>
                <Text style={[styles.listRowValue, { color: '#DC2626' }]}>{checkOut.label}</Text>
              </View>
            ) : null}
            {!checkIn && !checkOut ? (
              <Text style={styles.empty}>No attendance recorded for this day.</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.timeline}>
            {SCHEDULE_HOURS.map((h) => {
              const isCheckIn = checkIn && checkIn.hour === h;
              const isCheckOut = checkOut && checkOut.hour === h;
              return (
                <View key={h} style={styles.hourRow}>
                  <View style={styles.hourPill}>
                    <Text style={styles.hourPillText}>{hourLabel(h)}</Text>
                  </View>
                  <View style={styles.connectorCol}>
                    <View style={styles.connectorLine} />
                    <View style={styles.connectorDot} />
                  </View>
                  <View style={styles.hourLineWrap}>
                    <View style={styles.hourLine} />
                    {isCheckIn && (
                      <View style={[styles.eventChip, styles.eventChipCheckIn]}>
                        <Text style={styles.eventChipText}>Check-In Time</Text>
                        <Text style={styles.eventChipTime}>({checkIn.label})</Text>
                      </View>
                    )}
                    {isCheckOut && (
                      <View style={[styles.eventChip, styles.eventChipCheckOut]}>
                        <Text style={styles.eventChipText}>Check-Out Time</Text>
                        <Text style={styles.eventChipTime}>({checkOut.label})</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Notes / status badge if backend has it */}
        {dayData?.status && dayData.status !== 'GENERAL' && (
          <View style={styles.statusNote}>
            <Text style={styles.statusNoteText}>
              {dayData.status}
              {dayData.notes ? ` — ${dayData.notes}` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4FBF6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerDate: { fontSize: 36, fontWeight: '800', color: '#16A34A', lineHeight: 38 },
  headerDayLong: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  headerMonth: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  todayBtnText: { color: '#15803D', fontSize: 13, fontWeight: '700' },

  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  weekDay: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekDaySelected: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  weekDaySunday: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  weekDayName: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  weekDayNum: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 3 },
  weekDayTextSelected: { color: '#FFFFFF' },
  weekDayTextSunday: { color: '#FFFFFF' },

  scheduleContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 32 },
  scheduleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scheduleTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  viewListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewListBtnText: { color: '#15803D', fontSize: 13, fontWeight: '700' },

  timeline: {
    backgroundColor: 'transparent',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  hourPill: {
    width: 66,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    marginRight: 4,
  },
  hourPillText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  connectorCol: { width: 22, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  connectorLine: { position: 'absolute', top: 0, bottom: 0, left: 10, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: '#86EFAC' },
  connectorDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#16A34A', zIndex: 1 },
  hourLineWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 30,
    marginLeft: 4,
  },
  hourLine: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#BBF7D0',
  },

  eventChip: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  eventChipCheckIn: { backgroundColor: '#DCFCE7' },
  eventChipCheckOut: { backgroundColor: '#DCFCE7' },
  eventChipText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  eventChipTime: { fontSize: 11, fontWeight: '600', color: '#15803D' },

  empty: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },

  listWrap: { marginTop: 2 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  listDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  listRowLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  listRowValue: { fontSize: 14, fontWeight: '800', color: '#15803D' },

  statusNote: {
    marginTop: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
  },
  statusNoteText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
});
