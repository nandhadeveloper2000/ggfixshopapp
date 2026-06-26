import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { ticketApi, shopApi } from '../../api/client';
import { notify } from '../../components/confirm';

// Lazy-load native PDF deps so a missing install doesn't crash the whole bundle.
// On web we fall back to window.open/window.print which doesn't need expo-print.
function getPrintModule() {
  try { return require('expo-print'); } catch { return null; }
}
function getSharingModule() {
  try { return require('expo-sharing'); } catch { return null; }
}
import { selectShopId, selectSession } from '../../store/authSlice';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRupee(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '₹ 0';
  return `₹ ${n.toLocaleString('en-IN')}`;
}

// Escape user-controlled strings before embedding in HTML.
function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPayslipHtml({ shop, ownerMobile, employee, payslip, month, year, empId }) {
  const shopName = esc(shop?.name || 'Shop');
  const addrParts = [shop?.address, shop?.city, shop?.state, shop?.pincode].filter(Boolean);
  const shopAddress = esc(addrParts.join(', ') || '—');
  const shopPhone = esc(shop?.phone || ownerMobile || '—');
  const shopEmail = esc(shop?.email || '—');

  const monthName = MONTHS_FULL[month - 1] || '';
  const periodStart = payslip?.periodStart ? formatDate(payslip.periodStart) : '—';
  const periodEnd = payslip?.periodEnd ? formatDate(payslip.periodEnd) : '—';
  const netSalary = Number(payslip?.netSalary || 0);
  const netWage = Number(payslip?.netWage || 0);
  const totalPayable = netSalary + netWage;
  const isPaid = totalPayable > 0;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pay Slip — ${esc(employee?.name || 'Employee')} — ${esc(monthName)} ${esc(year)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
    .shop-head { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #3B4FD7; }
    .shop-name { font-size: 22px; font-weight: 800; color: #111827; margin: 0; }
    .shop-meta { font-size: 11px; color: #4B5563; margin: 4px 0; line-height: 1.45; }
    .doc-title { text-align: center; margin: 18px 0 6px; }
    .doc-title-label { letter-spacing: 4px; color: #6B7280; font-size: 10px; font-weight: 700; }
    .doc-title-month { font-size: 18px; font-weight: 800; color: #3B4FD7; margin-top: 2px; }
    .status-pill {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
      color: #fff;
    }
    .status-paid { background: #22C55E; }
    .status-pending { background: #FACC15; color: #111827; }

    .grid { display: flex; gap: 16px; margin-top: 16px; }
    .grid > div { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 12px; }
    .grid h3 { margin: 0 0 8px; font-size: 11px; color: #6B7280; letter-spacing: 1px; text-transform: uppercase; }
    .field { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .field label { color: #6B7280; }
    .field value { color: #111827; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    thead th {
      background: #3B4FD7; color: #FFFFFF; padding: 8px 10px; text-align: left;
      font-size: 11px; letter-spacing: 0.5px;
    }
    tbody td { padding: 9px 10px; border-bottom: 1px solid #F3F4F6; color: #374151; }
    tbody tr:nth-child(even) td { background: #FAFAFE; }
    td.amount, th.amount { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { padding: 10px; font-weight: 800; }
    .net-row td { background: #DCFCE7; color: #15803D; font-size: 13px; }

    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #6B7280; }
    .footer .sig { width: 40%; border-top: 1px solid #9CA3AF; padding-top: 4px; text-align: center; }
  </style>
</head>
<body>
  <div class="shop-head">
    <h1 class="shop-name">${shopName}</h1>
    <p class="shop-meta">${shopAddress}</p>
    <p class="shop-meta">Phone: ${shopPhone} &nbsp;•&nbsp; Email: ${shopEmail}</p>
  </div>

  <div class="doc-title">
    <div class="doc-title-label">PAY SLIP</div>
    <div class="doc-title-month">
      ${esc(monthName)} ${esc(year)}
      &nbsp;
      <span class="status-pill ${isPaid ? 'status-paid' : 'status-pending'}">
        ${isPaid ? 'PAID' : 'PENDING'}
      </span>
    </div>
    <p class="shop-meta">Period: ${esc(periodStart)} — ${esc(periodEnd)}</p>
  </div>

  <div class="grid">
    <div>
      <h3>Employee Details</h3>
      <div class="field"><label>Name</label><value>${esc(employee?.name || '—')}</value></div>
      <div class="field"><label>Employee ID</label><value>${esc(empId)}</value></div>
      <div class="field"><label>Role</label><value>${esc(employee?.roleLabel || 'Technician')}</value></div>
      <div class="field"><label>Mobile</label><value>${esc(employee?.phone || '—')}</value></div>
      <div class="field"><label>Email</label><value>${esc(employee?.email || '—')}</value></div>
    </div>
    <div>
      <h3>Attendance</h3>
      <div class="field"><label>Present Days</label><value>${payslip?.presentDays ?? 0}</value></div>
      <div class="field"><label>Daily Wage Days</label><value>${payslip?.dailyWageDays ?? 0}</value></div>
      <div class="field"><label>Period Start</label><value>${esc(periodStart)}</value></div>
      <div class="field"><label>Period End</label><value>${esc(periodEnd)}</value></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Component</th>
        <th>Description</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Regular Salary</td>
        <td>Monthly base salary</td>
        <td class="amount">${formatRupee(payslip?.regularSalary)}</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Regular Wage</td>
        <td>Daily-rate earnings (${payslip?.dailyWageDays ?? 0} days)</td>
        <td class="amount">${formatRupee(payslip?.regularWage)}</td>
      </tr>
      <tr>
        <td>3</td>
        <td>Net Salary</td>
        <td>Salary after deductions</td>
        <td class="amount">${formatRupee(payslip?.netSalary)}</td>
      </tr>
      <tr>
        <td>4</td>
        <td>Net Wage</td>
        <td>Wage after deductions</td>
        <td class="amount">${formatRupee(payslip?.netWage)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="net-row">
        <td colspan="3">NET PAYABLE</td>
        <td class="amount">${formatRupee(totalPayable)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="sig">Employee Signature</div>
    <div class="sig">Authorised Signatory</div>
  </div>
</body>
</html>`;
}

export default function OwnerEmployeePayslipScreen({ route }) {
  const { employee, month: routeMonth, year: routeYear } = route.params || {};
  const shopId = useSelector(selectShopId);
  const session = useSelector(selectSession);
  const [data, setData] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // 'download' | 'share' | null
  const month = routeMonth ?? new Date().getMonth() + 1;
  const year = routeYear ?? new Date().getFullYear();

  const load = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const res = await ticketApi.get(`/technicians/${employee.id}/payslips/${month}/${year}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employee?.id, month, year]);

  useEffect(() => { load(); }, [load]);

  // Fetch shop header once so the PDF has the right name/address/email.
  useEffect(() => {
    if (!shopId) return;
    let alive = true;
    (async () => {
      try {
        const res = await shopApi.get(`/shops/${shopId}`);
        if (alive) setShop(res);
      } catch {
        if (alive) setShop(null);
      }
    })();
    return () => { alive = false; };
  }, [shopId]);

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><Text style={styles.error}>Employee not found</Text></View>
      </SafeAreaView>
    );
  }

  const periodStart = data?.periodStart ? formatDate(data.periodStart) : '—';
  const periodEnd = data?.periodEnd ? formatDate(data.periodEnd) : '—';
  const netSalary = Number(data?.netSalary || 0);
  const netWage = Number(data?.netWage || 0);
  const totalPayable = netSalary + netWage;
  const isPaid = totalPayable > 0;
  const empId = employee?.id
    ? `EM-${String(employee.id).slice(0, 8).toUpperCase()}`
    : '—';

  const buildHtml = () => buildPayslipHtml({
    shop,
    ownerMobile: session?.mobile,
    employee,
    payslip: data,
    month,
    year,
    empId,
  });

  // Open the payslip HTML in a new browser window and trigger window.print().
  // Browsers' print dialog has a "Save as PDF" destination, so this is the web
  // equivalent of Download / Share without needing expo-print.
  const printInNewWindow = (html) => {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank');
    if (!w) {
      notify('Pop-up blocked', 'Allow pop-ups for this site to download/share the pay slip.', { preset: 'error' });
      return true;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Give the new doc a tick to layout before printing.
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 350);
    return true;
  };

  // Download → opens the system print dialog (iOS: AirPrint; Android: print framework
  // which also offers "Save as PDF"). On web we just open a new window and print.
  const onDownload = async () => {
    if (!data) {
      notify('No payslip', 'There is no payslip to download for this month.');
      return;
    }
    setBusy('download');
    try {
      const html = buildHtml();
      if (Platform.OS === 'web') {
        printInNewWindow(html);
        return;
      }
      const Print = getPrintModule();
      if (!Print) {
        notify('PDF module not installed', 'Run `npm install --legacy-peer-deps` (adds expo-print), then restart Metro with `npx expo start --clear`.', { preset: 'error' });
        return;
      }
      await Print.printAsync({ html });
    } catch (e) {
      notify('Could not open print dialog', e?.message || 'Please try again.', { preset: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // Share → renders to a temp PDF file then opens the system share sheet.
  // On web we use the same window.open/print path since browsers have no share API
  // for arbitrary file URIs.
  const onShare = async () => {
    if (!data) {
      notify('No payslip', 'There is no payslip to share for this month.');
      return;
    }
    setBusy('share');
    try {
      const html = buildHtml();
      if (Platform.OS === 'web') {
        printInNewWindow(html);
        return;
      }
      const Print = getPrintModule();
      const Sharing = getSharingModule();
      if (!Print) {
        notify('PDF module not installed', 'Run `npm install --legacy-peer-deps` (adds expo-print), then restart Metro with `npx expo start --clear`.', { preset: 'error' });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const isAvailable = Sharing ? await Sharing.isAvailableAsync() : false;
      if (!isAvailable) {
        notify('Sharing unavailable', `PDF saved to: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Pay Slip — ${MONTHS_FULL[month - 1]} ${year}`,
      });
    } catch (e) {
      notify('Could not share', e?.message || 'Please try again.', { preset: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#3B4FD7" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Hero — month + employee */}
            <View style={styles.hero}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="document-text" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroPayslip}>Pay Slip</Text>
                  <Text style={styles.heroMonth}>{MONTHS_FULL[month - 1]} {year}</Text>
                </View>
                <View style={[styles.heroStatusPill, isPaid ? styles.heroStatusPaid : styles.heroStatusPending]}>
                  <Text style={styles.heroStatusText}>{isPaid ? 'Paid' : 'Pending'}</Text>
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroEmpRow}>
                <View>
                  <Text style={styles.heroEmpLabel}>Employee</Text>
                  <Text style={styles.heroEmpName}>{employee.name || '—'}</Text>
                  <Text style={styles.heroEmpRole}>{employee.roleLabel || 'Technician'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.heroEmpLabel}>ID</Text>
                  <Text style={styles.heroEmpId}>{empId}</Text>
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroPeriodRow}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroPeriodText}>{periodStart} → {periodEnd}</Text>
              </View>
            </View>

            {/* Net payout summary */}
            <View style={styles.payoutCard}>
              <Text style={styles.payoutLabel}>Net Payable</Text>
              <Text style={styles.payoutAmount}>{formatRupee(totalPayable)}</Text>
              <View style={styles.payoutSplit}>
                <View style={styles.payoutSplitItem}>
                  <Text style={styles.payoutSplitLabel}>Net Salary</Text>
                  <Text style={styles.payoutSplitValue}>{formatRupee(data?.netSalary)}</Text>
                </View>
                <View style={styles.payoutSplitSep} />
                <View style={styles.payoutSplitItem}>
                  <Text style={styles.payoutSplitLabel}>Net Wage</Text>
                  <Text style={styles.payoutSplitValue}>{formatRupee(data?.netWage)}</Text>
                </View>
              </View>
            </View>

            {/* Attendance summary */}
            <Text style={styles.sectionHeader}>Attendance</Text>
            <View style={styles.attendanceRow}>
              <View style={[styles.attendanceTile, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.attendanceValue}>{data?.presentDays ?? 0}</Text>
                <Text style={styles.attendanceLabel}>Present Days</Text>
              </View>
              <View style={[styles.attendanceTile, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="briefcase" size={16} color="#7C3AED" />
                <Text style={styles.attendanceValue}>{data?.dailyWageDays ?? 0}</Text>
                <Text style={styles.attendanceLabel}>Daily Wage Days</Text>
              </View>
            </View>

            {/* Earnings breakdown */}
            <Text style={styles.sectionHeader}>Earnings Breakdown</Text>
            <View style={styles.breakdownCard}>
              <BreakdownRow
                icon="cash-outline"
                iconBg="#DBEAFE"
                iconColor="#3B4FD7"
                label="Regular Salary"
                sub="Monthly base"
                value={formatRupee(data?.regularSalary)}
              />
              <View style={styles.breakdownDivider} />
              <BreakdownRow
                icon="time-outline"
                iconBg="#FEF3C7"
                iconColor="#D97706"
                label="Regular Wage"
                sub="Daily-rate earnings"
                value={formatRupee(data?.regularWage)}
              />
              <View style={styles.breakdownDivider} />
              <BreakdownRow
                icon="wallet-outline"
                iconBg="#DCFCE7"
                iconColor="#16A34A"
                label="Net Salary"
                sub="After deductions"
                value={formatRupee(data?.netSalary)}
                emphasize
              />
              <View style={styles.breakdownDivider} />
              <BreakdownRow
                icon="card-outline"
                iconBg="#FCE7F3"
                iconColor="#DB2777"
                label="Net Wage"
                sub="After deductions"
                value={formatRupee(data?.netWage)}
                emphasize
              />
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={onDownload}
                disabled={busy !== null}
                activeOpacity={0.85}
              >
                {busy === 'download' ? (
                  <ActivityIndicator size="small" color="#3B4FD7" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={15} color="#3B4FD7" />
                    <Text style={styles.actionBtnSecondaryText}>Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={onShare}
                disabled={busy !== null}
                activeOpacity={0.85}
              >
                {busy === 'share' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.actionBtnPrimaryText}>Share PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {!loading && !data && (
          <Text style={styles.empty}>No payslip data for this month.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakdownRow({ icon, iconBg, iconColor, label, sub, value, emphasize }) {
  return (
    <View style={styles.breakdownRow}>
      <View style={[styles.breakdownIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <View style={styles.breakdownTextWrap}>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text style={styles.breakdownSub}>{sub}</Text>
      </View>
      <Text style={[styles.breakdownValue, emphasize && styles.breakdownValueEmphasize]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FB' },
  content: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 14, color: '#DC2626' },
  empty: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 24 },

  hero: {
    backgroundColor: '#3B4FD7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPayslip: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', letterSpacing: 1 },
  heroMonth: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  heroStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroStatusPaid: { backgroundColor: '#22C55E' },
  heroStatusPending: { backgroundColor: '#FACC15' },
  heroStatusText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 10 },

  heroEmpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroEmpLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.5 },
  heroEmpName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginTop: 1 },
  heroEmpRole: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  heroEmpId: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', marginTop: 1, letterSpacing: 0.5 },

  heroPeriodRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroPeriodText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  payoutLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', letterSpacing: 0.5 },
  payoutAmount: { fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 4 },
  payoutSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  payoutSplitItem: { flex: 1, alignItems: 'center' },
  payoutSplitSep: { width: 1, height: 26, backgroundColor: '#E5E7EB' },
  payoutSplitLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  payoutSplitValue: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 2 },

  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8 },

  attendanceRow: { flexDirection: 'row', gap: 8 },
  attendanceTile: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  attendanceValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 6 },
  attendanceLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginTop: 1 },

  breakdownCard: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  breakdownIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownTextWrap: { flex: 1, minWidth: 0 },
  breakdownLabel: { fontSize: 12, fontWeight: '700', color: '#111827' },
  breakdownSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  breakdownValueEmphasize: { color: '#15803D', fontWeight: '800' },
  breakdownDivider: { height: 1, backgroundColor: '#F3F4F6' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  actionBtnSecondaryText: { color: '#3B4FD7', fontSize: 12, fontWeight: '700' },
  actionBtnPrimary: { backgroundColor: '#3B4FD7' },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
