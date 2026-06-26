import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ChevronLeft, Share2, Printer, Pencil } from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { ticketApi, authApi } from '../../../api/client';
import { getSession } from '../../../auth/session';

// expo-print / expo-sharing / expo-file-system are platform-native; require
// lazily so the web bundle (and dev environments without the modules
// installed) still load. expo-file-system ships as a peer of expo-print
// so it's available without an explicit install.
const getPrintModule = () => {
  try { return require('expo-print'); } catch { return null; }
};
const getSharingModule = () => {
  try { return require('expo-sharing'); } catch { return null; }
};
// expo-file-system v19+ ships two surfaces:
//   - top-level `Paths` / `File` / `Directory` classes (the new API)
//   - `expo-file-system/legacy` with the old `cacheDirectory` /
//     `copyAsync` / `deleteAsync` (the top-level legacy fns THROW
//     at runtime — they only stay as type-level shims).
// Try the new API first, then fall back to the legacy submodule.
const getFileSystemModule = () => {
  try { return require('expo-file-system'); } catch { return null; }
};
const getLegacyFileSystem = () => {
  try { return require('expo-file-system/legacy'); } catch { return null; }
};

// Sanitise a string for safe use as a filename on Android / iOS / Windows.
function safeFilename(s) {
  return String(s || 'document')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const NAVY = '#1E1B4B';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function safeJson(s, fallback) {
  if (!s) return fallback;
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : fallback; }
  catch { return fallback; }
}

export default function DeliveryInvoiceReportScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { ticketId } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [shop, setShop] = useState(null);     // public shop card (name/mobile/address/gst)
  const [owner, setOwner] = useState(null);   // logged-in owner session (name + phone)
  const [customer, setCustomer] = useState(null); // customer record (for address fallback)
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const [t, inv, s] = await Promise.all([
        ticketApi.get(`/tickets/${ticketId}`).catch(() => null),
        ticketApi.get(`/tickets/${ticketId}/invoice`).catch(() => null),
        getSession().catch(() => null),
      ]);
      setTicket(t || {});
      setInvoice(inv || null);
      setOwner(s || null);
      // Public shop card for the "FROM" / letterhead block.
      if (t?.shopId) {
        try {
          const sh = await authApi.get(`/auth/shops/${t.shopId}/public`);
          setShop(sh || null);
        } catch { setShop(null); }
      }
      // The ticket's customerAddress field is a denormalized snapshot — for
      // older bookings or pickup flows it can be NULL even though the
      // customer DOES have an address row. Fall back to a lookup by phone
      // so the printed invoice still carries the address.
      if (t?.customerPhone && !t?.customerAddress) {
        try {
          const c = await ticketApi.get(`/customers/lookup`, { query: { mobile: t.customerPhone } });
          setCustomer(c || null);
        } catch { setCustomer(null); }
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading invoice..." />;
  if (!invoice) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#F4FBF6' }}>
        <Text className="text-[15px] font-extrabold text-gray-700">No invoice generated yet</Text>
        <Text className="text-[12px] text-gray-500 mt-2 text-center">
          Open the Invoice Generator from the Billing & Delivery screen to create one.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-5 px-6 py-3 rounded-2xl"
          style={{ backgroundColor: BRAND_GREEN_DARK }}
        >
          <Text className="text-white font-extrabold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spareLines = safeJson(invoice.spareLinesJson, []);
  const serviceLines = safeJson(invoice.serviceLinesJson, []);
  const halfGst = (Number(invoice.gstPercent) || 0) / 2;

  // Resolve shop / owner display fields. Prefer the freshly-fetched shop
  // (auth-service /shops/{id}/public) for legal info; fall back to the
  // logged-in owner's session for fields the public shop view doesn't carry.
  const shopName    = shop?.name || ticket?.shopName || 'GGFix Service Center';
  const shopMobile  = shop?.mobile || owner?.phone || '';
  const shopAddress = shop?.address || ticket?.shopAddress || '';
  const shopGst     = shop?.gstNumber || invoice?.gstNo || '';
  const ownerDisplayName = owner?.name || '';
  const customerName = ticket?.customerName || '';
  const trackingId = ticket?.trackingId || invoice?.invoiceNo || ticketId;

  // Resolved customer address: prefer the ticket's denormalized snapshot,
  // then the fetched customer's `address` (legacy concat), then a freshly
  // composed line from structured columns (addressLine / area / district /
  // state / pincode). Falls back to '—' so the receipt always shows the row.
  const composedCustomerAddr = customer
    ? [customer.addressLine, customer.area || customer.locality, customer.district || customer.city, customer.state, customer.pincode]
        .filter((p) => p && String(p).trim())
        .join(', ')
    : '';
  const customerAddress =
    ticket?.customerAddress
    || customer?.address
    || composedCustomerAddr
    || '—';

  // Per-row tax breakdown. Returns 0 GST when taxMode = WITHOUT or 0% so
  // the rendered tables match the saved invoice.totalGst.
  const gstPct = Number(invoice.gstPercent) || 0;
  const breakRow = (gross) => {
    if (invoice.taxMode === 'WITHOUT' || gstPct === 0) {
      return { base: +gross.toFixed(2), cgst: 0, sgst: 0, totalGst: 0, total: +gross.toFixed(2) };
    }
    if (invoice.taxMode === 'INCLUSIVE') {
      const base = gross / (1 + gstPct / 100);
      const cgst = +(base * (halfGst / 100)).toFixed(2);
      const sgst = +(base * (halfGst / 100)).toFixed(2);
      return {
        base: +base.toFixed(2), cgst, sgst,
        totalGst: +(gross - base).toFixed(2),
        total: +gross.toFixed(2),
      };
    }
    const base = gross;
    const cgst = +(base * (halfGst / 100)).toFixed(2);
    const sgst = +(base * (halfGst / 100)).toFixed(2);
    const totalGstRow = +(base * (gstPct / 100)).toFixed(2);
    return {
      base: +base.toFixed(2), cgst, sgst,
      totalGst: totalGstRow,
      total: +(base + totalGstRow).toFixed(2),
    };
  };

  const accumulate = (rows) => rows.reduce((acc, br) => ({
    base: +(acc.base + br.base).toFixed(2),
    cgst: +(acc.cgst + br.cgst).toFixed(2),
    sgst: +(acc.sgst + br.sgst).toFixed(2),
    totalGst: +(acc.totalGst + br.totalGst).toFixed(2),
    total: +(acc.total + br.total).toFixed(2),
  }), { base: 0, cgst: 0, sgst: 0, totalGst: 0, total: 0 });

  // Prefer the per-line breakdown the Invoice Generator already stored —
  // service lines store taxableValue = base (already divided) while spare
  // lines store taxableValue = gross, so re-running breakRow gives wrong
  // numbers for one of them. Using the stored cgst/sgst/totalGst/totalAmount
  // guarantees the Deliver Invoice mirrors what the owner saw on the
  // Generator's "Charges Summary" exactly.
  const breakLine = (row, fallbackGross) => {
    if (row && (row.totalGst !== undefined || row.cgst !== undefined || row.totalAmount !== undefined)) {
      const cgst = Number(row.cgst) || 0;
      const sgst = Number(row.sgst) || 0;
      const totalGst = Number(row.totalGst) || 0;
      const total = Number(row.totalAmount) || fallbackGross;
      return { base: +(total - totalGst).toFixed(2), cgst, sgst, totalGst, total };
    }
    return breakRow(fallbackGross);
  };

  const serviceBreaks = serviceLines.map((r) => breakLine(r, Number(r.totalAmount) || Number(r.rate) || 0));
  const spareBreaks = spareLines.map((r) => breakLine(r, Number(r.totalAmount) || ((Number(r.taxableValue) || 0) * (Number(r.qty) || 1))));
  const totalServiceGross = serviceLines.reduce((s, r) => s + (Number(r.taxableValue) || Number(r.rate) || 0), 0);
  const totalSpareGross = spareLines.reduce((s, r) => s + (Number(r.taxableValue) || 0) * (Number(r.qty) || 1), 0);
  const totalServiceBreak = accumulate(serviceBreaks);
  const totalSpareBreak = accumulate(spareBreaks);
  const grandTotalBreak = {
    base: +(totalServiceBreak.base + totalSpareBreak.base).toFixed(2),
    cgst: +(totalServiceBreak.cgst + totalSpareBreak.cgst).toFixed(2),
    sgst: +(totalServiceBreak.sgst + totalSpareBreak.sgst).toFixed(2),
    totalGst: +(totalServiceBreak.totalGst + totalSpareBreak.totalGst).toFixed(2),
    total: +(totalServiceBreak.total + totalSpareBreak.total).toFixed(2),
  };

  // Render the on-screen invoice as a print-quality HTML page so expo-print
  // can rasterize it to a PDF. The <title> drives the suggested file name
  // on Android when the user picks "Save to PDF" from the share sheet.
  const buildInvoiceHtml = () => buildHtml({
    invoice, ticket, spareLines, serviceLines,
    shopName, shopMobile, shopAddress, shopGst, ownerDisplayName,
    customerName, customerAddress, trackingId,
    totalServiceGross, totalServiceBreak, totalSpareGross, totalSpareBreak,
    grandTotalBreak,
  });

  const handleShare = async () => {
    // Use native Alert.alert for errors — guaranteed to render on every
    // Android/iOS build regardless of whether Burnt's native toast is wired
    // up. (`notify` failed silently for some users on this screen.)
    const fail = (title, message) => Alert.alert(title, message || '');

    try {
      const html = buildInvoiceHtml();
      // Web has no native share-file API — fall back to the text Share dialog.
      if (Platform.OS === 'web') {
        await Share.share({
          message:
            `🧾 Invoice ${trackingId}\nFinal Payable: ₹${fmt(invoice.finalPayableAmount)}\n${invoice.amountInWords || ''}`,
          title: `Invoice ${trackingId}`,
        });
        return;
      }

      const Print = getPrintModule();
      const Sharing = getSharingModule();
      if (!Print) {
        fail('PDF module not installed', 'expo-print is missing. Run `npm install --legacy-peer-deps` and restart Metro with `npx expo start --clear`.');
        return;
      }
      if (!Sharing) {
        fail('Share module not installed', 'expo-sharing is missing. Run `npm install --legacy-peer-deps` and restart Metro.');
        return;
      }

      setSharing(true);

      // Step 1: render the PDF (this is the must-succeed step).
      let tempUri;
      try {
        const printed = await Print.printToFileAsync({ html, base64: false });
        tempUri = printed?.uri;
      } catch (e) {
        fail('PDF render failed', e?.message || 'Could not generate PDF');
        return;
      }
      if (!tempUri) {
        fail('PDF render failed', 'No file URI returned by expo-print.');
        return;
      }

      // Step 2: best-effort rename. The renamed file makes the receiving app
      // (WhatsApp/Drive/Gmail) display a friendly filename. If anything
      // breaks here we silently keep the temp URI — share must still fire.
      const fileBase = `Mobile_service_Invoice_${safeFilename(invoice.invoiceNo || trackingId)}`;
      const fileName = `${fileBase}.pdf`;
      let sharedUri = tempUri;
      try {
        sharedUri = await renamePdf(tempUri, fileName) || tempUri;
      } catch (_) { /* fall through with tempUri */ }

      // Step 3: share. Don't gate on isAvailableAsync — on Android it can
      // return false in some build types even though shareAsync works fine.
      try {
        await Sharing.shareAsync(sharedUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: fileName,
        });
      } catch (e) {
        // Some Android versions throw "User did not share" on cancel — that
        // isn't a real failure. Surface only message-bearing errors.
        const msg = e?.message || '';
        if (msg && !/cancel|dismiss|user/i.test(msg)) {
          fail('Share failed', msg);
        }
      }
    } catch (e) {
      fail('Share failed', e?.message || 'Try again');
    } finally {
      setSharing(false);
    }
  };

  // Best-effort PDF rename. Tries new expo-file-system v19+ API first
  // (`Paths.cache` + `new File(...).copy()`), then the legacy submodule.
  // Returns the renamed URI or null when both paths fail.
  const renamePdf = async (sourceUri, fileName) => {
    const FileSystem = getFileSystemModule();
    if (FileSystem && FileSystem.Paths && FileSystem.File) {
      try {
        const cacheDir = FileSystem.Paths.cache;
        const dest = new FileSystem.File(cacheDir, fileName);
        try { dest.delete(); } catch (_) {}
        const src = new FileSystem.File(sourceUri);
        const maybePromise = src.copy(dest);
        if (maybePromise && typeof maybePromise.then === 'function') await maybePromise;
        return dest.uri;
      } catch (_) { /* fall through to legacy */ }
    }
    const Legacy = getLegacyFileSystem();
    if (Legacy?.cacheDirectory && Legacy?.copyAsync) {
      try {
        const targetUri = Legacy.cacheDirectory + fileName;
        try { await Legacy.deleteAsync(targetUri, { idempotent: true }); } catch (_) {}
        await Legacy.copyAsync({ from: sourceUri, to: targetUri });
        return targetUri;
      } catch (_) { /* give up */ }
    }
    return null;
  };

  const handleEdit = () => {
    navigation.navigate('InvoiceGenerator', { ticketId });
  };

  const Cell = ({ children, w, bold, right, mono }) => (
    <Text
      className={`text-[10px] ${bold ? 'font-extrabold text-gray-900' : 'text-gray-700'} ${right ? 'text-right' : ''}`}
      style={{ width: w, paddingHorizontal: 4, paddingVertical: 6 }}
      numberOfLines={2}
    >
      {children}
    </Text>
  );

  const HeaderCell = ({ children, w, right }) => (
    <Text
      className={`text-[9px] font-extrabold text-gray-700 ${right ? 'text-right' : ''}`}
      style={{ width: w, paddingHorizontal: 4, paddingVertical: 6, letterSpacing: 0.4 }}
    >
      {children}
    </Text>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="flex-1 text-white text-[17px] font-extrabold" numberOfLines={1}>
            Deliver Invoice
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', maxWidth: 160 }}
          >
            <Text className="text-white text-[11px] font-extrabold" numberOfLines={1}>
              #{invoice.invoiceNo}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* Letterhead + Meta — shop legal name on the left, invoice
            metadata on the right. Delivery Date now reflects the moment
            the invoice was generated (not the booking's estimated delivery)
            so the line tracks the actual invoice timestamp. */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <View className="flex-row items-start">
              <View className="flex-1 pr-3">
                <Text className="text-[18px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                  {shopName}
                </Text>
                {ownerDisplayName ? (
                  <Text className="text-[11px] font-semibold text-gray-700 mt-0.5">
                    {ownerDisplayName}
                  </Text>
                ) : null}
                {shopMobile ? (
                  <Text className="text-[10.5px] text-gray-500 mt-1">Mobile : {shopMobile}</Text>
                ) : null}
              </View>
              <View>
                <Text className="text-[10px] font-extrabold text-gray-500 text-right" style={{ letterSpacing: 0.4 }}>
                  Original for Deliver Receipt
                </Text>
                <MetaRow label="Invoice No" value={invoice.invoiceNo} />
                <MetaRow label="Ticket Date" value={formatDateTime(invoice.ticketDate)} />
                <MetaRow label="Delivery Date" value={formatDateTime(invoice.generatedAt || invoice.deliveryDate)} />
                {shopGst ? <MetaRow label="GST No" value={shopGst} /> : null}
              </View>
            </View>

            <View className="my-3" style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB' }} />

            {/* Bill To / From */}
            <View className="flex-row">
              <View className="flex-1 pr-2">
                <Text className="text-[10px] font-extrabold text-gray-500" style={{ letterSpacing: 0.4 }}>
                  TO:
                </Text>
                <Text className="text-[13px] font-extrabold text-gray-900 mt-1">
                  {ticket?.customerName || '—'}
                </Text>
                {customerAddress && customerAddress !== '—' ? (
                  <Text className="text-[11px] text-gray-600 mt-1 leading-4">
                    {customerAddress}
                  </Text>
                ) : null}
                {ticket?.customerPhone ? (
                  <Text className="text-[11px] text-gray-700 mt-2 font-semibold">
                    Mobile : {ticket.customerPhone}
                  </Text>
                ) : null}
              </View>
              <View className="flex-1 pl-2 items-end">
                <Text className="text-[10px] font-extrabold text-gray-500" style={{ letterSpacing: 0.4 }}>
                  FROM:
                </Text>
                <Text className="text-[13px] font-extrabold text-gray-900 mt-1 text-right">
                  {shopName}
                </Text>
                {shopMobile ? (
                  <Text className="text-[11px] text-gray-700 mt-1 text-right font-semibold">
                    Mobile : {shopMobile}
                  </Text>
                ) : null}
                {shopAddress ? (
                  <Text className="text-[11px] text-gray-600 mt-1 text-right leading-4">
                    {shopAddress}
                  </Text>
                ) : null}
                {shopGst ? (
                  <Text className="text-[11px] text-gray-700 mt-1 text-right font-semibold">
                    GSTIN : {shopGst}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* (A) Service — 8 columns matching the reference (adds Total). */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>
            <View className="px-4 pt-3 pb-2">
              <Text className="text-[11.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                (A) Service
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ backgroundColor: '#F8FAFC', flexDirection: 'row' }}>
                  <HeaderCell w={28}>Sl</HeaderCell>
                  <HeaderCell w={130}>Description</HeaderCell>
                  <HeaderCell w={70} right>Rate (₹)</HeaderCell>
                  <HeaderCell w={82} right>Taxable Value</HeaderCell>
                  <HeaderCell w={60} right>CGST</HeaderCell>
                  <HeaderCell w={60} right>SGST</HeaderCell>
                  <HeaderCell w={72} right>Total GST</HeaderCell>
                  <HeaderCell w={70} right>Total</HeaderCell>
                </View>
                {serviceLines.length === 0 ? (
                  <View className="px-3 py-3"><Text className="text-[11px] text-gray-500">—</Text></View>
                ) : serviceLines.map((row, i) => {
                  const br = serviceBreaks[i];
                  return (
                    <View
                      key={i}
                      className="flex-row"
                      style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
                    >
                      <Cell w={28}>{row.slNo || i + 1}</Cell>
                      <Cell w={130}>{row.description}</Cell>
                      <Cell w={70} right>{fmt(row.rate)}</Cell>
                      <Cell w={82} right>{fmt(br.base)}</Cell>
                      <Cell w={60} right>{fmt(br.cgst)}</Cell>
                      <Cell w={60} right>{fmt(br.sgst)}</Cell>
                      <Cell w={72} right bold>{fmt(br.totalGst)}</Cell>
                      <Cell w={70} right bold>{fmt(br.total)}</Cell>
                    </View>
                  );
                })}
                <View
                  className="flex-row"
                  style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#F0FDF4' }}
                >
                  <Cell w={28} bold></Cell>
                  <Cell w={130} bold>Total Amount (₹)</Cell>
                  <Cell w={70} right bold>{fmt(totalServiceGross)}</Cell>
                  <Cell w={82} right bold>{fmt(totalServiceBreak.base)}</Cell>
                  <Cell w={60} right bold>{fmt(totalServiceBreak.cgst)}</Cell>
                  <Cell w={60} right bold>{fmt(totalServiceBreak.sgst)}</Cell>
                  <Cell w={72} right bold>{fmt(totalServiceBreak.totalGst)}</Cell>
                  <Cell w={70} right bold>{fmt(totalServiceBreak.total)}</Cell>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* (B) Spares table — also horizontal-scrollable so the right-edge
            GST column can't slip behind a floating overflow menu. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>
            <View className="px-4 pt-3 pb-2">
              <Text className="text-[11.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                (B) Spares
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ backgroundColor: '#F8FAFC', flexDirection: 'row' }}>
                  <HeaderCell w={28}>Sl</HeaderCell>
                  <HeaderCell w={130}>Description</HeaderCell>
                  <HeaderCell w={64}>Warranty</HeaderCell>
                  <HeaderCell w={44} right>Qty</HeaderCell>
                  <HeaderCell w={68} right>Rate</HeaderCell>
                  <HeaderCell w={82} right>Taxable Value</HeaderCell>
                  <HeaderCell w={60} right>CGST</HeaderCell>
                  <HeaderCell w={60} right>SGST</HeaderCell>
                  <HeaderCell w={72} right>Total GST</HeaderCell>
                  <HeaderCell w={70} right>Total</HeaderCell>
                </View>
                {spareLines.length === 0 ? (
                  <View className="px-3 py-3"><Text className="text-[11px] text-gray-500">—</Text></View>
                ) : spareLines.map((row, i) => {
                  const br = spareBreaks[i];
                  return (
                    <View
                      key={i}
                      className="flex-row"
                      style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
                    >
                      <Cell w={28}>{row.slNo || i + 1}</Cell>
                      <Cell w={130}>{row.description}</Cell>
                      <Cell w={64}>{row.warranty || '—'}</Cell>
                      <Cell w={44} right>{Number(row.qty || 1).toFixed(2)}</Cell>
                      <Cell w={68} right>{fmt(row.rate)}</Cell>
                      <Cell w={82} right>{fmt(br.base)}</Cell>
                      <Cell w={60} right>{fmt(br.cgst)}</Cell>
                      <Cell w={60} right>{fmt(br.sgst)}</Cell>
                      <Cell w={72} right bold>{fmt(br.totalGst)}</Cell>
                      <Cell w={70} right bold>{fmt(br.total)}</Cell>
                    </View>
                  );
                })}
                <View
                  className="flex-row"
                  style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#F0FDF4' }}
                >
                  <Cell w={28} bold></Cell>
                  <Cell w={130} bold>Total Amount (₹)</Cell>
                  <Cell w={64}></Cell>
                  <Cell w={44}></Cell>
                  <Cell w={68} right bold>{fmt(totalSpareGross)}</Cell>
                  <Cell w={82} right bold>{fmt(totalSpareBreak.base)}</Cell>
                  <Cell w={60} right bold>{fmt(totalSpareBreak.cgst)}</Cell>
                  <Cell w={60} right bold>{fmt(totalSpareBreak.sgst)}</Cell>
                  <Cell w={72} right bold>{fmt(totalSpareBreak.totalGst)}</Cell>
                  <Cell w={70} right bold>{fmt(totalSpareBreak.total)}</Cell>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Tax Summary — consolidated Service + Spares + Grand Total. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>
            <View className="px-4 pt-3 pb-2">
              <Text className="text-[11.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                Tax Summary
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ backgroundColor: '#F8FAFC', flexDirection: 'row' }}>
                  <HeaderCell w={28}>Sl</HeaderCell>
                  <HeaderCell w={120}>Description</HeaderCell>
                  <HeaderCell w={92} right>Taxable Value</HeaderCell>
                  <HeaderCell w={68} right>CGST</HeaderCell>
                  <HeaderCell w={68} right>SGST</HeaderCell>
                  <HeaderCell w={80} right>Total GST</HeaderCell>
                  <HeaderCell w={80} right>Total</HeaderCell>
                </View>
                <View className="flex-row" style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <Cell w={28}>1</Cell>
                  <Cell w={120}>Service</Cell>
                  <Cell w={92} right>{fmt(totalServiceBreak.base)}</Cell>
                  <Cell w={68} right>{fmt(totalServiceBreak.cgst)}</Cell>
                  <Cell w={68} right>{fmt(totalServiceBreak.sgst)}</Cell>
                  <Cell w={80} right>{fmt(totalServiceBreak.totalGst)}</Cell>
                  <Cell w={80} right bold>{fmt(totalServiceBreak.total)}</Cell>
                </View>
                <View className="flex-row" style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <Cell w={28}>2</Cell>
                  <Cell w={120}>Spares</Cell>
                  <Cell w={92} right>{fmt(totalSpareBreak.base)}</Cell>
                  <Cell w={68} right>{fmt(totalSpareBreak.cgst)}</Cell>
                  <Cell w={68} right>{fmt(totalSpareBreak.sgst)}</Cell>
                  <Cell w={80} right>{fmt(totalSpareBreak.totalGst)}</Cell>
                  <Cell w={80} right bold>{fmt(totalSpareBreak.total)}</Cell>
                </View>
                <View
                  className="flex-row"
                  style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#F0FDF4' }}
                >
                  <Cell w={28} bold></Cell>
                  <Cell w={120} bold>Total payable by customer (₹)</Cell>
                  <Cell w={92} right bold>{fmt(grandTotalBreak.base)}</Cell>
                  <Cell w={68} right bold>{fmt(grandTotalBreak.cgst)}</Cell>
                  <Cell w={68} right bold>{fmt(grandTotalBreak.sgst)}</Cell>
                  <Cell w={80} right bold>{fmt(grandTotalBreak.totalGst)}</Cell>
                  <Cell w={80} right bold>{fmt(grandTotalBreak.total)}</Cell>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Total Payable Summary — Taxable Amount → Total GST → Discount →
            Invoice Total (matches the requested 4-row structure). */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <Text className="text-[11.5px] font-extrabold mb-2" style={{ color: BRAND_GREEN_DARK }}>
              Total Payable Summary
            </Text>
            <View className="flex-row justify-between py-1">
              <Text className="text-[12px] text-gray-700">Taxable Amount</Text>
              <Text className="text-[12.5px] font-bold text-gray-900">₹{fmt(grandTotalBreak.base)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-[12px] text-gray-700">Total GST Tax (₹)</Text>
              <Text className="text-[12.5px] font-bold text-gray-900">₹{fmt(grandTotalBreak.totalGst)}</Text>
            </View>
            <View
              className="flex-row justify-between py-1"
              style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', borderStyle: 'dashed' }}
            >
              <Text className="text-[12px] text-gray-700">Discount</Text>
              <Text className="text-[12.5px] font-bold" style={{ color: '#B45309' }}>− ₹{fmt(invoice.discount)}</Text>
            </View>
            <View
              className="mt-3 p-3 rounded-2xl flex-row items-center justify-between"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <Text className="text-white text-[13.5px] font-extrabold">Invoice Total</Text>
              <Text className="text-white text-[18px] font-extrabold">
                ₹{fmt(invoice.finalPayableAmount)}
              </Text>
            </View>
            {invoice.amountInWords ? (
              <Text className="text-[11px] text-gray-600 mt-2 italic">
                In words: {invoice.amountInWords}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Signature + declaration — customer signature line is followed by
            the customer's name so the receipt is identifiable even when the
            signature itself is hand-drawn. The right tile carries the legal
            shop name AND the logged-in owner's name. */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-2xl p-4" style={cardShadow}>
            <View className="flex-row">
              <View className="flex-1 pr-2">
                <Text className="text-[11px] text-gray-700">Customer Signature :</Text>
                <View className="mt-6" style={{ borderBottomWidth: 1, borderBottomColor: '#94A3B8' }} />
                {customerName ? (
                  <Text className="text-[11px] font-extrabold text-gray-800 mt-1">
                    {customerName}
                  </Text>
                ) : null}
              </View>
              <View
                className="flex-1 ml-2 rounded-xl p-3 items-center"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                <Text className="text-[11px] font-extrabold text-gray-800" numberOfLines={2}>
                  {shopName}
                </Text>
                {ownerDisplayName ? (
                  <Text className="text-[10.5px] font-semibold text-gray-700 mt-0.5" numberOfLines={1}>
                    {ownerDisplayName}
                  </Text>
                ) : null}
                <Text className="text-[10px] text-gray-500 mt-1">Authorised Signatory</Text>
              </View>
            </View>
            <Text className="text-[10px] font-extrabold text-gray-700 mt-4">Declaration</Text>
            <Text className="text-[10.5px] text-gray-600 mt-1 leading-4">
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bar: Back · Edit · Share (PDF). Edit routes back to
          InvoiceGenerator so the owner can correct figures without
          regenerating from scratch. */}
      <View
        className="absolute left-0 right-0 bottom-0 flex-row px-4 pt-3"
        style={{
          paddingBottom: insets.bottom + 12,
          backgroundColor: 'rgba(244,251,246,0.96)',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
          className="rounded-2xl py-3.5 px-4 flex-row items-center justify-center"
          style={{ backgroundColor: NAVY, ...cardShadow }}
        >
          <ArrowLeft size={16} color="#FFFFFF" />
          <Text className="ml-2 text-white text-[13.5px] font-extrabold">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleEdit}
          className="flex-1 mx-2 rounded-2xl py-3.5 flex-row items-center justify-center"
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: BRAND_GREEN_DARK,
            ...cardShadow,
          }}
        >
          <Pencil size={15} color={BRAND_GREEN_DARK} />
          <Text className="ml-2 text-[13.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleShare}
          className="rounded-2xl"
          style={{ ...cardShadow, opacity: sharing ? 0.85 : 1 }}
        >
          <LinearGradient
            colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={16} color="#FFFFFF" />
            <Text className="ml-2 text-white text-[14px] font-extrabold">Share</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetaRow({ label, value }) {
  return (
    <View className="flex-row items-center mt-1">
      <Text className="text-[10px] text-gray-500" style={{ width: 84 }}>{label}</Text>
      <Text className="text-[10px] text-gray-700 font-semibold">: </Text>
      <Text className="text-[10px] font-bold text-gray-900" numberOfLines={1}>{value}</Text>
    </View>
  );
}

// HTML escape — keep the invoice safe from values containing &, <, >, etc.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtH(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateH(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Render the on-screen invoice as a printable HTML document. The
// <title> drives the suggested file name on Android share sheets.
function buildHtml({
  invoice, ticket, spareLines, serviceLines,
  shopName, shopMobile, shopAddress, shopGst, ownerDisplayName,
  customerName, customerAddress, trackingId,
  totalServiceGross, totalServiceBreak, totalSpareGross, totalSpareBreak,
  grandTotalBreak,
}) {
  const gstPct = Number(invoice.gstPercent) || 0;
  const halfGst = gstPct / 2;
  // Per-row tax breakdown. Returns base / cgst / sgst / totalGst / total
  // consistent with the saved invoice.taxMode — so when the invoice was saved
  // as WITHOUT, every per-row GST cell is 0 (matching invoice.totalGst).
  const breakRow = (gross) => {
    if (invoice.taxMode === 'WITHOUT' || gstPct === 0) {
      return { base: +gross.toFixed(2), cgst: 0, sgst: 0, totalGst: 0, total: +gross.toFixed(2) };
    }
    if (invoice.taxMode === 'INCLUSIVE') {
      const base = gross / (1 + gstPct / 100);
      const cgst = +(base * (halfGst / 100)).toFixed(2);
      const sgst = +(base * (halfGst / 100)).toFixed(2);
      return {
        base: +base.toFixed(2),
        cgst, sgst,
        totalGst: +(gross - base).toFixed(2),
        total: +gross.toFixed(2),
      };
    }
    // EXCLUSIVE
    const base = gross;
    const cgst = +(base * (halfGst / 100)).toFixed(2);
    const sgst = +(base * (halfGst / 100)).toFixed(2);
    const totalGstRow = +(base * (gstPct / 100)).toFixed(2);
    return {
      base: +base.toFixed(2),
      cgst, sgst,
      totalGst: totalGstRow,
      total: +(base + totalGstRow).toFixed(2),
    };
  };

  // Same accumulator + stored-breakdown preference used by the on-screen
  // tables. Avoids the double-divide bug where serviceLinesJson stores
  // taxableValue = base (already divided) and the PDF re-divided it.
  const accumulate = (rows) => rows.reduce((acc, br) => ({
    base: +(acc.base + br.base).toFixed(2),
    cgst: +(acc.cgst + br.cgst).toFixed(2),
    sgst: +(acc.sgst + br.sgst).toFixed(2),
    totalGst: +(acc.totalGst + br.totalGst).toFixed(2),
    total: +(acc.total + br.total).toFixed(2),
  }), { base: 0, cgst: 0, sgst: 0, totalGst: 0, total: 0 });

  const breakLine = (row, fallbackGross) => {
    if (row && (row.totalGst !== undefined || row.cgst !== undefined || row.totalAmount !== undefined)) {
      const cgst = Number(row.cgst) || 0;
      const sgst = Number(row.sgst) || 0;
      const totalGst = Number(row.totalGst) || 0;
      const total = Number(row.totalAmount) || fallbackGross;
      return { base: +(total - totalGst).toFixed(2), cgst, sgst, totalGst, total };
    }
    return breakRow(fallbackGross);
  };

  const serviceBreaks = serviceLines.map((row) => breakLine(row, Number(row.totalAmount) || Number(row.rate) || 0));
  const spareBreaks = spareLines.map((row) => breakLine(row, Number(row.totalAmount) || ((Number(row.taxableValue) || 0) * (Number(row.qty) || 1))));
  const serviceTotal = accumulate(serviceBreaks);
  const sparesTotal = accumulate(spareBreaks);
  const grandTotal = {
    base: +(serviceTotal.base + sparesTotal.base).toFixed(2),
    cgst: +(serviceTotal.cgst + sparesTotal.cgst).toFixed(2),
    sgst: +(serviceTotal.sgst + sparesTotal.sgst).toFixed(2),
    totalGst: +(serviceTotal.totalGst + sparesTotal.totalGst).toFixed(2),
    total: +(serviceTotal.total + sparesTotal.total).toFixed(2),
  };

  const serviceRows = serviceLines.map((row, i) => {
    const br = serviceBreaks[i];
    return `<tr>
      <td>${esc(row.slNo || i + 1)}</td>
      <td>${esc(row.description)}</td>
      <td class="r">${fmtH(row.rate)}</td>
      <td class="r">${fmtH(br.base)}</td>
      <td class="r">${fmtH(br.cgst)}</td>
      <td class="r">${fmtH(br.sgst)}</td>
      <td class="r b">${fmtH(br.totalGst)}</td>
      <td class="r b">${fmtH(br.total)}</td>
    </tr>`;
  }).join('');

  const spareRows = spareLines.map((row, i) => {
    const br = spareBreaks[i];
    return `<tr>
      <td>${esc(row.slNo || i + 1)}</td>
      <td>${esc(row.description)}</td>
      <td>${esc(row.warranty || '—')}</td>
      <td class="r">${Number(row.qty || 1).toFixed(2)}</td>
      <td class="r">${fmtH(row.rate)}</td>
      <td class="r">${fmtH(br.base)}</td>
      <td class="r">${fmtH(br.cgst)}</td>
      <td class="r">${fmtH(br.sgst)}</td>
      <td class="r b">${fmtH(br.totalGst)}</td>
      <td class="r b">${fmtH(br.total)}</td>
    </tr>`;
  }).join('');

  // Compact one-page sharing receipt — paper-thin top header (no big green
  // band), four-up meta strip, side-by-side parties block with both addresses,
  // tight tables, prominent total band, and a single-line "Customer
  // Signature : <name>" + "Authorised Signatory : <shop / owner>" footer.
  // Padding and font sizes tuned so the whole receipt fits one A4 page.
  const customerAddrLine = customerAddress || '—';
  const gt = grandTotalBreak || { base: 0, totalGst: 0, total: 0 };
  const taxableAmount   = gt.base;
  const totalGstTax     = gt.totalGst;
  const discountAmount  = Number(invoice.discount) || 0;
  const invoiceTotal    = Number(invoice.finalPayableAmount) || 0;
  // Filename hint for Android share sheets: many viewers (WhatsApp,
  // Drive, etc.) suggest the HTML <title> as the saved filename when
  // the file is shared, so we set it to match the renamed PDF.
  const fileTitle = `Mobile_service_Invoice_${String(invoice.invoiceNo || trackingId).replace(/[^A-Za-z0-9_-]+/g, '_')}`;
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${esc(fileTitle)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    margin: 0; padding: 0;
    color: #0f172a;
    background: #ffffff;
    font-size: 10.5px;
    line-height: 1.4;
  }
  .page { max-width: 760px; margin: 0 auto; padding: 10px 14px; }

  /* Receipt-style header — green left bar + brand + invoice meta. No big band. */
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 10px 12px 12px 14px;
    border-left: 4px solid #22c55e;
    border-bottom: 2px solid #15803d;
    background: #f0fdf4;
    border-radius: 6px 6px 0 0;
  }
  .head .brand { font-size: 19px; font-weight: 900; color: #15803d; line-height: 1.05; }
  .head .sub   { font-size: 10.5px; color: #374151; margin-top: 2px; font-weight: 600; }
  .head .right { text-align: right; font-size: 10px; }
  .pill {
    display: inline-block;
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #86efac;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 9px;
    letter-spacing: .5px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .head .inv { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 4px; }

  /* Meta strip — four in a row, no gaps, divider style like Amazon receipt */
  .meta-strip {
    display: flex;
    border: 1px solid #e5e7eb;
    border-top: 0;
    border-radius: 0 0 6px 6px;
    background: #fafcfb;
  }
  .meta-strip .col {
    flex: 1;
    padding: 6px 10px;
    border-right: 1px solid #e5e7eb;
  }
  .meta-strip .col:last-child { border-right: 0; }
  .meta-strip .k {
    font-size: 8.5px;
    color: #6b7280;
    letter-spacing: .35px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .meta-strip .v { font-size: 11px; color: #0f172a; font-weight: 800; margin-top: 1px; }

  /* Cards */
  .card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px 12px;
    margin-top: 8px;
  }
  .sec {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9.5px;
    font-weight: 900;
    color: #15803d;
    letter-spacing: .6px;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .sec::before {
    content: "";
    display: inline-block;
    width: 3px; height: 11px;
    border-radius: 2px;
    background: #22c55e;
  }

  /* Bill To / From */
  .tofrom { display: flex; gap: 12px; }
  .tofrom > div { flex: 1; }
  .tofrom .lbl { color: #6b7280; font-size: 9px; letter-spacing: .4px; font-weight: 800; text-transform: uppercase; }
  .tofrom .nm  { font-size: 12px; font-weight: 900; margin-top: 2px; color: #0f172a; }
  .tofrom .ln  { font-size: 10.5px; color: #4b5563; margin-top: 1px; }

  /* Tables */
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }
  th, td { padding: 5px 7px; vertical-align: top; }
  th {
    background: #f0fdf4;
    color: #15803d;
    font-size: 8.5px;
    letter-spacing: .35px;
    text-transform: uppercase;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 800;
  }
  th.r { text-align: right; }
  tbody tr + tr td { border-top: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) td { background: #fafcfb; }
  .r { text-align: right; }
  .b { font-weight: 800; }
  .totalrow td {
    background: #ecfdf5 !important;
    font-weight: 800;
    border-top: 2px solid #d1fae5;
    color: #064e3b;
  }

  /* Bill summary */
  .sum-card {
    margin-top: 8px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    font-size: 11px;
    color: #374151;
  }
  .row b { color: #0f172a; }
  .row.sep { border-top: 1px dashed #e5e7eb; margin-top: 3px; padding-top: 5px; }
  .final {
    margin-top: 6px;
    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
    color: #fff;
    padding: 9px 14px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .final .lbl { font-weight: 800; letter-spacing: .2px; font-size: 11.5px; }
  .final .amt { font-size: 16px; font-weight: 900; }
  .words {
    font-size: 10px;
    color: #4b5563;
    margin-top: 5px;
    font-style: italic;
  }

  /* Single-line signatures + declaration */
  .sigs {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafcfb;
    font-size: 10.5px;
  }
  .sigs .l { color: #6b7280; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: .4px; }
  .sigs .v { font-weight: 800; color: #0f172a; margin-left: 4px; font-size: 11px; }
  .sigs .v small { font-weight: 600; color: #374151; }

  .decl {
    margin-top: 8px;
    padding: 6px 12px;
    background: #fff7ed;
    border: 1px dashed #fed7aa;
    border-radius: 6px;
    font-size: 9.5px;
    color: #7c2d12;
  }
  .decl b { color: #9a3412; }

  .thank { margin-top: 6px; text-align: center; font-size: 9.5px; color: #6b7280; font-style: italic; }
</style>
</head>
<body>
  <div class="page">

    <!-- Compact receipt header -->
    <div class="head">
      <div>
        <span class="pill">Tax Invoice</span>
        <div class="brand" style="margin-top:4px">${esc(shopName)}</div>
        ${ownerDisplayName ? `<div class="sub">${esc(ownerDisplayName)}${shopMobile ? ` · ${esc(shopMobile)}` : ''}</div>` : (shopMobile ? `<div class="sub">${esc(shopMobile)}</div>` : '')}
      </div>
      <div class="right">
        <span class="pill" style="background:#fff;border-color:#22c55e">Original Copy</span>
      </div>
    </div>

    <!-- Meta strip (Amazon-style horizontal info row) -->
    <div class="meta-strip">
      <div class="col"><div class="k">Invoice No</div><div class="v">${esc(invoice.invoiceNo)}</div></div>
      <div class="col"><div class="k">Ticket Date</div><div class="v">${fmtDateH(invoice.ticketDate)}</div></div>
      <div class="col"><div class="k">Delivery Date</div><div class="v">${fmtDateH(invoice.generatedAt || invoice.deliveryDate)}</div></div>
      ${shopGst ? `<div class="col"><div class="k">GSTIN</div><div class="v">${esc(shopGst)}</div></div>` : ''}
    </div>

    <!-- Bill To / From -->
    <div class="card">
      <div class="sec">Parties</div>
      <div class="tofrom">
        <div>
          <div class="lbl">Billed To</div>
          <div class="nm">${esc(customerName || '—')}</div>
          ${ticket?.customerPhone ? `<div class="ln">Mobile · ${esc(ticket.customerPhone)}</div>` : ''}
          <div class="ln">Address · ${esc(customerAddrLine)}</div>
        </div>
        <div style="text-align:right">
          <div class="lbl">Issued By</div>
          <div class="nm">${esc(shopName)}</div>
          ${shopMobile ? `<div class="ln">Mobile · ${esc(shopMobile)}</div>` : ''}
          ${shopAddress ? `<div class="ln">${esc(shopAddress)}</div>` : ''}
          ${shopGst ? `<div class="ln">GSTIN · ${esc(shopGst)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- (A) Service — adds Total (₹) column matching the reference layout -->
    <div class="card">
      <div class="sec">(A) Service</div>
      <table>
        <thead><tr>
          <th>Sl</th><th>Description</th>
          <th class="r">Rate (₹)</th>
          <th class="r">Taxable Value (₹)</th>
          <th class="r">CGST (₹)</th>
          <th class="r">SGST (₹)</th>
          <th class="r">Total GST (₹)</th>
          <th class="r">Total (₹)</th>
        </tr></thead>
        <tbody>
          ${serviceRows || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">—</td></tr>'}
          <tr class="totalrow">
            <td></td><td>Total Amount (₹)</td>
            <td class="r">${fmtH(totalServiceGross)}</td>
            <td class="r">${fmtH(serviceTotal.base)}</td>
            <td class="r">${fmtH(serviceTotal.cgst)}</td>
            <td class="r">${fmtH(serviceTotal.sgst)}</td>
            <td class="r">${fmtH(serviceTotal.totalGst)}</td>
            <td class="r">${fmtH(serviceTotal.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- (B) Spares — adds CGST / SGST / Total GST / Total (₹) columns -->
    <div class="card">
      <div class="sec">(B) Spares</div>
      <table>
        <thead><tr>
          <th>Sl</th><th>Description</th><th>Warranty</th>
          <th class="r">Qty</th>
          <th class="r">Rate (₹)</th>
          <th class="r">Taxable Value (₹)</th>
          <th class="r">CGST (₹)</th>
          <th class="r">SGST (₹)</th>
          <th class="r">Total GST (₹)</th>
          <th class="r">Total (₹)</th>
        </tr></thead>
        <tbody>
          ${spareRows || '<tr><td colspan="10" style="text-align:center;color:#9ca3af">—</td></tr>'}
          <tr class="totalrow">
            <td></td><td>Total Amount (₹)</td><td></td><td></td>
            <td class="r">${fmtH(totalSpareGross)}</td>
            <td class="r">${fmtH(sparesTotal.base)}</td>
            <td class="r">${fmtH(sparesTotal.cgst)}</td>
            <td class="r">${fmtH(sparesTotal.sgst)}</td>
            <td class="r">${fmtH(sparesTotal.totalGst)}</td>
            <td class="r">${fmtH(sparesTotal.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Consolidated tax summary — rolls (A) Service and (B) Spares into one
         table the reference receipt shows above the Bill Summary. -->
    <div class="card">
      <div class="sec">Tax Summary</div>
      <table>
        <thead><tr>
          <th>Sl</th><th>Description</th>
          <th class="r">Taxable Value (₹)</th>
          <th class="r">CGST (₹)</th>
          <th class="r">SGST (₹)</th>
          <th class="r">Total GST (₹)</th>
          <th class="r">Total (₹)</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>1</td><td>Service</td>
            <td class="r">${fmtH(serviceTotal.base)}</td>
            <td class="r">${fmtH(serviceTotal.cgst)}</td>
            <td class="r">${fmtH(serviceTotal.sgst)}</td>
            <td class="r">${fmtH(serviceTotal.totalGst)}</td>
            <td class="r b">${fmtH(serviceTotal.total)}</td>
          </tr>
          <tr>
            <td>2</td><td>Spares</td>
            <td class="r">${fmtH(sparesTotal.base)}</td>
            <td class="r">${fmtH(sparesTotal.cgst)}</td>
            <td class="r">${fmtH(sparesTotal.sgst)}</td>
            <td class="r">${fmtH(sparesTotal.totalGst)}</td>
            <td class="r b">${fmtH(sparesTotal.total)}</td>
          </tr>
          <tr class="totalrow">
            <td></td><td>Total payable by customer (₹)</td>
            <td class="r">${fmtH(grandTotal.base)}</td>
            <td class="r">${fmtH(grandTotal.cgst)}</td>
            <td class="r">${fmtH(grandTotal.sgst)}</td>
            <td class="r">${fmtH(grandTotal.totalGst)}</td>
            <td class="r">${fmtH(grandTotal.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Total Payable Summary — Taxable Amount → Total GST → Discount →
         Invoice Total (matches the requested 4-row structure). -->
    <div class="sum-card">
      <div class="sec">Total Payable Summary</div>
      <div class="row"><span>Taxable Amount</span><b>₹${fmtH(taxableAmount)}</b></div>
      <div class="row"><span>Total GST Tax (₹)</span><b>₹${fmtH(totalGstTax)}</b></div>
      <div class="row sep"><span>Discount</span><b style="color:#b45309">− ₹${fmtH(discountAmount)}</b></div>
      <div class="final"><span class="lbl">Invoice Total</span><span class="amt">₹${fmtH(invoiceTotal)}</span></div>
      ${invoice.amountInWords ? `<div class="words">In words : ${esc(invoice.amountInWords)}</div>` : ''}
    </div>

    <!-- Single-line signature row: customer name + authorised signatory -->
    <div class="sigs">
      <div>
        <span class="l">Customer Signature :</span>
        <span class="v">${esc(customerName || '—')}</span>
      </div>
      <div style="text-align:right">
        <span class="l">Authorised Signatory :</span>
        <span class="v">${esc(shopName)}${ownerDisplayName ? ` <small>· ${esc(ownerDisplayName)}</small>` : ''}</span>
      </div>
    </div>

    <div class="decl">
      <b>Declaration :</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
    </div>

    <div class="thank">Thank you for choosing ${esc(shopName)}</div>
  </div>
</body></html>`;
}
