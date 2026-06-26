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

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format a number-or-string amount as ₹X,XXX (no decimals for whole rupees).
function formatRupee(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '₹ 0';
  return `₹ ${n.toLocaleString('en-IN')}`;
}

export default function OwnerEmployeeSalaryReportScreen({ route, navigation }) {
  const employee = route.params?.employee;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!employee?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await ticketApi.get(`/technicians/${employee.id}/payslips`, { query: { year } });
      setList(Array.isArray(res) ? res : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employee?.id, year]);

  React.useEffect(() => { load(); }, [load]);

  // Build 12-month rows so months with no payslip still show as "Not generated".
  const rows = useMemo(() => {
    const byMonth = {};
    list.forEach((r) => { byMonth[r.month] = r; });
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const existing = byMonth[m];
      return existing || { month: m, year, presentDays: 0, netSalary: 0, regularSalary: 0, _empty: true };
    });
  }, [list, year]);

  const totals = useMemo(() => {
    let totalPresent = 0;
    let totalNet = 0;
    let monthsPaid = 0;
    list.forEach((r) => {
      totalPresent += Number(r.presentDays || 0);
      const n = Number(r.netSalary || 0);
      totalNet += Number.isNaN(n) ? 0 : n;
      if (n > 0) monthsPaid += 1;
    });
    return { totalPresent, totalNet, monthsPaid };
  }, [list]);

  const openPayslip = (row) => {
    if (row._empty) return; // nothing to view yet
    navigation.navigate('OwnerEmployeePayslip', { employee, month: row.month, year: row.year });
  };

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><Text style={styles.error}>Employee not found</Text></View>
      </SafeAreaView>
    );
  }

  const fyLabel = `${year}-${String(year + 1).slice(-2)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* Financial year header */}
        <View style={styles.fyCard}>
          <View style={styles.fyTextWrap}>
            <Text style={styles.fyLabel}>Financial Year</Text>
            <Text style={styles.fyValue}>{fyLabel}</Text>
          </View>
          <View style={styles.yearPill}>
            <TouchableOpacity onPress={() => setYear((y) => y - 1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-back" size={14} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.yearPillText}>{year}</Text>
            <View style={styles.yearPillSep} />
            <TouchableOpacity onPress={() => setYear((y) => y + 1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary tiles */}
        <View style={styles.summaryRow}>
          <SummaryTile
            label="Total Present"
            value={`${totals.totalPresent}`}
            sub="Days"
            icon="calendar"
            color="#16A34A"
            bg="#DCFCE7"
          />
          <SummaryTile
            label="Total Earned"
            value={formatRupee(totals.totalNet)}
            sub={`${totals.monthsPaid} mo paid`}
            icon="cash"
            color="#7C3AED"
            bg="#EDE9FE"
          />
          <SummaryTile
            label="Avg / Month"
            value={formatRupee(totals.monthsPaid > 0 ? Math.round(totals.totalNet / totals.monthsPaid) : 0)}
            sub="Avg payout"
            icon="trending-up"
            color="#3B4FD7"
            bg="#DBEAFE"
          />
        </View>

        {/* Monthly list */}
        <Text style={styles.sectionHeader}>Monthly Payslips</Text>

        {loading && list.length === 0 ? (
          <ActivityIndicator size="small" color="#3B4FD7" style={{ marginVertical: 16 }} />
        ) : (
          rows.map((row, i) => (
            <MonthCard
              key={`${row.month}-${row.year}`}
              row={row}
              index={i + 1}
              onPress={() => openPayslip(row)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({ label, value, sub, icon, color, bg }) {
  return (
    <View style={styles.summaryTile}>
      <View style={[styles.summaryIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function MonthCard({ row, index, onPress }) {
  const isEmpty = row._empty;
  const net = Number(row.netSalary || 0);
  const isPaid = !isEmpty && net > 0;
  return (
    <TouchableOpacity
      style={[styles.monthCard, isEmpty && styles.monthCardEmpty]}
      onPress={onPress}
      activeOpacity={isEmpty ? 1 : 0.85}
      disabled={isEmpty}
    >
      <View style={styles.monthIndexBubble}>
        <Text style={styles.monthIndexText}>{String(index).padStart(2, '0')}</Text>
      </View>
      <View style={styles.monthMain}>
        <View style={styles.monthHeaderRow}>
          <Text style={styles.monthName}>{MONTHS_FULL[row.month - 1]}</Text>
          <Text style={styles.monthYear}>{row.year}</Text>
        </View>
        <View style={styles.monthBottomRow}>
          <View style={styles.monthMeta}>
            <Ionicons name="calendar-outline" size={11} color="#6B7280" />
            <Text style={styles.monthMetaText}>{row.presentDays ?? 0} Days</Text>
          </View>
          <View style={styles.monthSpacer} />
          <Text style={[styles.monthSalary, isPaid ? styles.monthSalaryPaid : styles.monthSalaryEmpty]}>
            {formatRupee(row.netSalary)}
          </Text>
        </View>
      </View>
      <View style={styles.monthRight}>
        {isEmpty ? (
          <View style={[styles.statusPill, styles.statusPillEmpty]}>
            <Text style={styles.statusPillTextEmpty}>Pending</Text>
          </View>
        ) : isPaid ? (
          <View style={[styles.statusPill, styles.statusPillPaid]}>
            <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
            <Text style={styles.statusPillText}>Paid</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, styles.statusPillUnpaid]}>
            <Text style={styles.statusPillText}>Unpaid</Text>
          </View>
        )}
        {!isEmpty && <Ionicons name="chevron-forward" size={14} color="#9CA3AF" style={{ marginTop: 6 }} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },

  fyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fyTextWrap: {},
  fyLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  fyValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 1 },

  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  yearPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  yearPillSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' },

  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  summaryTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
  },
  summaryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 10, color: '#374151', fontWeight: '600', marginTop: 2 },
  summarySub: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },

  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8 },

  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  monthCardEmpty: { backgroundColor: '#F9FAFB' },

  monthIndexBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthIndexText: { fontSize: 11, fontWeight: '800', color: '#3B4FD7' },

  monthMain: { flex: 1, minWidth: 0 },
  monthHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  monthName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  monthYear: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  monthBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  monthMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  monthMetaText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  monthSpacer: { flex: 1 },
  monthSalary: { fontSize: 13, fontWeight: '800' },
  monthSalaryPaid: { color: '#15803D' },
  monthSalaryEmpty: { color: '#9CA3AF' },

  monthRight: { alignItems: 'flex-end' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillPaid: { backgroundColor: '#22C55E' },
  statusPillUnpaid: { backgroundColor: '#F97316' },
  statusPillEmpty: { backgroundColor: '#E5E7EB' },
  statusPillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  statusPillTextEmpty: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
});
