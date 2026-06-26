import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, TouchableOpacity, View, StatusBar } from 'react-native';
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
  UserCog,
  UserPlus,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  ListChecks,
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
  const { ticketId } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const handleShare = async () => {
    if (!ticket) return;
    const lineItems = priceItemsFromTicket(ticket);
    const total = ticket.estimatedPrice || lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const message =
      `🧾 GGFix Booking Receipt\n\n` +
      `Tracking ID: ${ticket.trackingId || ticket.id}\n` +
      `Customer: ${ticket.customerName || '-'}\n` +
      `Mobile: ${ticket.customerPhone || '-'}\n` +
      `Device: ${ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || '-'}\n` +
      `Status: ${ticket.status || '-'}\n\n` +
      `Services:\n` +
      lineItems.map((i) => `  • ${i.label} — ₹${i.amount}`).join('\n') +
      `\n\nEstimated Total: ₹${total}\n\n` +
      `Track your repair in the GGFix app.`;

    // Try to capture the hidden receipt View as a PNG and share that via the
    // system share sheet so messengers like WhatsApp attach the receipt image
    // (not just a text snippet). Fall back to the plain text share on any
    // capture / sharing failure so the user still gets *something*.
    try {
      const uri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
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
      await Share.share({ message, title: `Booking ${ticket.trackingId || ticket.id}` });
    } catch (e) {
      notify('Share failed', e?.message || 'Could not open share sheet');
    }
  };

  if (loading && !ticket) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16 }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              className="h-10 w-10 rounded-full items-center justify-center mr-3 active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
            <Text className="flex-1 text-white text-[17px] font-extrabold">Booking Details</Text>
          </View>
        </LinearGradient>
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
      case 'share':   handleShare(); break;
      case 'barcode': navigation.navigate('BarcodePrint', { ticketId: ticket.id, mode: 'barcode' }); break;
      default: break;
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

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

      {/* ── Green hero header (replaces native white nav header) ── */}
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
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full items-center justify-center mr-3 active:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <Text className="flex-1 text-white text-[17px] font-extrabold" numberOfLines={1}>
            Booking Details
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', maxWidth: 180 }}
          >
            <Text className="text-white text-[11px] font-extrabold" numberOfLines={1}>
              #{trackingId}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingTop: 0, paddingBottom: 24 }}>
        {/* ── Receipt card ─ mirrors BookingSuccessfulScreen layout ── */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <Card className="p-0 overflow-hidden">
            {/* Device header */}
            <View className="flex-row items-center px-3 py-2.5 border-b border-border">
              <View className="w-11 h-12 bg-border rounded-md overflow-hidden items-center justify-center">
                {ticket.deviceImageUrl ? (
                  <Image source={{ uri: ticket.deviceImageUrl }} style={{ width: 44, height: 48 }} resizeMode="cover" />
                ) : (
                  <Smartphone size={20} color="#64748B" />
                )}
              </View>
              <View className="ml-2.5 flex-1">
                <Text className="text-[10px] text-text-muted">Tracking ID</Text>
                <Text className="text-[13px] font-extrabold text-primary">#{trackingId}</Text>
                <Text className="text-[11px] text-text mt-0.5" numberOfLines={1}>
                  {deviceName}{ramLabel ? ` · ${ramLabel}` : ''}{storageLabel ? ` · ${storageLabel}` : ''}{color ? ` · ${color}` : ''}
                </Text>
              </View>
            </View>

            {/* Customer */}
            {(customerName || phone || address) ? (
              <View className="px-3 py-2.5 border-b border-border">
                <Text className="text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1.5">Customer Details</Text>
                {customerName ? <InfoRow label="Name" value={customerName} /> : null}
                {phone   ? <InfoRow label="Mobile Number" value={phone} /> : null}
                {address ? <InfoRow label="Address" value={address} /> : null}
              </View>
            ) : null}

            {/* Services */}
            <View className="px-3 py-2.5 border-b border-border">
              <Text className="text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1.5">Price Summary</Text>
              {lineItems.length === 0 ? (
                <Text className="text-[12px] text-text-muted">No service items recorded.</Text>
              ) : (
                <>
                  {lineItems.map((item, idx) => (
                    <View key={item.id || idx} className="flex-row items-center my-0.5">
                      <View className="w-5 h-5 bg-background rounded items-center justify-center mr-2">
                        <Text className="text-text text-[10px] font-bold">{idx + 1}</Text>
                      </View>
                      <Text className="flex-1 text-text text-[12px]" numberOfLines={1}>{item.label}</Text>
                      <Text className="font-bold text-text text-[12px]">₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  ))}
                  <View className="border-t border-border mt-1.5 pt-1.5 flex-row items-center">
                    <Text className="flex-1 font-extrabold text-text text-[12px]">Estimated Repair Amount</Text>
                    <Text className="font-extrabold text-primary text-[13px]">₹{Number(estimatedTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Service Info */}
            <View className="px-3 py-2.5">
              <Text className="text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1.5">Service Info</Text>
              {ticket.issueDescription ? (
                <View className="mb-1.5">
                  <Text className="text-[11px] text-text-muted">Complaint</Text>
                  <Text className="text-[12px] text-text">{ticket.issueDescription}</Text>
                </View>
              ) : null}
              <InfoRow label="Estimated Time" value={fmtInstant(ticket.estimatedReadyAt) || '-'} />
              <InfoRow label="Delivery Date" value={fmtInstant(ticket.estimatedDeliveryAt) || '-'} />
              <View className="flex-row items-center mt-1">
                <Text className="flex-1 text-[11px] text-text-muted">Repair Approval</Text>
                <View className="flex-row items-center">
                  {ticket.customerApproval ? (
                    <>
                      <CheckCircle2 size={12} color="#22C55E" />
                      <Text className="text-[12px] font-bold text-success ml-1">Done</Text>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} color="#94A3B8" />
                      <Text className="text-[12px] font-bold text-text-muted ml-1">Pending</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* ── Technician section ─────────────────────────────── */}
        <SectionHeader icon={UserCog} label="TECHNICIAN" />
        <View className="px-4">
          <View className="bg-card rounded-2xl p-4" style={cardShadow}>
            {!hasTechnician ? (
              <>
                <Text className="text-[12.5px] text-text-muted mb-3">
                  No technician assigned to this booking yet.
                </Text>
                <Pressable
                  onPress={onAssignPress}
                  className="rounded-xl active:opacity-90 overflow-hidden"
                >
                  <LinearGradient
                    colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <UserPlus size={14} color="#fff" />
                    <Text className="text-white text-[13px] font-extrabold ml-1.5">Assign Technician</Text>
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
        <SectionHeader icon={ListChecks} label="QUICK ACTIONS" />
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
              Tap Mark on the next step, then Done to record it on the customer's Service History.
            </Text>
            {OWNER_PROGRESS_ROWS.map((row, idx) => {
              const entry = progressStatus[row.key];
              const done = !!entry?.done;
              const checked = !!progressChecked[row.key];
              const busy = progressBusy === row.key;
              const stepNo = String(idx + 1).padStart(2, '0');
              const toggleTick = () =>
                setProgressChecked((prev) => ({ ...prev, [row.key]: !prev[row.key] }));
              return (
                <View
                  key={row.key}
                  className="flex-row items-center"
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: '#F1F5F9',
                  }}
                >
                  {/* Numbered chip — green tint when done, amber when checked, gray idle */}
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

                  <Pressable
                    onPress={done ? null : toggleTick}
                    className="flex-1 ml-3"
                    style={({ pressed }) => ({ opacity: pressed && !done ? 0.7 : 1 })}
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

                  {/* Right action area: changes by state. */}
                  {done ? (
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#DCFCE7' }}>
                      <Text className="text-[10px] font-extrabold" style={{ color: '#15803D' }}>DONE</Text>
                    </View>
                  ) : checked ? (
                    <View className="flex-row items-center">
                      {/* Done — fires the emit. */}
                      <TouchableOpacity
                        onPress={() => submitProgress(row)}
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
                    // Idle: a Mark chip that ticks the row (same as tapping the label).
                    <TouchableOpacity
                      onPress={toggleTick}
                      className="rounded-full"
                      style={{
                        backgroundColor: '#F1F5F9',
                        paddingHorizontal: 14, paddingVertical: 7,
                      }}
                    >
                      <Text className="text-[11px] font-extrabold" style={{ color: '#475569' }}>Mark</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
    return `${dt.toDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
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
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
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
