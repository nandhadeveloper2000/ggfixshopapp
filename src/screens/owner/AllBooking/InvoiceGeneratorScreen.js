import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronDown,
  Wrench,
  Package,
  ReceiptText,
  Percent,
  IndianRupee,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { ticketApi } from '../../../api/client';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const TAX_MODES = [
  { value: 'WITHOUT',   label: 'Without' },
  { value: 'INCLUSIVE', label: 'Inclusive' },
  { value: 'EXCLUSIVE', label: 'Exclusive' },
];

const GST_OPTIONS = [0, 3, 5, 12, 18, 28];

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Convert a number to Indian-numbering words (lakh/crore). Used for the
// "Total amount in words" line on the rendered Deliver Invoice report.
function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  const n = Math.round(Number(num));
  if (n === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const two = (x) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const three = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? ones[h] + ' Hundred' + (r ? ' and ' : '') : '') + (r ? two(r) : '');
  };
  let s = '';
  const crore = Math.floor(n / 10000000);
  const lakh  = Math.floor((n % 10000000) / 100000);
  const thou  = Math.floor((n % 100000) / 1000);
  const rest  = n % 1000;
  if (crore) s += two(crore) + ' Crore ';
  if (lakh)  s += two(lakh)  + ' Lakh ';
  if (thou)  s += two(thou)  + ' Thousand ';
  if (rest)  s += three(rest);
  return s.trim();
}

