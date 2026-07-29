import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, TextInput, TouchableOpacity, View, StatusBar, useWindowDimensions, Modal, Linking, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Smartphone,
  Pencil,
  Clock,
  Share2,
  QrCode,
  FileText,
  UserPlus,
  RefreshCcw,
  RotateCw,
  MoreHorizontal,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  User,
  Users,
  Phone,
  MapPin,
  IndianRupee,
  ShieldCheck,
  ClipboardList,
  Zap,
  Calendar,
  Wrench,
  MessageSquare,
  ChevronRight,
  ScanLine,
  Plus,
} from 'lucide-react-native';
import {
  Card,
  Loader,
  EmptyState,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { ticketApi } from '../../../api/client';
import { getModelsByBrand } from '../../../api/masterData';

// Swiggy / Zomato green palette — same as the rest of the booking flow.
const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

// Closing booking steps the owner records by ticking + Submit. Two parallel
// paths after the repair stage: READY (repair completed, device going back to
// customer fixed) OR RETURN_DELIVERY (device not repaired, returning as-is).
// Both paths terminate at DELIVERED. The invoice / delivery-processing
// substeps are recorded automatically by the Invoice Generator + delivery
// flows, so they no longer need a manual checkbox here.
const OWNER_PROGRESS_ROWS = [
  { key: 'READY',           label: 'Ready for Delivery' },
  { key: 'RETURN_DELIVERY', label: 'Return Delivery' },
  { key: 'DELIVERED',       label: 'Delivered to Customer' },
];

// Status → tone + label. Same tone vocabulary the list screen uses so the
// pill rendered here matches the row in BookingHistory.
const STATUS_VARIANT = {
  CREATED:              { label: 'Service Accepted',     tone: 'amber' },
  ASSIGNED:             { label: 'Technician Assigned',  tone: 'blue' },
  IN_DIAGNOSIS:         { label: 'In Diagnosis',         tone: 'purple' },
  IN_REPAIR:            { label: 'In Service',           tone: 'purple' },
  QUOTED:               { label: 'Re-Estimated',         tone: 'amber' },
  APPROVED:             { label: 'Approved',             tone: 'blue' },
  READY:                { label: 'Ready for Delivery',                tone: 'green' },
  RETURN_DELIVERY:      { label: 'Return Delivery',                   tone: 'amber' },
  INVOICE_GENERATED:    { label: 'Billing & Delivery Invoice Generated', tone: 'amber' },
  INVOICE_READY:        { label: 'Invoice Sent',                      tone: 'amber' },
  DELIVERED_PROCESSING: { label: 'Delivery Processing',               tone: 'amber' },
  DELIVERED:            { label: 'Delivered',                         tone: 'green' },
  CANCELLED:            { label: 'Cancelled',                         tone: 'red' },
};

const TONE = {
  amber:  { bg: 'rgba(245, 158, 11, 0.12)', fg: '#B45309',        border: 'rgba(245, 158, 11, 0.35)' },
  blue:   { bg: 'rgba(59, 130, 246, 0.12)', fg: '#1D4ED8',        border: 'rgba(59, 130, 246, 0.35)' },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', fg: '#6D28D9',        border: 'rgba(168, 85, 247, 0.35)' },
  green:  { bg: 'rgba(22, 163, 74, 0.12)',  fg: BRAND_GREEN_DARK,  border: 'rgba(22, 163, 74, 0.35)' },
  red:    { bg: 'rgba(239, 68, 68, 0.12)',  fg: '#B91C1C',        border: 'rgba(239, 68, 68, 0.35)' },
};

// Linear booking lifecycle (matches the backend's LIFECYCLE_ORDER). Used so a
// Service Progress step counts as "done" once the ticket status is at/past it —
// e.g. after the invoice is generated, "Ready for Delivery" is already behind us.
const LIFECYCLE_ORDER = [
  'CREATED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR',
  'READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED',
];

// Statuses that imply the technician has actively picked up the job.
const ACCEPTED_STATUSES = new Set([
  'IN_DIAGNOSIS', 'IN_REPAIR', 'QUOTED', 'APPROVED', 'READY',
  'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED',
]);

const ACTION_TILES = [
  { key: 'edit',    label: 'Edit Booking',  icon: Pencil,   tint: 'rgba(34, 197, 94, 0.16)',  fg: BRAND_GREEN_DARK },
  { key: 'view',    label: 'View Details',  icon: FileText, tint: 'rgba(34, 197, 94, 0.12)',  fg: BRAND_GREEN_DARK },
  { key: 'history', label: 'History',       icon: Clock,    tint: 'rgba(168, 85, 247, 0.12)', fg: '#7C3AED' },
  { key: 'share',   label: 'Share Receipt', icon: Share2,   tint: 'rgba(34, 197, 94, 0.12)',  fg: ACCENT_GREEN },
  { key: 'barcode', label: 'Barcode',       icon: QrCode,   tint: 'rgba(245, 158, 11, 0.16)', fg: '#B45309' },
];

// "Update Status" auto-advances the booking one stage at a time along this
// owner-facing flow — the owner no longer hand-picks an arbitrary status.
// Cancelled sits outside the linear flow (reached via the Cancel action).
const ADVANCE_FLOW = ['CREATED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR', 'READY', 'DELIVERED'];

// Rank every lifecycle status so we can resolve "the next stage" even for
// statuses that sit off the linear owner flow (ASSIGNED, INVOICE_*, etc.).
const STATUS_RANK = {
  CREATED: 0, ASSIGNED: 0.5, IN_DIAGNOSIS: 1, QUOTED: 2, APPROVED: 3, IN_REPAIR: 4,
  READY: 5, INVOICE_GENERATED: 5.5, INVOICE_READY: 5.6, RETURN_DELIVERY: 5.7,
  DELIVERED_PROCESSING: 5.8, DELIVERED: 6,
};

// The stage to auto-advance to from the current status — or null when the
// booking is already delivered or cancelled (nothing further to advance to).
function nextStage(statusKey) {
  const key = String(statusKey || '').toUpperCase();
  if (key === 'CANCELLED' || key === 'DELIVERED') return null;
  const rank = STATUS_RANK[key] ?? 0;
  return ADVANCE_FLOW.find((s) => (STATUS_RANK[s] ?? 0) > rank) || null;
}

// Splits a tracking id into its letter prefix and trailing digits so the header
// pill can render the digits in brand green (e.g. #CSPEN·7627519), matching the
// design. Non-conforming ids fall back to an all-dark render.
function splitTrackingId(id) {
  const s = String(id ?? '');
  const m = s.match(/^(\D*)(\d.*)$/);
  return m ? { prefix: m[1], digits: m[2] } : { prefix: s, digits: '' };
}

function priceItemsFromTicket(ticket) {
  if (Array.isArray(ticket.priceItems)) return ticket.priceItems;
  if (ticket.priceItemsJson) {
    try {
      const parsed = JSON.parse(ticket.priceItemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return ticket.services?.map?.((s) => ({ id: s.id, label: s.serviceName, amount: s.price })) || [];
}

const formatINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function TicketDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Phones: full width. Tablets/large screens: cap + centre so the receipt and
  // info cards read as a tidy document instead of stretching edge-to-edge.
  const contentW = Math.min(winW, 760);
  const { ticketId } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const receiptRef = useRef(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ticketApi.get(`/tickets/${ticketId}`);
      setTicket(data);
      if (data?.assignedTechnicianId) {
        try {
          const list = await ticketApi.get('/technicians');
          const arr = Array.isArray(list) ? list : (list?.content || []);
          setTechnician(arr.find((x) => x.id === data.assignedTechnicianId) || null);
        } catch (_) { setTechnician(null); }
      } else {
        setTechnician(null);
      }
    } catch (e) {
      setError(e.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Service Progress — owner-side submission with Mark → Done/Cancel flow,
  // matching the technician Ticket Detail screen. The `done` state is sourced
  // from /tickets/{id}/events (any actor) so steps the technician already
  // recorded show as DONE here too. Steps the OWNER controls (invoice /
  // delivery) can still be ticked + submitted from this screen.
  //
  //   progressStatus → { [statusKey]: { done: true, at: ISO } }  (server truth)
  //   progressChecked → { [statusKey]: boolean }                 (UI tick)
  //   progressBusy   → statusKey currently being submitted (for spinner)
  const [progressStatus, setProgressStatus] = useState({});
  const [progressChecked, setProgressChecked] = useState({});
  const [progressBusy, setProgressBusy] = useState(null);

  // IMEI capture gate — a booking must carry an IMEI before it can be marked
  // "Ready for Delivery". If it's missing we pop a type-or-scan sheet, PATCH the
  // IMEI onto the ticket, then continue the progress submission.
  const [imeiModalOpen, setImeiModalOpen] = useState(false);
  const [imeiInput, setImeiInput] = useState('');
  const [imeiSaving, setImeiSaving] = useState(false);
  const pendingReadyRow = useRef(null); // the READY row awaiting IMEI, or null for a plain add

  const refreshProgress = useCallback(async () => {
    if (!ticketId) return;
    try {
      const rows = await ticketApi.get(`/tickets/${ticketId}/events`);
      const out = {};
      (Array.isArray(rows) ? rows : []).forEach((e) => {
        const k = (e.status || '').toUpperCase();
        if (!OWNER_PROGRESS_ROWS.some((r) => r.key === k)) return;
        // Keep the earliest timestamp per step (first-time-completed marker).
        const prev = out[k];
        if (!prev || (e.createdAt && new Date(e.createdAt) < new Date(prev.at))) {
          out[k] = { done: true, at: e.createdAt || null };
        }
      });
      setProgressStatus(out);
    } catch { /* keep current */ }
  }, [ticketId]);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  // Pull-to-reload via the floating refresh chip on the Service Info card — pulls
  // both the ticket record and the Service Progress events back in sync.
  const onRefresh = useCallback(() => { load(); refreshProgress(); }, [load, refreshProgress]);

  // Bottom-bar "Update Status" — same PATCH /tickets/{id}/status the technician
  // Update Status screen uses, exposed here as a light-themed bottom sheet so the
  // owner can jump the booking to any lifecycle state without walking the
  // Service Progress ticks one by one.
  const applyStatus = useCallback(async (nextStatus) => {
    if (!ticketId) return;
    setStatusBusy(nextStatus);
    try {
      await ticketApi.patch(`/tickets/${ticketId}/status`, { query: { status: nextStatus } });
      setStatusOpen(false);
      const label = STATUS_VARIANT[nextStatus]?.label || nextStatus;
      notify('Status updated', `Booking moved to "${label}".`, { preset: 'done' });
      load();
      refreshProgress();
    } catch (e) {
      notify('Update failed', e?.message || 'Try again', { preset: 'error', haptic: 'error' });
    } finally {
      setStatusBusy(null);
    }
  }, [ticketId, load, refreshProgress]);

  // Cancelling sits outside the linear auto-advance flow, so it stays an
  // explicit, confirmed action rather than a stage the owner advances into.
  const cancelBooking = useCallback(async () => {
    const ok = await confirm({
      title: 'Cancel booking',
      message: 'Cancel this booking? This moves it to Cancelled and can\'t be undone.',
      confirmText: 'Cancel booking',
      destructive: true,
    });
    if (ok) applyStatus('CANCELLED');
  }, [applyStatus]);

  const submitProgress = useCallback(async (row) => {
    setProgressBusy(row.key);
    try {
      await ticketApi.post(`/tickets/${ticketId}/progress-events`, {
        body: { statusKey: row.key, actor: 'SHOP' },
      });
      setProgressChecked((prev) => ({ ...prev, [row.key]: false }));
      // Optimistically mark done so the UI flips immediately; refreshProgress
      // then reconciles with the server's authoritative timestamp.
      setProgressStatus((prev) => ({
        ...prev,
        [row.key]: { done: true, at: prev[row.key]?.at || new Date().toISOString() },
      }));
      refreshProgress();
      notify('Saved', `"${row.label}" recorded.`, { preset: 'done' });
    } catch (e) {
      notify('Save failed', e?.message || 'Try again', { preset: 'error', haptic: 'error' });
    } finally {
      setProgressBusy(null);
    }
  }, [ticketId, refreshProgress]);

  // "Done" tap on a progress step. Ready for Delivery requires an IMEI — if the
  // booking has none, open the capture sheet instead of recording immediately.
  const onProgressDone = useCallback((row) => {
    const hasImei = !!String(ticket?.imei || '').trim();
    if (row.key === 'READY' && !hasImei) {
      pendingReadyRow.current = row;
      setImeiInput('');
      setImeiModalOpen(true);
      return;
    }
    submitProgress(row);
  }, [ticket, submitProgress]);

  // Opens the same sheet from the Service Info card, just to add/fix the IMEI
  // (no progress step to continue afterwards).
  const openImeiEntry = useCallback(() => {
    pendingReadyRow.current = null;
    setImeiInput(String(ticket?.imei || ''));
    setImeiModalOpen(true);
  }, [ticket]);

  const saveImeiAndContinue = useCallback(async () => {
    const imei = normaliseImei(imeiInput);
    if (!imei) {
      notify('Enter a valid IMEI', 'IMEI must be 14–17 digits. Dial *#06# on the device to see it.', { preset: 'error' });
      return;
    }
    setImeiSaving(true);
    try {
      await ticketApi.patch(`/tickets/${ticketId}`, { body: { imei } });
      setTicket((prev) => (prev ? { ...prev, imei } : prev));
      setImeiModalOpen(false);
      const row = pendingReadyRow.current;
      pendingReadyRow.current = null;
      if (row) await submitProgress(row); // continue the Ready-for-Delivery record
      else notify('Saved', 'IMEI added to this booking.', { preset: 'done' });
    } catch (e) {
      notify('Save failed', e?.message || 'Could not save the IMEI. Try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setImeiSaving(false);
    }
  }, [imeiInput, ticketId, submitProgress]);

  const buildMessage = () => {
    const lineItems = priceItemsFromTicket(ticket);
    const total = ticket.estimatedPrice || lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    return (
      `🧾 GGFix Booking Receipt\n\n` +
      `Tracking ID: ${ticket.trackingId || ticket.id}\n` +
      `Customer: ${ticket.customerName || '-'}\n` +
      `Mobile: ${ticket.customerPhone || '-'}\n` +
      `Device: ${ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || '-'}\n` +
      `Status: ${ticket.status || '-'}\n\n` +
      `Services:\n` +
      lineItems.map((i) => `  • ${i.label} — ₹${i.amount}`).join('\n') +
      `\n\nEstimated Total: ₹${total}\n\n` +
      `Track your repair in the GGFix app.`
    );
  };

  // Option 1 — capture the hidden receipt View as a PNG and open the system
  // share sheet so WhatsApp (and others) attach the receipt image. Falls back
  // to a plain-text share on any capture / sharing failure.
  const shareImage = async () => {
    setShareOpen(false);
    if (!ticket) return;
    try {
      const uri = await captureRef(receiptRef, { format: 'png', quality: 1, result: 'tmpfile' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Booking ${ticket.trackingId || ticket.id}`,
          UTI: 'public.png',
        });
        return;
      }
    } catch (_) { /* fall through to text share */ }
    try {
      await Share.share({ message: buildMessage(), title: `Booking ${ticket.trackingId || ticket.id}` });
    } catch (e) {
      notify('Share failed', e?.message || 'Could not open share sheet');
    }
  };

  // Option 2 — share the booking details as text. The bare `sms:` URL scheme
  // doesn't reliably pre-fill the body on Android (Samsung Messages drops it),
  // so we use Share.share — the text is the payload, so it always lands in the
  // SMS body (or WhatsApp text, etc.) when the user picks an app.
  const shareSms = async () => {
    setShareOpen(false);
    if (!ticket) return;
    try {
      await Share.share({ message: buildMessage() });
    } catch (e) {
      notify('Share failed', e?.message || 'Could not open the share sheet.');
    }
  };

  if (loading && !ticket) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View
          className="border-b border-border"
          style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16 }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              className="h-10 w-10 rounded-full items-center justify-center mr-3 active:opacity-70 bg-surface-muted"
            >
              <ArrowLeft size={20} color="#0F172A" />
            </Pressable>
            <Text className="flex-1 text-text text-[17px] font-extrabold">Booking Details</Text>
          </View>
        </View>
        <Loader label="Loading booking..." />
      </View>
    );
  }
  if (error || !ticket) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          title="Booking not found"
          description={error || 'We could not load this booking.'}
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const trackingId = ticket.trackingId || ticket.id;
  const tid = splitTrackingId(trackingId);
  const deviceName = ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || 'Device';
  const color = ticket.color;
  const ramLabel = ticket.ramLabel;
  const storageLabel = ticket.storageLabel;
  const customerName = ticket.customerName || '—';
  const phone = ticket.customerPhone || '';
  const address = ticket.customerAddress || '';

  const lineItems = priceItemsFromTicket(ticket);
  const estimatedTotal = ticket.estimatedPrice != null
    ? ticket.estimatedPrice
    : lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const statusKey = String(ticket.status || '').toUpperCase();
  const statusMeta = STATUS_VARIANT[statusKey] || { label: ticket.status || 'Pending', tone: 'amber' };
  const statusTone = TONE[statusMeta.tone] || TONE.amber;
  const StatusIcon = statusKey === 'CANCELLED' ? AlertCircle : CheckCircle2;
  const statusIdx = LIFECYCLE_ORDER.indexOf(statusKey);
  const hasTechnician = !!ticket.assignedTechnicianId;
  const techAccepted = hasTechnician && ACCEPTED_STATUSES.has(statusKey);
  const techName = technician?.name || (hasTechnician ? 'Assigned Technician' : null);
  const techCode = technician?.code
    || (technician?.id ? String(technician.id).slice(0, 8).toUpperCase() : null);

  const goToAssign = () => {
    // AssignTechnician is registered inside the nested RepairServiceBookingShop
    // stack, not on the outer OwnerNavigator. A flat navigate('AssignTechnician')
    // from this screen fails with "action NAVIGATE with payload was not handled"
    // because the outer stack has no route by that name. Use the nested-route
    // form so RN resolves it inside the booking sub-stack, same pattern as
    // Edit Booking → SelectBrand.
    navigation.navigate('RepairServiceBookingShop', {
      screen: 'AssignTechnician',
      params: {
        tickets: [ticket],
        customer: {
          id: ticket.customerId,
          name: ticket.customerName,
          phone: ticket.customerPhone,
          address: ticket.customerAddress,
        },
        devices: [{
          id: ticket.id,
          deviceDisplayName: deviceName,
          model: { name: deviceName },
        }],
        returnToTicketId: ticket.id,
      },
    });
  };

  const onAssignPress = async () => {
    const ok = await confirm({
      title: 'Assign Technician',
      message: `Pick a technician for booking ${trackingId}?`,
      confirmText: 'Choose Technician',
    });
    if (ok) goToAssign();
  };

  const onReassignPress = async () => {
    const ok = await confirm({
      title: 'Re-Assign Technician',
      message: `${techName || 'Current technician'} hasn't accepted this booking yet. Re-assign to someone else?`,
      confirmText: 'Re-Assign',
      destructive: true,
    });
    if (ok) goToAssign();
  };

  // Bottom-bar "Contact Customer" — opens the dialer pre-filled with the
  // customer's number. No-op with a toast when the booking has no phone.
  const contactCustomer = () => {
    if (!phone) {
      notify('No number', 'This booking has no customer phone on file.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() =>
      notify('Unable to call', 'Could not open the phone dialer.'),
    );
  };

  const onAction = async (key) => {
    switch (key) {
      case 'edit': {
        // Ticket doesn't store device categoryId — look it up from master-data
        // so SelectModel (and SelectBrand) can filter to Mobile only instead of
        // mixing in Laptops/Tablets that share the same brand (e.g. Apple).
        let categoryId = null;
        let categoryName = null;
        try {
          const list = await getModelsByBrand(ticket.brandId);
          const m = (list || []).find((x) => x.id === ticket.modelId);
          if (m?.categoryId) {
            categoryId = m.categoryId;
            categoryName = m.categoryName || null;
          }
        } catch (_) { /* fall through — unfiltered list is still OK */ }

        // Enter the nested booking stack at SelectBrand so the rest of the
        // wizard (DeviceColorStorage, DeviceServices, ServicePriceEstimate,
        // ServiceBookingDevicesList) resolves inside RepairServiceBookingShop
        // instead of erroring on a missing route in the parent stack.
        navigation.navigate('RepairServiceBookingShop', {
          screen: 'SelectBrand',
          params: {
            ...buildEditParams(ticket, { lineItems, estimatedTotal }),
            categoryId,
            categoryName,
            flow: 'BOOKING',
          },
        });
        break;
      }
      case 'view':    navigation.navigate('DeviceDetail', { ticketId: ticket.id }); break;
      case 'history': navigation.navigate('BookingTimeline', { ticketId: ticket.id }); break;
      case 'share':   setShareOpen(true); break;
      case 'barcode': navigation.navigate('BarcodePrint', { ticketId: ticket.id, mode: 'barcode' }); break;
      default: break;
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Hidden printable receipt — captured by view-shot when the user
          taps Share Receipt. Kept off-screen at left:-9999 so it lays out at
          real pixel sizes (ViewShot needs a non-collapsed measured view) but
          never shows. The visible Quick Actions tile triggers handleShare(),
          which calls captureRef(receiptRef) → Sharing.shareAsync(png).      */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -9999, top: 0, width: 360 }}
      >
        <ViewShot
          ref={receiptRef}
          options={{ format: 'png', quality: 1 }}
          collapsable={false}
          style={{ width: 360, backgroundColor: '#FFFFFF' }}
        >
          <ReceiptCard
            ticket={ticket}
            lineItems={priceItemsFromTicket(ticket)}
            estimatedTotal={
              ticket.estimatedPrice != null
                ? ticket.estimatedPrice
                : priceItemsFromTicket(ticket).reduce((s, i) => s + (Number(i.amount) || 0), 0)
            }
            technicianName={technician?.name || null}
          />
        </ViewShot>
      </View>

      {/* ── White header (replaces native white nav header) ── */}
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
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full items-center justify-center mr-3 active:opacity-70 bg-surface-muted"
          >
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
          <Text className="flex-1 text-text text-[17px] font-extrabold" numberOfLines={1}>
            Booking Details
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ maxWidth: 180, backgroundColor: '#DCFCE7' }}
          >
            <Text className="text-[11px] font-extrabold" numberOfLines={1}>
              <Text style={{ color: '#0F172A' }}>#{tid.prefix}</Text>
              <Text style={{ color: BRAND_GREEN_DARK }}>{tid.digits}</Text>
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 0, paddingBottom: 128 }}>
        <View style={{ width: contentW, alignSelf: 'center' }}>
        {/* ── Device hero ─────────────────────────────────────── */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <View className="bg-card rounded-3xl p-4" style={cardShadow}>
            <View className="flex-row items-center">
              <View
                className="w-[72px] h-[72px] rounded-2xl overflow-hidden items-center justify-center"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                {ticket.deviceImageUrl ? (
                  <Image source={{ uri: ticket.deviceImageUrl }} style={{ width: 72, height: 72 }} resizeMode="cover" />
                ) : (
                  <Smartphone size={30} color="#64748B" />
                )}
              </View>
              <View className="ml-3.5 flex-1">
                <Text className="text-[17px] font-extrabold text-text" numberOfLines={1}>{deviceName}</Text>
                {(ramLabel || storageLabel || color) ? (
                  <Text className="text-[12px] text-text-muted mt-0.5" numberOfLines={1}>
                    {[ramLabel, storageLabel, color].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <View
                  className="self-start flex-row items-center rounded-full px-2.5 py-1 mt-2"
                  style={{ backgroundColor: statusTone.bg, borderWidth: 1, borderColor: statusTone.border }}
                >
                  <StatusIcon size={12} color={statusTone.fg} />
                  <Text className="text-[10px] font-extrabold ml-1" style={{ color: statusTone.fg }}>
                    {statusMeta.label.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View className="h-px bg-border my-3" />
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] text-text-muted">Tracking ID</Text>
                <Text className="text-[14px] font-extrabold text-primary">#{trackingId}</Text>
              </View>
              {ticket.createdAt ? (
                <View className="items-end">
                  <Text className="text-[10px] text-text-muted">Booked on</Text>
                  <View className="flex-row items-center mt-0.5">
                    <Calendar size={12} color="#64748B" />
                    <Text className="text-[12px] font-bold text-text ml-1">{fmtInstant(ticket.createdAt) || '-'}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Customer ────────────────────────────────────────── */}
        {(customerName || phone || address) ? (
          <>
            <SectionHeader icon={User} label="CUSTOMER" />
            <View className="px-4">
              <View className="bg-card rounded-2xl px-4 py-2" style={cardShadow}>
                {customerName ? <DetailRow icon={User} label="Name" value={customerName} /> : null}
                {phone ? <DetailRow icon={Phone} label="Mobile" value={phone} /> : null}
                {address ? <DetailRow icon={MapPin} label="Address" value={address} /> : null}
              </View>
            </View>
          </>
        ) : null}

        {/* ── Price summary ───────────────────────────────────── */}
        <SectionHeader icon={IndianRupee} label="PRICE SUMMARY" />
        <View className="px-4">
          <View className="bg-card rounded-2xl p-4" style={cardShadow}>
            {lineItems.length === 0 ? (
              <Text className="text-[12.5px] text-text-muted">No service items recorded.</Text>
            ) : (
              lineItems.map((item, idx) => (
                <View
                  key={item.id || idx}
                  className="flex-row items-center py-2"
                  style={{ borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#F1F5F9' }}
                >
                  <View className="w-6 h-6 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: '#DCFCE7' }}>
                    <Text className="text-[11px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>{idx + 1}</Text>
                  </View>
                  <Text className="flex-1 text-text text-[13px] font-semibold" numberOfLines={1}>{item.label}</Text>
                  <Text className="font-extrabold text-text text-[13px]">₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
                </View>
              ))
            )}
            <View className="flex-row items-center mt-1 pt-2.5" style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <Text className="flex-1 font-extrabold text-text text-[13.5px]">Estimated Total</Text>
              <Text className="font-extrabold text-[17px]" style={{ color: ACCENT_GREEN }}>
                ₹{Number(estimatedTotal || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Service info ────────────────────────────────────── */}
        <SectionHeader icon={Wrench} label="SERVICE INFO" />
        <View className="px-4">
          <View className="bg-card rounded-2xl p-4" style={[cardShadow, { position: 'relative' }]}>
            {/* Floating refresh + overflow cluster — matches the design's corner
                control. Refresh re-pulls the ticket; the dots open the options sheet. */}
            <View style={{ position: 'absolute', right: -6, top: -16, zIndex: 5 }}>
              <View style={floatingCluster}>
                <TouchableOpacity
                  onPress={onRefresh}
                  disabled={loading}
                  hitSlop={8}
                  className="items-center justify-center"
                  style={{ width: 40, height: 34 }}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={ACCENT_GREEN} />
                    : <RotateCw size={16} color={ACCENT_GREEN} />}
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: '#EEF2F6' }} />
                <TouchableOpacity
                  onPress={() => setMoreOpen(true)}
                  hitSlop={8}
                  className="items-center justify-center"
                  style={{ width: 40, height: 34 }}
                >
                  <MoreHorizontal size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {ticket.issueDescription ? (
              <View className="flex-row items-start py-1.5 pr-12">
                <Text className="text-[12.5px] text-text-muted" style={{ width: 96 }}>Complaint</Text>
                <Text className="flex-1 text-[13px] text-text font-bold leading-5" numberOfLines={3}>
                  {ticket.issueDescription}
                </Text>
              </View>
            ) : null}
            <DetailRow icon={Clock} label="Est. Time" value={fmtInstant(ticket.estimatedReadyAt) || '-'} />
            <DetailRow icon={Calendar} label="Delivery" value={fmtInstant(ticket.estimatedDeliveryAt) || '-'} />
            {/* IMEI — shows the number, or a "-" with an Add shortcut when missing. */}
            <View className="flex-row items-center py-1.5">
              <View className="w-7 h-7 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: '#F0FDF4' }}>
                <ScanLine size={14} color={ACCENT_GREEN} />
              </View>
              <Text className="text-[12px] text-text-muted" style={{ width: 78 }}>IMEI</Text>
              {ticket.imei ? (
                <Text className="text-[13px] text-text font-bold flex-1" numberOfLines={1}>{String(ticket.imei)}</Text>
              ) : (
                <View className="flex-1 flex-row items-center justify-between">
                  <Text className="text-[13px] text-text-muted font-bold">-</Text>
                  <Pressable
                    onPress={openImeiEntry}
                    className="flex-row items-center rounded-full px-2.5 py-1 active:opacity-80"
                    style={{ backgroundColor: '#DCFCE7' }}
                  >
                    <Plus size={12} color={BRAND_GREEN_DARK} />
                    <Text className="text-[11px] font-extrabold ml-1" style={{ color: BRAND_GREEN_DARK }}>Add</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View className="flex-row items-center py-1.5">
              <View className="w-7 h-7 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: '#F0FDF4' }}>
                <ShieldCheck size={14} color={ACCENT_GREEN} />
              </View>
              <Text className="flex-1 text-[12.5px] text-text-muted">Repair Approval</Text>
              {ticket.customerApproval ? (
                <View className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: '#DCFCE7' }}>
                  <CheckCircle2 size={13} color={BRAND_GREEN_DARK} />
                  <Text className="text-[12px] font-extrabold ml-1" style={{ color: BRAND_GREEN_DARK }}>Approved</Text>
                </View>
              ) : (
                <View className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: '#FEF3C7' }}>
                  <AlertCircle size={13} color="#B45309" />
                  <Text className="text-[12px] font-bold ml-1" style={{ color: '#B45309' }}>Pending</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Technician section ─────────────────────────────── */}
        <SectionHeader icon={Users} label="TECHNICIAN" />
        <View className="px-4">
          <View
            className="rounded-2xl p-4"
            style={[cardShadow, {
              backgroundColor: hasTechnician ? '#FFFFFF' : '#F0FDF4',
              borderColor: hasTechnician ? '#E5E7EB' : '#BBF7D0',
            }]}
          >
            {!hasTechnician ? (
              <>
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-11 h-11 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#DCFCE7' }}
                  >
                    <User size={20} color={ACCENT_GREEN} />
                  </View>
                  <Text className="flex-1 text-[12.5px] text-text-muted">
                    No technician assigned to this booking yet.
                  </Text>
                </View>
                <Pressable
                  onPress={onAssignPress}
                  className="rounded-xl active:opacity-90 overflow-hidden"
                >
                  <LinearGradient
                    colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <UserPlus size={15} color="#fff" />
                    <Text className="text-white text-[13.5px] font-extrabold ml-1.5">Assign Technician</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <View className="flex-row items-center">
                <View
                  className="h-11 w-11 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: ACCENT_GREEN }}
                >
                  <Text className="text-white text-[14px] font-extrabold">
                    {(techName || '?').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-extrabold text-text" numberOfLines={1}>
                    {techName}{techCode ? ` · ${techCode}` : ''}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    {techAccepted ? (
                      <>
                        <CheckCircle2 size={11} color={ACCENT_GREEN} />
                        <Text className="text-[10.5px] font-extrabold text-success ml-1">Accepted</Text>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={11} color="#EF4444" />
                        <Text className="text-[10.5px] font-extrabold text-danger ml-1">
                          Not yet accepted
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                {!techAccepted ? (
                  <Pressable
                    onPress={onReassignPress}
                    className="flex-row items-center rounded-full px-3 py-1.5 active:opacity-80"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}
                  >
                    <RefreshCcw size={11} color={ACCENT_GREEN} />
                    <Text className="text-[11px] font-extrabold ml-1" style={{ color: ACCENT_GREEN }}>Re-Assign</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* ── Quick actions ────────────────────────────────── */}
        <SectionHeader icon={Zap} label="QUICK ACTIONS" />
        <View className="px-4">
          <View className="flex-row flex-wrap -mx-1">
            {ACTION_TILES.map((a) => {
              const Icon = a.icon;
              return (
                <View key={a.key} style={{ width: '33.333%' }} className="p-1">
                  <Pressable
                    onPress={() => onAction(a.key)}
                    className="bg-card rounded-2xl px-2 py-3 items-center active:opacity-80"
                    style={cardShadow}
                  >
                    <View
                      className="h-10 w-10 rounded-xl items-center justify-center mb-1.5"
                      style={{ backgroundColor: a.tint }}
                    >
                      <Icon size={18} color={a.fg} />
                    </View>
                    <Text className="text-[10.5px] font-extrabold text-text text-center" numberOfLines={1}>
                      {a.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Service Progress — 3-state Mark → Done/Cancel pattern
            (mirrors the technician Ticket Detail screen).

              idle    → numbered chip + label + [Mark] gray chip
              checked → yellow numbered chip + "Tap Done to confirm" + [Done] [Cancel]
              done    → green check + "Recorded" + DONE pill                */}
        <SectionHeader icon={CheckCircle2} label="SERVICE PROGRESS" />
        <View className="px-4">
          <View className="bg-card rounded-2xl p-3" style={cardShadow}>
            <Text className="text-[10.5px] text-text-muted mb-2">
              Tap <Text className="font-extrabold text-text">Mark</Text> on the next step, then{' '}
              <Text className="font-extrabold text-text">Done</Text> to record it on the customer's Service History.
            </Text>
            {(() => {
              // Resolve each step's done-ness up front so we can highlight the
              // first not-yet-done step (the actionable "next" one) in green.
              const states = OWNER_PROGRESS_ROWS.map((row, idx) => {
                const entry = progressStatus[row.key];
                // A step counts as done if it was explicitly recorded OR the
                // ticket's status has already advanced at/past it in the lifecycle
                // (e.g. once the invoice is generated, "Ready for Delivery" is
                // behind us — so it shows done instead of looking stuck).
                const lifeIdx = LIFECYCLE_ORDER.indexOf(row.key);
                const lifecycleDone = lifeIdx >= 0 && statusIdx >= 0 && statusIdx >= lifeIdx;
                const done = !!entry?.done || lifecycleDone;
                return { row, idx, entry, done };
              });
              const nextIdx = states.findIndex((s) => !s.done);
              const lastIdx = OWNER_PROGRESS_ROWS.length - 1;

              return states.map(({ row, idx, entry, done }) => {
                const checked = !!progressChecked[row.key];
                const busy = progressBusy === row.key;
                const stepNo = String(idx + 1).padStart(2, '0');
                const isNext = idx === nextIdx;
                const toggleTick = () =>
                  setProgressChecked((prev) => ({ ...prev, [row.key]: !prev[row.key] }));
                return (
                  <View
                    key={row.key}
                    style={{ flexDirection: 'row', alignItems: 'stretch', paddingVertical: 10 }}
                  >
                    {/* Numbered chip + dashed connector down to the next step. */}
                    <View style={{ width: 30, alignItems: 'center' }}>
                      <View
                        className="rounded-full items-center justify-center"
                        style={{
                          width: 30, height: 30,
                          backgroundColor: done ? '#DCFCE7' : checked ? '#FEF3C7' : '#F1F5F9',
                        }}
                      >
                        {done
                          ? <Check size={14} color="#15803D" />
                          : (
                            <Text
                              className="text-[10px] font-extrabold"
                              style={{ color: checked ? '#B45309' : '#64748B' }}
                            >
                              {stepNo}
                            </Text>
                          )}
                      </View>
                      {idx < lastIdx ? (
                        <View
                          style={{
                            flex: 1,
                            marginTop: 3,
                            marginBottom: -13,
                            borderLeftWidth: 1.5,
                            borderStyle: 'dashed',
                            borderColor: done ? '#86EFAC' : '#CBD5E1',
                          }}
                        />
                      ) : null}
                    </View>

                    <Pressable
                      onPress={done ? null : toggleTick}
                      className="flex-1 ml-3"
                      style={({ pressed }) => ({ justifyContent: 'center', opacity: pressed && !done ? 0.7 : 1 })}
                    >
                      <Text
                        className={`text-[13px] ${done ? 'font-extrabold' : 'font-bold'} text-text`}
                        numberOfLines={1}
                      >
                        {row.label}
                      </Text>
                      {checked && !done ? (
                        <Text className="text-[10px] text-text-muted mt-0.5">
                          Tap Done to confirm.
                        </Text>
                      ) : done ? (
                        <Text className="text-[10px] mt-0.5" style={{ color: '#15803D' }}>
                          Recorded{entry?.at ? ` · ${formatProgressTime(entry.at)}` : ''}
                        </Text>
                      ) : null}
                    </Pressable>

                    {/* Right action area: changes by state (vertically centered). */}
                    <View style={{ justifyContent: 'center' }}>
                      {done ? (
                        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#DCFCE7' }}>
                          <Text className="text-[10px] font-extrabold" style={{ color: '#15803D' }}>DONE</Text>
                        </View>
                      ) : checked ? (
                        <View className="flex-row items-center">
                          {/* Done — fires the emit (READY first prompts for IMEI). */}
                          <TouchableOpacity
                            onPress={() => onProgressDone(row)}
                            disabled={busy}
                            className="rounded-full flex-row items-center"
                            style={{
                              backgroundColor: '#22C55E',
                              paddingHorizontal: 14, paddingVertical: 7,
                              opacity: busy ? 0.6 : 1,
                              shadowColor: '#22C55E', shadowOpacity: 0.3, shadowRadius: 4,
                              shadowOffset: { width: 0, height: 2 }, elevation: 2,
                            }}
                          >
                            {busy
                              ? <ActivityIndicator color="#FFFFFF" size="small" />
                              : (
                                <>
                                  <Check size={12} color="#FFFFFF" />
                                  <Text className="text-[11px] font-extrabold text-white ml-1">Done</Text>
                                </>
                              )}
                          </TouchableOpacity>
                          {/* Cancel — clears the tick, no emit. */}
                          <TouchableOpacity
                            onPress={toggleTick}
                            disabled={busy}
                            className="rounded-full flex-row items-center ml-2"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1, borderColor: '#CBD5E1',
                              paddingHorizontal: 12, paddingVertical: 6,
                            }}
                          >
                            <X size={11} color="#64748B" />
                            <Text className="text-[11px] font-extrabold ml-1" style={{ color: '#64748B' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        // Idle: a Mark chip that ticks the row. The next actionable
                        // step is tinted green so it reads as the call-to-action.
                        <TouchableOpacity
                          onPress={toggleTick}
                          className="rounded-full"
                          style={{
                            backgroundColor: isNext ? '#DCFCE7' : '#F1F5F9',
                            paddingHorizontal: 16, paddingVertical: 7,
                          }}
                        >
                          <Text
                            className="text-[11px] font-extrabold"
                            style={{ color: isNext ? BRAND_GREEN_DARK : '#475569' }}
                          >
                            Mark
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        </View>
        </View>
      </ScrollView>

      {/* ── Bottom action bar — Contact Customer + Update Status ── */}
      <View
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          gap: 12,
        }}
      >
        <Pressable
          onPress={contactCustomer}
          className="flex-1 flex-row items-center justify-center rounded-2xl active:opacity-80"
          style={{ borderWidth: 1.5, borderColor: ACCENT_GREEN, paddingVertical: 14 }}
        >
          <Phone size={16} color={ACCENT_GREEN} />
          <Text className="text-[14px] font-extrabold ml-2" style={{ color: ACCENT_GREEN }}>
            Contact Customer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setStatusOpen(true)}
          className="flex-1 rounded-2xl overflow-hidden active:opacity-90"
        >
          <LinearGradient
            colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <ClipboardList size={16} color="#FFFFFF" />
            <Text className="text-white text-[14px] font-extrabold ml-2">Update Status</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Share Receipt chooser ───────────────────────────────── */}
      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShareOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 14 }} />
            <Text className="text-[15px] font-extrabold text-gray-900 mb-3">Share Receipt</Text>

            <Pressable
              onPress={shareImage}
              className="flex-row items-center rounded-2xl p-3 mb-2.5 active:opacity-80"
              style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#DCFCE7' }}>
                <Share2 size={18} color={BRAND_GREEN_DARK} />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-extrabold text-gray-900">Send image to WhatsApp</Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">Share the receipt image (WhatsApp & more)</Text>
              </View>
              <ChevronRight size={16} color="#CBD5E1" />
            </Pressable>

            <Pressable
              onPress={shareSms}
              className="flex-row items-center rounded-2xl p-3 active:opacity-80"
              style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#DBEAFE' }}>
                <MessageSquare size={18} color="#1D4ED8" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-extrabold text-gray-900">Send details by SMS</Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">Share the booking details as a message</Text>
              </View>
              <ChevronRight size={16} color="#CBD5E1" />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Update Status sheet — jumps the booking to any lifecycle stage ── */}
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}
          onPress={() => (statusBusy ? null : setStatusOpen(false))}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 14 }} />
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[15px] font-extrabold text-gray-900">Update Status</Text>
              <Pressable
                onPress={() => setStatusOpen(false)}
                hitSlop={8}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                <X size={14} color="#0F172A" />
              </Pressable>
            </View>
            <Text className="text-[11.5px] text-text-muted mb-3">
              Booking #{trackingId} moves forward one stage at a time.
            </Text>

            {/* Current stage — read-only */}
            <View
              className="rounded-2xl border px-3.5 py-3 mb-1"
              style={{ backgroundColor: '#F8FAFC', borderColor: '#E5E7EB' }}
            >
              <Text className="text-[10px] uppercase font-extrabold text-gray-400 mb-1.5" style={{ letterSpacing: 0.8 }}>
                Current Stage
              </Text>
              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full mr-2.5" style={{ backgroundColor: statusTone.fg }} />
                <Text className="flex-1 text-[14px] font-extrabold text-text">{statusMeta.label}</Text>
                <View className="flex-row items-center">
                  <CheckCircle2 size={14} color={BRAND_GREEN_DARK} />
                  <Text className="text-[10.5px] font-extrabold ml-1" style={{ color: BRAND_GREEN_DARK }}>Current</Text>
                </View>
              </View>
            </View>

            {(() => {
              const next = nextStage(statusKey);
              const nextMeta = next ? (STATUS_VARIANT[next] || { label: next, tone: 'green' }) : null;
              const advancing = statusBusy === next;

              if (!next) {
                const cancelled = statusKey === 'CANCELLED';
                return (
                  <View
                    className="rounded-2xl px-3.5 py-4 items-center mt-1.5"
                    style={{
                      backgroundColor: cancelled ? '#FEF2F2' : '#F0FDF4',
                      borderWidth: 1,
                      borderColor: cancelled ? '#FECACA' : '#BBF7D0',
                    }}
                  >
                    {cancelled
                      ? <AlertCircle size={20} color="#B91C1C" />
                      : <CheckCircle2 size={20} color={BRAND_GREEN_DARK} />}
                    <Text className="text-[13px] font-extrabold text-text mt-1.5">
                      {cancelled ? 'This booking was cancelled.' : 'Final stage reached.'}
                    </Text>
                    <Text className="text-[11px] text-text-muted mt-0.5 text-center">
                      {cancelled ? 'No further status updates.' : 'This booking has been delivered.'}
                    </Text>
                  </View>
                );
              }

              return (
                <>
                  <View className="items-center my-1.5">
                    <ArrowDown size={16} color="#94A3B8" />
                  </View>
                  <TouchableOpacity
                    onPress={() => applyStatus(next)}
                    disabled={statusBusy != null}
                    activeOpacity={0.9}
                    className="rounded-2xl overflow-hidden"
                    style={{ opacity: statusBusy != null && !advancing ? 0.6 : 1 }}
                  >
                    <LinearGradient
                      colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View className="flex-1">
                        <Text className="text-[10px] uppercase font-extrabold" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: 0.8 }}>
                          Advance To
                        </Text>
                        <Text className="text-white text-[15px] font-extrabold mt-0.5">{nextMeta.label}</Text>
                      </View>
                      {advancing
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <ChevronRight size={20} color="#FFFFFF" />}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={cancelBooking}
                    disabled={statusBusy != null}
                    className="rounded-2xl border mt-2.5 py-3 items-center"
                    style={{ borderColor: '#FECACA', backgroundColor: '#FFFFFF' }}
                  >
                    <Text className="text-[12.5px] font-extrabold" style={{ color: '#B91C1C' }}>Cancel booking</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Overflow options sheet (the Service Info "…" button) ─────────── */}
      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setMoreOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 14 }} />
            <Text className="text-[15px] font-extrabold text-gray-900 mb-3">Booking options</Text>
            {[
              { key: 'refresh', label: 'Refresh details',   icon: RotateCw, tint: '#F0FDF4',                 fg: ACCENT_GREEN },
              { key: 'view',    label: 'View full details', icon: FileText, tint: 'rgba(34,197,94,0.12)',   fg: BRAND_GREEN_DARK },
              { key: 'history', label: 'Service history',   icon: Clock,    tint: 'rgba(168,85,247,0.12)',  fg: '#7C3AED' },
              { key: 'share',   label: 'Share receipt',     icon: Share2,   tint: 'rgba(34,197,94,0.12)',   fg: ACCENT_GREEN },
              { key: 'barcode', label: 'Barcode',           icon: QrCode,   tint: 'rgba(245,158,11,0.16)',  fg: '#B45309' },
            ].map((opt) => {
              const OptIcon = opt.icon;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setMoreOpen(false);
                    if (opt.key === 'refresh') onRefresh();
                    else onAction(opt.key);
                  }}
                  className="flex-row items-center rounded-2xl p-3 mb-2 active:opacity-80"
                  style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
                >
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: opt.tint }}>
                    <OptIcon size={18} color={opt.fg} />
                  </View>
                  <Text className="flex-1 text-[13.5px] font-extrabold text-gray-900">{opt.label}</Text>
                  <ChevronRight size={16} color="#CBD5E1" />
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── IMEI capture sheet — type or scan, then save ─────────────────── */}
      <Modal
        visible={imeiModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (imeiSaving ? null : setImeiModalOpen(false))}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center px-6"
          onPress={() => (imeiSaving ? null : setImeiModalOpen(false))}
        >
          <Pressable className="bg-card rounded-3xl p-5 w-full" style={{ maxWidth: 420 }} onPress={() => {}}>
            <View className="items-center mb-1">
              <View className="h-11 w-11 rounded-full items-center justify-center mb-2" style={{ backgroundColor: '#DCFCE7' }}>
                <ScanLine size={20} color={BRAND_GREEN_DARK} />
              </View>
              <Text className="text-text text-[16px] font-extrabold">Enter IMEI Number</Text>
              <Text className="text-text-muted text-[12px] text-center mt-1">
                Add the device IMEI number for this booking.
              </Text>
            </View>

            <View className="flex-row items-center rounded-xl border border-border bg-background px-3 mt-3">
              <TextInput
                className="flex-1 py-3 text-text text-[15px] font-bold"
                placeholder="Enter 15-digit IMEI"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={17}
                value={imeiInput}
                onChangeText={setImeiInput}
                autoFocus
              />
              <Pressable
                onPress={() => {
                  setImeiModalOpen(false);
                  navigation.navigate('ScanImei', { onScan: (v) => { setImeiInput(v); setImeiModalOpen(true); } });
                }}
                className="flex-row items-center rounded-full px-3 py-1.5 ml-1 active:opacity-80"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.14)' }}
              >
                <ScanLine size={14} color={BRAND_GREEN} />
                <Text className="text-[12px] font-extrabold ml-1" style={{ color: BRAND_GREEN }}>SCAN</Text>
              </Pressable>
            </View>
            <Text className="text-text-muted text-[11px] mt-2">Tip: dial *#06# on the device to show its IMEI.</Text>

            <View className="flex-row mt-4">
              <Pressable
                onPress={() => setImeiModalOpen(false)}
                disabled={imeiSaving}
                className="flex-1 mr-2 rounded-2xl bg-background border border-border py-3 items-center active:opacity-80"
              >
                <Text className="text-text-muted text-[14px] font-extrabold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveImeiAndContinue}
                disabled={imeiSaving}
                className="flex-1 rounded-2xl py-3 items-center active:opacity-80"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                {imeiSaving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14px] font-extrabold">Save</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

// Short timestamp for the Service Progress "RECORDED" column —
// e.g. "Jun 17 · 11:08 AM". Returns "—" for missing values.
function formatProgressTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <View className="px-4 pt-5 pb-2 flex-row items-center">
      <Icon size={14} color={BRAND_GREEN_DARK} />
      <Text className="text-text font-extrabold text-[12.5px] tracking-widest ml-1.5">{label}</Text>
      <View className="flex-1 h-px bg-border ml-2" />
    </View>
  );
}

// Icon + label + value row used in the redesigned section cards.
// Normalise a typed/scanned IMEI to digits; valid when 14–17 digits (15 is the
// IMEI proper; 16/17 cover IMEISV and TAC+IMEI). Returns null when out of range.
function normaliseImei(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  return digits.length >= 14 && digits.length <= 17 ? digits : null;
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View className="w-7 h-7 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: '#F0FDF4' }}>
        <Icon size={14} color={ACCENT_GREEN} />
      </View>
      <Text className="text-[12px] text-text-muted" style={{ width: 78 }}>{label}</Text>
      <Text className="text-[13px] text-text font-bold flex-1" numberOfLines={2}>{value}</Text>
    </View>
  );
}

// Receipt-style row used inside the BookingSuccessfulScreen-matching card.
function InfoRow({ label, value }) {
  return (
    <View className="flex-row mt-1">
      <Text className="flex-1 text-[11px] text-text-muted">{label}</Text>
      <Text className="text-[12px] text-text font-semibold">{value}</Text>
    </View>
  );
}

// Pretty-print an Instant/ISO string from the ticket as a fallback when display
// strings weren't carried through. Matches BookingSuccessfulScreen's helper.
function fmtInstant(iso) {
  if (!iso) return null;
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return null;
    // e.g. "Mon Jul 20 2026 1:34 pm" — non-padded hour + lowercase am/pm to match the design.
    const time = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    return `${dt.toDateString()} ${time}`;
  } catch { return null; }
}

// Maps a ticket loaded from /tickets/{id} into the params shape the
// owner service-booking flow screens expect. `editMode` + `editTicketId`
// tell the final ServiceBookingDevicesList to PUT instead of POST.
function buildEditParams(ticket, { lineItems, estimatedTotal }) {
  const services = (lineItems || []).map((it) => ({
    serviceId: it.serviceId || it.id || null,
    serviceCode: it.serviceCode || it.code || null,
    serviceName: it.serviceName || it.label || 'Service',
    price: Number(it.amount ?? it.price) || 0,
    warranty: it.warranty || null,
  }));

  let missingParts = [];
  if (ticket.missingPartsJson) {
    try { const p = JSON.parse(ticket.missingPartsJson); if (Array.isArray(p)) missingParts = p; } catch (_) {}
  }

  let devicePhotos = {};
  if (ticket.devicePhotosJson) {
    try { const p = JSON.parse(ticket.devicePhotosJson); if (p && typeof p === 'object') devicePhotos = p; } catch (_) {}
  }

  const modelName = ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || 'Device';
  const customer = {
    id: ticket.customerId,
    name: ticket.customerName,
    phone: ticket.customerPhone,
    address: ticket.customerAddress,
  };

  return {
    editMode: true,
    editTicketId: ticket.id,
    trackingId: ticket.trackingId,
    customerId: ticket.customerId,
    customer,
    brandId: ticket.brandId,
    modelId: ticket.modelId,
    ramOptionId: ticket.ramOptionId,
    storageOptionId: ticket.storageOptionId,
    color: ticket.color,
    modelName,
    imageUrl: ticket.deviceImageUrl,
    ramLabel: ticket.ramLabel,
    storageLabel: ticket.storageLabel,
    prefillServices: services,
    prefillImei: ticket.imei || '',
    prefillComplaint: ticket.issueDescription || '',
    prefillIssueAudioUrl: ticket.issueAudioUrl || '',
    prefillEstimatedReadyIso: ticket.estimatedReadyAt || null,
    prefillEstimatedDeliveryIso: ticket.estimatedDeliveryAt || null,
    prefillCustomerApproved: ticket.customerApproval ?? false,
    prefillDevicePhotos: devicePhotos,
    prefillMissingParts: missingParts,
    prefillLock: {
      type: ticket.deviceSecurityType || 'NONE',
      value: ticket.deviceSecurityValue || '',
    },
    prefillEstimatedPrice: estimatedTotal,
  };
}

const cardShadow = {
  borderWidth: 1,
  borderColor: '#E5E7EB',
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

// White pill that floats over the Service Info card's top-right corner and
// holds the refresh + overflow buttons (matches the design's corner control).
const floatingCluster = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#EEF2F6',
  shadowColor: '#0F172A',
  shadowOpacity: 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
  overflow: 'hidden',
};

// ════════════════════════════════════════════════════════════════════════════
// Printable receipt — rendered hidden, captured by react-native-view-shot and
// shared as a PNG. Fixed 360px width so the captured image is a stable size
// across phones. Pure View/Text — no images / gradients so the capture is
// fast and renders the same on every device.
// ════════════════════════════════════════════════════════════════════════════
function ReceiptCard({ ticket, lineItems, estimatedTotal, technicianName }) {
  if (!ticket) return null;
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const trackingId = ticket.trackingId || ticket.id;
  const deviceName = ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || '—';
  const variant = [ticket.ramLabel, ticket.storageLabel, ticket.color].filter(Boolean).join(' · ');
  const generated = new Date().toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const status = STATUS_VARIANT[String(ticket.status || '').toUpperCase()]?.label
    || ticket.status || 'Pending';

  return (
    <View style={{ backgroundColor: '#FFFFFF', padding: 20 }}>
      {/* Brand header */}
      <View
        style={{
          backgroundColor: BRAND_GREEN_DARK,
          paddingVertical: 16,
          paddingHorizontal: 16,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>GGFix</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
          Booking Receipt
        </Text>
      </View>

      {/* Tracking */}
      <View
        style={{
          backgroundColor: '#F0FDF4',
          borderWidth: 1,
          borderColor: '#BBF7D0',
          borderRadius: 10,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803D', letterSpacing: 1 }}>
          TRACKING ID
        </Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
          #{trackingId}
        </Text>
        <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
          Status: <Text style={{ fontWeight: '700', color: '#15803D' }}>{status}</Text>
        </Text>
      </View>

      {/* Customer */}
      <ReceiptSection title="Customer">
        <ReceiptRow label="Name" value={ticket.customerName || '—'} />
        <ReceiptRow label="Mobile" value={ticket.customerPhone || '—'} />
        {ticket.customerAddress ? (
          <ReceiptRow label="Address" value={ticket.customerAddress} />
        ) : null}
      </ReceiptSection>

      {/* Device */}
      <ReceiptSection title="Device">
        <ReceiptRow label="Model" value={deviceName} />
        {variant ? <ReceiptRow label="Variant" value={variant} /> : null}
        {ticket.imei ? <ReceiptRow label="IMEI" value={String(ticket.imei)} /> : null}
      </ReceiptSection>

      {/* Technician */}
      {technicianName ? (
        <ReceiptSection title="Technician">
          <ReceiptRow label="Assigned" value={technicianName} />
        </ReceiptSection>
      ) : null}

      {/* Services */}
      <ReceiptSection title="Services">
        {lineItems.length === 0 ? (
          <Text style={{ fontSize: 12, color: '#64748B' }}>No services recorded.</Text>
        ) : (
          lineItems.map((it, idx) => (
            <View
              key={it.id || idx}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: '#0F172A', flex: 1, paddingRight: 8 }} numberOfLines={2}>
                {idx + 1}. {it.label}
              </Text>
              <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '700' }}>
                ₹{fmt(it.amount)}
              </Text>
            </View>
          ))
        )}
      </ReceiptSection>

      {/* Total */}
      <View
        style={{
          marginTop: 4,
          padding: 12,
          backgroundColor: '#15803D',
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
          Estimated Total
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
          ₹{fmt(estimatedTotal)}
        </Text>
      </View>

      {/* Footer */}
      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: 10, color: '#94A3B8' }}>
          Generated {generated}
        </Text>
        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
          Track your repair in the GGFix app.
        </Text>
      </View>
    </View>
  );
}

function ReceiptSection({ title, children }) {
  return (
    <View
      style={{
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '800',
          color: '#15803D',
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color: '#64748B', width: 70 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: '#0F172A', flex: 1, fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}