function SectionHeader({ icon: Icon, label, tint = '#DCFCE7', accent = BRAND_GREEN_DARK }) {
  return (
    <View className="flex-row items-center mb-3">
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: tint }}
      >
        <Icon size={14} color={accent} />
      </View>
      <Text
        className="text-[11px] font-bold tracking-widest"
        style={{ color: accent, letterSpacing: 1.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

// Inline picker — renders the options as a row of pills. Avoids the heavy
// native picker which doesn't theme well and isn't needed for 3-6 fixed values.
function PillPicker({ value, options, onChange, formatLabel }) {
  return (
    <View className="flex-row flex-wrap -mx-1">
      {options.map((opt) => {
        const v = typeof opt === 'object' ? opt.value : opt;
        const label = typeof opt === 'object' ? opt.label : (formatLabel ? formatLabel(opt) : String(opt));
        const active = value === v;
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            className="px-3 py-2 rounded-full m-1"
            style={{
              backgroundColor: active ? BRAND_GREEN : '#F1F5F9',
              borderWidth: 1,
              borderColor: active ? BRAND_GREEN_DARK : '#E2E8F0',
            }}
          >
            <Text
              className="text-[12px] font-extrabold"
              style={{ color: active ? '#FFFFFF' : '#374151' }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function priceItemsFromTicket(ticket) {
  if (Array.isArray(ticket?.priceItems)) return ticket.priceItems;
  if (ticket?.priceItemsJson) {
    try {
      const parsed = JSON.parse(ticket.priceItemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return ticket?.services?.map?.((s) => ({ id: s.id, label: s.serviceName, amount: s.price })) || [];
}

export default function InvoiceGeneratorScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { ticketId } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state — the visible inputs the owner edits
  const [serviceChargesStr, setServiceChargesStr] = useState('0');
  const [discountStr, setDiscountStr] = useState('0');
  const [taxMode, setTaxMode] = useState('WITHOUT');
  const [gstPercent, setGstPercent] = useState(0);
  // Editable spare lines: [{id, description, rate, warranty, qty, taxableValue}]
  const [spareLines, setSpareLines] = useState([]);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const [t, inv] = await Promise.all([
        ticketApi.get(`/tickets/${ticketId}`).catch(() => null),
        ticketApi.get(`/tickets/${ticketId}/invoice`).catch(() => null),
      ]);
      setTicket(t || {});
      setExisting(inv || null);

      // Spare lines ALWAYS come from the current booking items — never from a
      // prior invoice snapshot. If we trust the saved snapshot we end up
      // hiding items that were added (or fixing) after the first generation,
      // which is exactly the "Screen Broken missing" bug.
      const items = priceItemsFromTicket(t);
      setSpareLines(items.map((it, i) => {
        const rate = Number(it.amount || 0);
        return {
          id: it.id || `spare-${i}`,
          description: it.label || it.serviceName || `Item ${i + 1}`,
          rate,
          warranty: it.warranty || '',
          qty: 1,
          // Default Taxable Value = Rate. Owner can override per-row to
          // declare a smaller taxable portion if there's a margin.
          taxableValue: rate,
        };
      }));

      // Service Charges (A) is always a fresh manual entry starting at 0.
      // The tax / GST / discount picks are user preferences worth keeping
      // across visits, so those still rehydrate from the prior invoice.
      setServiceChargesStr('0');
      if (inv) {
        setDiscountStr(String(Number(inv.discount || 0)));
        setTaxMode(inv.taxMode || 'WITHOUT');
        setGstPercent(Number(inv.gstPercent || 0));
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Mutate a single field on one spare line — used by every editable cell.
  const updateSpareField = useCallback((index, field, value) => {
    setSpareLines((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  // Derived totals — recomputed on every render so the bottom card always
  // matches the inputs. Same formulas the backend stores verbatim.
  const totals = useMemo(() => {
    const serviceCharges = Number(serviceChargesStr) || 0;
    const discount       = Number(discountStr) || 0;
    const totalRepairAmount = spareLines.reduce((s, r) => s + (Number(r.rate) || 0) * (Number(r.qty) || 1), 0);
    const spareUtility = spareLines.reduce((s, r) => s + (Number(r.taxableValue) || 0) * (Number(r.qty) || 1), 0);
    const amount2plus3 = serviceCharges + spareUtility - discount;
    const gst = Number(gstPercent) || 0;

    let baseAmount, totalGst, finalPayable;
    if (taxMode === 'INCLUSIVE') {
      baseAmount = gst > 0 ? amount2plus3 / (1 + gst / 100) : amount2plus3;
      totalGst   = amount2plus3 - baseAmount;
      finalPayable = amount2plus3;
    } else if (taxMode === 'EXCLUSIVE') {
      baseAmount = amount2plus3;
      totalGst   = amount2plus3 * (gst / 100);
      finalPayable = amount2plus3 + totalGst;
    } else {
      baseAmount = amount2plus3;
      totalGst   = 0;
      finalPayable = amount2plus3;
    }
    return {
      serviceCharges, discount, totalRepairAmount, spareUtility,
      amount2plus3, baseAmount, totalGst, finalPayable,
    };
  }, [serviceChargesStr, discountStr, spareLines, gstPercent, taxMode]);

  // Build the per-row charges-summary table the screenshots show under
  // Inclusive / Exclusive modes. Split GST evenly between CGST + SGST.
  const chargesSummary = useMemo(() => {
    const gst = Number(gstPercent) || 0;
    const halfRate = gst / 200; // CGST = SGST = gst/2 / 100
    const buildRow = (label, gross) => {
      // Inclusive: gross already contains GST, so base = gross/(1+gst%).
      //   Per-row total GST is the exact diff (gross-base) — using
      //   cgst+sgst alone drifts by half-paise from rounding, hence the
      //   "Rounded Value" column on the reference shows that delta.
      // Exclusive: gross is the pre-tax base; total = base + gst.
      let base, totalGstRow, total;
      if (taxMode === 'INCLUSIVE') {
        base = gst > 0 ? gross / (1 + gst / 100) : gross;
        totalGstRow = +(gross - base).toFixed(2);
        total = +gross.toFixed(2);
      } else {
        base = gross;
        totalGstRow = +(base * (gst / 100)).toFixed(2);
        total = +(base + totalGstRow).toFixed(2);
      }
      const cgst = +(base * halfRate).toFixed(2);
      const sgst = +(base * halfRate).toFixed(2);
      const rounded = +((cgst + sgst) - totalGstRow).toFixed(2);
      return {
        label,
        base: +base.toFixed(2),
        cgst,
        sgst,
        rounded,
        totalGst: totalGstRow,
        total,
      };
    };
    const rows = [];
    if (totals.serviceCharges > 0) rows.push(buildRow('A', totals.serviceCharges));
    spareLines.forEach((sp, i) => {
      const grossGross = (Number(sp.taxableValue) || 0) * (Number(sp.qty) || 1);
      if (grossGross > 0) rows.push(buildRow(String.fromCharCode(66 + i), grossGross));
    });
    return rows;
  }, [taxMode, gstPercent, totals.serviceCharges, spareLines]);

  const showChargesSummary = taxMode !== 'WITHOUT' && Number(gstPercent) > 0;

  const onGenerate = async () => {
    setSubmitting(true);
    try {
      // Build a slNo→breakdown map from chargesSummary so spare lines carry
      // the exact CGST/SGST/RoundedValue/TotalGst the user saw on screen.
      // The Delivery Invoice Report later renders straight from this JSON,
      // avoiding any recompute drift.
      const breakdownByLabel = Object.fromEntries(
        chargesSummary.map((r) => [r.label, r])
      );
      const serviceBd = breakdownByLabel['A'];
      const serviceLines = totals.serviceCharges > 0 ? [{
        slNo: 'A',
        description: 'Service Charges',
        rate: totals.serviceCharges,
        taxableValue: serviceBd ? serviceBd.base : (
          taxMode === 'INCLUSIVE' && gstPercent > 0
            ? +(totals.serviceCharges / (1 + gstPercent / 100)).toFixed(2)
            : totals.serviceCharges
        ),
        cgst: serviceBd?.cgst ?? 0,
        sgst: serviceBd?.sgst ?? 0,
        roundedValue: serviceBd?.rounded ?? 0,
        totalGst: serviceBd?.totalGst ?? 0,
        totalAmount: serviceBd?.total ?? totals.serviceCharges,
      }] : [];
      const body = {
        ticketDate: ticket?.createdAt || null,
        deliveryDate: ticket?.deliveredAt || null,
        gstNo: ticket?.shopGstNo || null,
        serviceCharges: totals.serviceCharges,
        totalRepairAmount: totals.totalRepairAmount,
        spareUtilityCharge: totals.spareUtility,
        discount: totals.discount,
        taxMode,
        gstPercent,
        amount2Plus3: totals.amount2plus3,
        baseAmount: +totals.baseAmount.toFixed(2),
        totalGst: +totals.totalGst.toFixed(2),
        finalPayableAmount: +totals.finalPayable.toFixed(2),
        amountInWords: `Rupees ${numberToIndianWords(totals.finalPayable)} Only`,
        spareLinesJson: JSON.stringify(spareLines.map((sp, i) => {
          const slNo = String.fromCharCode(66 + i);
          const bd = breakdownByLabel[slNo];
          return {
            slNo,
            description: sp.description,
            rate: Number(sp.rate) || 0,
            warranty: sp.warranty || '',
            qty: Number(sp.qty) || 1,
            taxableValue: Number(sp.taxableValue) || 0,
            cgst: bd?.cgst ?? 0,
            sgst: bd?.sgst ?? 0,
            roundedValue: bd?.rounded ?? 0,
            totalGst: bd?.totalGst ?? 0,
            totalAmount: bd?.total ?? ((Number(sp.taxableValue) || 0) * (Number(sp.qty) || 1)),
          };
        })),
        serviceLinesJson: JSON.stringify(serviceLines),
      };
      const resp = await ticketApi.post(`/tickets/${ticketId}/invoice`, { body });
      // Mirror the save to the service history rail so the BookingTimeline /
      // customer history shows an "Invoice Generated" step the moment the
      // invoice lands. emitProgressStepEvent is idempotent server-side, so
      // re-generating the same invoice won't duplicate the timeline row —
      // it refreshes the existing note + timestamp instead.
      try {
        await ticketApi.post(`/tickets/${ticketId}/progress-events`, {
          body: {
            statusKey: 'INVOICE_GENERATED',
            note: `Invoice #${resp.invoiceNo || ticket?.trackingId || ticketId} generated`,
            actor: 'SHOP',
          },
        });
      } catch (_) { /* timeline event is non-critical — the invoice still saved */ }
      notify('Invoice Generated', `Invoice #${resp.invoiceNo || ticket?.trackingId || ticketId} saved.`, { preset: 'done' });
      navigation.replace('DeliveryInvoiceReport', { ticketId, invoiceId: resp.id });
    } catch (e) {
      notify('Generate failed', e?.message || 'Could not generate invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader label="Loading invoice generator..." />;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
            className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-surface-muted"
          >
            <ChevronLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text className="flex-1 text-text text-[17px] font-extrabold" numberOfLines={1}>
            Invoice Generator
          </Text>
          {ticket?.trackingId ? (
            <View
              className="px-2.5 py-1 rounded-full bg-surface-muted"
              style={{ maxWidth: 160 }}
            >
              <Text className="text-text text-[11px] font-extrabold" numberOfLines={1}>
                #{ticket.trackingId}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
      >
        {/* (A) Service Charges — single row matching the reference:
            label on the left, narrow input on the right. */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13.5px] font-bold text-gray-900">
                (A) Service Charges
              </Text>
              <View
                className="flex-row items-center px-3 py-1.5 rounded-lg"
                style={{
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  minWidth: 130,
                }}
              >
                <Text className="text-[13px] font-extrabold mr-1 text-gray-700">₹</Text>
                <TextInput
                  value={serviceChargesStr}
                  onChangeText={(v) => setServiceChargesStr(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#0F172A',
                    padding: 0,
                    textAlign: 'right',
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Spare Part Taxable Value — bordered table matching the reference
            (Sl.No | Description | Rate | Warranty | Qty | Taxable Value).
            6 cols won't fit a phone width, so the table scrolls horizontally
            and every cell is editable in-place. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-3">
              <SectionHeader icon={Package} label="SPARE PART TAXABLE VALUE" />
              {spareLines.length > 0 ? (
                <Text className="text-[10px] font-bold text-gray-400" style={{ letterSpacing: 0.4 }}>
                  {spareLines.length} {spareLines.length === 1 ? 'ITEM' : 'ITEMS'}
                </Text>
              ) : null}
            </View>

            {spareLines.length === 0 ? (
              <Text className="text-[12px] text-gray-500 py-3">No spare parts recorded.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <View
                    className="flex-row"
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderBottomWidth: 1,
                      borderBottomColor: '#E2E8F0',
                    }}
                  >
                    <SpareHeadCell w={44}>Sl.No</SpareHeadCell>
                    <SpareHeadCell w={140}>Description</SpareHeadCell>
                    <SpareHeadCell w={90}>Rate</SpareHeadCell>
                    <SpareHeadCell w={90}>Warranty</SpareHeadCell>
                    <SpareHeadCell w={56}>Qty</SpareHeadCell>
                    <SpareHeadCell w={100} last>Taxable Value</SpareHeadCell>
                  </View>
                  {/* Body */}
                  {spareLines.map((sp, i) => {
                    const isLast = i === spareLines.length - 1;
                    return (
                      <View
                        key={sp.id || i}
                        className="flex-row"
                        style={{
                          borderBottomWidth: isLast ? 0 : 1,
                          borderBottomColor: '#E2E8F0',
                        }}
                      >
                        <SpareReadCell w={44}>
                          {String.fromCharCode(66 + i)}
                        </SpareReadCell>
                        <SpareInputCell
                          w={140}
                          value={sp.description}
                          onChange={(v) => updateSpareField(i, 'description', v)}
                        />
                        <SpareInputCell
                          w={90}
                          prefix="₹"
                          value={String(sp.rate ?? '')}
                          onChange={(v) => updateSpareField(i, 'rate', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                        />
                        <SpareInputCell
                          w={90}
                          value={String(sp.warranty ?? '')}
                          onChange={(v) => updateSpareField(i, 'warranty', v)}
                        />
                        <SpareInputCell
                          w={56}
                          value={String(sp.qty ?? '')}
                          onChange={(v) => updateSpareField(i, 'qty', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                        />
                        <SpareInputCell
                          w={100}
                          last
                          prefix="₹"
                          value={String(sp.taxableValue ?? '')}
                          onChange={(v) => updateSpareField(i, 'taxableValue', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          accent={BRAND_GREEN_DARK}
                        />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            {spareLines.length > 0 ? (
              <Text className="text-[10px] text-gray-400 mt-2">
                Tap any cell to edit · scroll → for full row
              </Text>
            ) : null}
          </View>
        </View>

        {/* Repair totals — plain numbered rows matching the reference (no
            colored badges, no SectionHeader). Discount (4) keeps an input
            box on the right since it's the only editable value here. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <SectionHeader icon={ReceiptText} label="REPAIR TOTALS" />
            <PlainTotalRow label="(1) Total Repair Amount" value={`₹${fmt(totals.totalRepairAmount)}`} />
            <PlainTotalRow label="(2) Service Charges"      value={`₹${fmt(totals.serviceCharges)}`} />
            <PlainTotalRow label="(3) Spare Utility Charges (Taxable Value)" value={`₹${fmt(totals.spareUtility)}`} />
            <View className="flex-row items-center py-1.5">
              <Text className="text-[12.5px] font-semibold text-gray-700 flex-1">
                (4) Discount
              </Text>
              <View
                className="flex-row items-center px-3 py-1.5 rounded-lg"
                style={{
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  minWidth: 130,
                }}
              >
                <Text className="text-[13px] font-extrabold mr-1 text-gray-700">₹</Text>
                <TextInput
                  value={discountStr}
                  onChangeText={(v) => setDiscountStr(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#0F172A',
                    textAlign: 'right',
                    padding: 0,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Tax / GST / Amount — three columns side-by-side matching the
            reference (Tax dropdown · GST % dropdown · readonly Amount). */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <SectionHeader icon={Percent} label="TAX & GST" />
            <View className="flex-row" style={{ marginHorizontal: -4 }}>
              <View className="flex-1 px-1">
                <Text
                  className="text-[11px] font-bold text-gray-700 mb-1.5"
                  style={{ letterSpacing: 0.3 }}
                >
                  Tax
                </Text>
                <InlineDropdown
                  value={taxMode}
                  options={TAX_MODES}
                  onChange={setTaxMode}
                />
              </View>
              <View className="flex-1 px-1">
                <Text
                  className="text-[11px] font-bold text-gray-700 mb-1.5"
                  style={{ letterSpacing: 0.3 }}
                >
                  GST %
                </Text>
                <InlineDropdown
                  value={gstPercent}
                  options={GST_OPTIONS}
                  onChange={setGstPercent}
                  formatLabel={(v) => `${v}%`}
                />
              </View>
              <View className="flex-1 px-1">
                <Text
                  className="text-[11px] font-bold text-gray-700 mb-1.5"
                  style={{ letterSpacing: 0.3 }}
                >
                  Amount ( 2 + 3 )
                </Text>
                <View
                  className="px-3 py-2 rounded-xl"
                  style={{
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    backgroundColor: '#F1F5F9',
                    minHeight: 38,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    className="text-[12.5px] font-extrabold"
                    style={{ color: '#0F172A' }}
                    numberOfLines={1}
                  >
                    {fmt(totals.amount2plus3)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Charges summary table (only when Inclusive/Exclusive with GST).
            7 columns won't fit a phone width, so the body scrolls
            horizontally; sticky-left "Item" stays anchored visually
            via its fixed width at the front of every row. */}
        {showChargesSummary && chargesSummary.length > 0 ? (
          <View className="px-4 mt-4">
            <View className="bg-white rounded-2xl p-4" style={cardShadow}>
              <SectionHeader
                icon={FileText}
                label={`CHARGES SUMMARY (CGST ${Number(gstPercent) / 2}% + SGST ${Number(gstPercent) / 2}%)`}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header */}
                  <View
                    className="flex-row pb-2 mb-1"
                    style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <ChargesHead w={32} align="left">ITEM</ChargesHead>
                    <ChargesHead w={92}>BASE (₹)</ChargesHead>
                    <ChargesHead w={78}>CGST (₹)</ChargesHead>
                    <ChargesHead w={78}>SGST (₹)</ChargesHead>
                    <ChargesHead w={78}>ROUNDED</ChargesHead>
                    <ChargesHead w={96}>TOTAL GST</ChargesHead>
                    <ChargesHead w={96}>TOTAL (₹)</ChargesHead>
                  </View>
                  {/* Body */}
                  {chargesSummary.map((r, i) => (
                    <View
                      key={i}
                      className="flex-row py-1.5"
                      style={{
                        borderBottomWidth: i < chargesSummary.length - 1 ? 1 : 0,
                        borderBottomColor: '#F8FAFC',
                      }}
                    >
                      <ChargesCell w={32} align="left" bold>{r.label}</ChargesCell>
                      <ChargesCell w={92}>{fmt(r.base)}</ChargesCell>
                      <ChargesCell w={78}>{fmt(r.cgst)}</ChargesCell>
                      <ChargesCell w={78}>{fmt(r.sgst)}</ChargesCell>
                      <ChargesCell w={78}>{fmt(r.rounded)}</ChargesCell>
                      <ChargesCell w={96}>{fmt(r.totalGst)}</ChargesCell>
                      <ChargesCell w={96} bold accent={BRAND_GREEN_DARK}>
                        {fmt(r.total)}
                      </ChargesCell>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text className="text-[10px] text-gray-400 mt-2">
                Total GST = CGST + SGST − Rounded Value · scroll → for full row
              </Text>
            </View>
          </View>
        ) : null}

        {/* Payable Summary — plain rows matching the reference (no dark
            green band, no SectionHeader). Final Payable still stands out
            via heavier font weight on the last row. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <SectionHeader icon={IndianRupee} label="PAYABLE SUMMARY" />
            <PlainTotalRow label="Base Amount (₹)" value={`₹${fmt(totals.baseAmount)}`} />
            <PlainTotalRow label="Total GST (₹)"   value={`₹${fmt(totals.totalGst)}`} divider />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-[13px] font-extrabold text-gray-900">
                Final Payable Amount (₹)
              </Text>
              <Text className="text-[14px] font-extrabold text-gray-900">
                ₹{fmt(totals.finalPayable)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA — live total on the left, action button on the right so
          the owner always sees the payable amount update as they edit. */}
      <View
        className="absolute left-0 right-0 bottom-0 px-4 pt-2.5"
        style={{
          paddingBottom: insets.bottom + 12,
          backgroundColor: 'rgba(244,251,246,0.98)',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-3">
            <Text
              className="text-[10.5px] font-bold text-gray-500"
              style={{ letterSpacing: 0.6 }}
            >
              TOTAL PAYABLE
            </Text>
            <Text
              className="text-[21px] font-extrabold"
              style={{ color: BRAND_GREEN_DARK }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              ₹{fmt(totals.finalPayable)}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitting}
            onPress={onGenerate}
            style={cardShadow}
          >
            <LinearGradient
              colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 22,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <CheckCircle2 size={18} color="#FFFFFF" />
              )}
              <Text className="ml-2 text-white text-[15px] font-extrabold">
                {submitting ? 'Generating…' : 'Generate Invoice'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Single header cell of the bordered Spare Part Taxable Value table.
function SpareHeadCell({ w, last, children }) {
  return (
    <View
      style={{
        width: w,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: '#E2E8F0',
      }}
    >
      <Text className="text-[10.5px] font-extrabold text-gray-600">
        {children}
      </Text>
    </View>
  );
}

// Read-only body cell (used for the Sl.No badge column).
function SpareReadCell({ w, last, children }) {
  return (
    <View
      style={{
        width: w,
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text className="text-[12px] font-extrabold text-gray-700">
        {children}
      </Text>
    </View>
  );
}

// Editable body cell — every other column uses this so the table is
// inline-editable in the same row layout the reference shows.
function SpareInputCell({ w, last, value, onChange, prefix, keyboardType, accent }) {
  return (
    <View
      style={{
        width: w,
        paddingHorizontal: 6,
        paddingVertical: 6,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {prefix ? (
        <Text
          className="text-[11px] font-extrabold mr-1"
          style={{ color: accent || '#475569' }}
        >
          {prefix}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder="—"
        placeholderTextColor="#9CA3AF"
        style={{
          flex: 1,
          fontSize: 11.5,
          fontWeight: '700',
          color: accent || '#0F172A',
          padding: 0,
        }}
      />
    </View>
  );
}

// Pressable dropdown that opens a Modal with the option list. Used for the
// Tax mode and GST % pickers so the section matches the reference layout
// instead of the previous pill row.
function InlineDropdown({ value, options, onChange, formatLabel, placeholder }) {
  const [open, setOpen] = useState(false);
  const labelFor = (opt) =>
    typeof opt === 'object'
      ? opt.label
      : formatLabel
      ? formatLabel(opt)
      : String(opt);
  const valueOf = (opt) => (typeof opt === 'object' ? opt.value : opt);
  const selected = options.find((o) => valueOf(o) === value);
  const display = selected ? labelFor(selected) : placeholder || '—';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between px-3 rounded-xl"
        style={{
          borderWidth: 1,
          borderColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
          minHeight: 38,
        }}
      >
        <Text className="text-[12.5px] font-bold text-gray-900" numberOfLines={1}>
          {display}
        </Text>
        <ChevronDown size={16} color="#64748B" />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: 'rgba(15,23,42,0.45)' }}
          onPress={() => setOpen(false)}
        >
          <View
            className="w-full bg-white rounded-2xl overflow-hidden"
            style={cardShadow}
          >
            {options.map((opt, i) => {
              const v = valueOf(opt);
              const lbl = labelFor(opt);
              const active = value === v;
              return (
                <Pressable
                  key={String(v)}
                  onPress={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                  className="px-4 py-3"
                  style={{
                    backgroundColor: active ? '#F0FDF4' : '#FFFFFF',
                    borderBottomWidth: i < options.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  <Text
                    className="text-[13.5px] font-bold"
                    style={{ color: active ? BRAND_GREEN_DARK : '#374151' }}
                  >
                    {lbl}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ChargesHead({ w, align = 'right', children }) {
  return (
    <Text
      className="text-[9px] font-extrabold text-gray-500 px-1"
      style={{ width: w, letterSpacing: 0.5, textAlign: align }}
    >
      {children}
    </Text>
  );
}

function ChargesCell({ w, align = 'right', bold, accent, children }) {
  return (
    <Text
      className="text-[11px] px-1"
      style={{
        width: w,
        textAlign: align,
        fontWeight: bold ? '800' : '500',
        color: accent || (bold ? '#0F172A' : '#374151'),
      }}
    >
      {children}
    </Text>
  );
}

// Simple label/value row used by the Repair Totals + Payable Summary
// blocks. Mirrors the reference's clean plain-text rows (no badges).
function PlainTotalRow({ label, value, divider }) {
  return (
    <View
      className="flex-row items-center justify-between py-2"
      style={
        divider
          ? {
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }
          : null
      }
    >
      <Text className="text-[12.5px] font-semibold text-gray-700 flex-1 pr-2">
        {label}
      </Text>
      <Text className="text-[13px] font-extrabold text-gray-900">{value}</Text>
    </View>
  );
}

function NumberedRow({ no, label, value }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View
        className="w-6 h-6 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: '#DCFCE7' }}
      >
        <Text className="text-[10.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>{no}</Text>
      </View>
      <Text className="text-[12.5px] text-gray-700 flex-1">{label}</Text>
      <Text className="text-[13px] font-extrabold text-gray-900">{value}</Text>
    </View>
  );
}
