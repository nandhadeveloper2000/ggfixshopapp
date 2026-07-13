import React, { useState } from 'react';
import { ActivityIndicator, View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronRight,
  Smartphone,
  Plus,
  ShieldCheck,
  Timer,
  CircleCheck,
  ReceiptText,
  Tag,
  User,
  Phone,
  Send,
} from 'lucide-react-native';
import { ticketApi } from '../../../api/client';
import { notify } from '../../../components/confirm';

// Swiggy / Zomato green palette — same as the rest of the booking flow.
const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const formatINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function serviceSummaryFor(device) {
  return (device.services || [])
    .map((service) => service.serviceName)
    .filter(Boolean)
    .join(', ');
}

function priceItemsJsonFor(device) {
  const items = (device.services || []).map((service) => ({
    id: service.serviceId || null,
    code: service.serviceCode || null,
    label: service.serviceName || 'Service',
    amount: Number(service.price) || 0,
    warranty: service.warranty || null,
  }));
  return items.length ? JSON.stringify(items) : null;
}

export default function ServiceBookingDevicesListScreen({ navigation, route }) {
  const params = route?.params || {};
  const insets = useSafeAreaInsets();

  // Build a device record from the just-finished flow (if any modelId came through).
  const newDevice = params.modelId ? {
    modelName: params.modelName,
    modelId: params.modelId,
    imageUrl: params.imageUrl,
    brandId: params.brandId,
    brandName: params.brandName,
    color: params.color,
    ramLabel: params.ramLabel,
    storageLabel: params.storageLabel,
    ramOptionId: params.ramOptionId,
    storageOptionId: params.storageOptionId,
    imei: params.imei,
    complaint: params.complaint,
    issueAudioUrl: params.issueAudioUrl || null,
    services: params.services || [],
    lock: params.lock,
    missingParts: params.missingParts,
    devicePhotos: params.devicePhotos,
    estimatedAt: params.estimatedAt,
    estimatedDelivery: params.estimatedDelivery,
    estimatedReadyIso: params.estimatedReadyIso,
    estimatedDeliveryIso: params.estimatedDeliveryIso,
    customerApproved: params.customerApproved,
  } : null;

  const existing = Array.isArray(params.existingDevices) ? params.existingDevices : [];
  // Priority: pre-built devices list > existing + new > existing > new alone.
  let initial;
  if (Array.isArray(params.devices) && params.devices.length > 0) {
    initial = params.devices;
  } else if (existing.length > 0 && newDevice) {
    initial = [...existing, newDevice];
  } else if (existing.length > 0) {
    initial = existing;
  } else if (newDevice) {
    initial = [newDevice];
  } else {
    initial = [];
  }

  const [devices] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const totalFor = (d) => (d.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0);
  const grandTotal = devices.reduce((s, d) => s + totalFor(d), 0);

  const addMore = () => {
    navigation.navigate('ChooseDevice', {
      customerId: params.customerId,
      customer: params.customer,
      existingDevices: devices,
    });
  };

  const buildTicketBody = (d) => ({
    customerId: params.customerId,
    customerName: params.customer?.name || params.customer?.fullName || null,
    customerPhone: params.customer?.phone || params.customer?.mobile || null,
    brandId: d.brandId,
    modelId: d.modelId,
    ramOptionId: d.ramOptionId,
    storageOptionId: d.storageOptionId,
    color: d.color,
    imei: d.imei,
    issueDescription: d.complaint,
    issueAudioUrl: d.issueAudioUrl || null,
    estimatedPrice: totalFor(d),
    deviceDisplayName: d.modelName ? `${d.modelName}${d.ramLabel || d.storageLabel ? ` (${[d.ramLabel, d.storageLabel].filter(Boolean).join(' / ')})` : ''}` : null,
    deviceImageUrl: d.imageUrl || null,
    repairServicesSummary: serviceSummaryFor(d) || null,
    priceItemsJson: priceItemsJsonFor(d),
    deviceSecurityType: d.lock?.type || 'NONE',
    deviceSecurityValue: d.lock?.value || null,
    missingPartsJson: (d.missingParts && d.missingParts.length) ? JSON.stringify(d.missingParts) : null,
    devicePhotosJson: d.devicePhotos ? JSON.stringify(d.devicePhotos) : null,
    estimatedReadyAt: d.estimatedReadyIso || null,
    estimatedDeliveryAt: d.estimatedDeliveryIso || null,
    customerApproval: d.customerApproved ?? null,
  });

  const submit = async () => {
    if (!params.customerId) { notify('Missing', 'Customer is required'); return; }
    setSubmitting(true);
    try {
      // Edit mode: update the existing ticket in place via PUT and route to the
      // same Thank You / Receipt / Barcode flow as a fresh booking.
      if (params.editMode && params.editTicketId) {
        const d = devices[0] || {};
        const res = await ticketApi.put(`/tickets/${params.editTicketId}`, { body: buildTicketBody(d) });
        navigation.replace('BookingThankYou', {
          customer: params.customer,
          devices,
          tickets: [res],
          editMode: true,
        });
        return;
      }

      const created = [];
      for (const d of devices) {
        const res = await ticketApi.post('/tickets', { body: buildTicketBody(d) });
        created.push(res);
      }
      navigation.replace('BookingThankYou', {
        customer: params.customer,
        devices,
        tickets: created,
      });
    } catch (e) {
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      const msg = `${e?.message || 'Failed to submit booking'}${status}`;
      // Log the full error so it can be read from the Metro console too.
      console.log('Booking submit error →', e?.status, e?.message, e);
      // Alert stays on screen until dismissed, so the message is readable
      // (the toast disappears in ~2s).
      Alert.alert('Booking failed', msg);
    } finally { setSubmitting(false); }
  };

  const customerName = params.customer?.name || params.customer?.fullName || 'Customer';
  const customerPhone = params.customer?.phone || params.customer?.mobile || '';
  const deviceCount = devices.length;

  return (
    <View className="flex-1 bg-background">
      {/* ── White header — matches app's other white headers ─────── */}
      <View
        style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-surface-muted items-center justify-center mr-3 active:opacity-70"
          >
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-text-muted text-[11px] font-bold tracking-widest">
              {params.editMode ? 'EDIT BOOKING' : 'FINAL REVIEW'}
            </Text>
            <Text className="text-text text-[19px] font-extrabold mt-0.5" numberOfLines={1}>
              {params.editMode ? 'Update & re-submit' : 'Confirm & submit'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 170 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Customer card overlapping hero ────────────────────────── */}
        <View className="px-4" style={{ marginTop: 14 }}>
          <View
            className="bg-card rounded-2xl p-3.5"
            style={{
              shadowColor: '#0F172A',
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="h-14 w-14 rounded-2xl bg-success/10 items-center justify-center mr-3">
                <User size={22} color={ACCENT_GREEN} />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] text-text-muted font-bold tracking-widest">CUSTOMER</Text>
                <Text className="text-[15px] font-extrabold text-text mt-0.5" numberOfLines={1}>
                  {customerName}
                </Text>
                {customerPhone ? (
                  <View className="flex-row items-center mt-0.5">
                    <Phone size={11} color="#64748B" />
                    <Text className="text-[11.5px] text-text-muted ml-1">{customerPhone}</Text>
                  </View>
                ) : null}
              </View>
              <View className="bg-success/10 rounded-full px-2.5 py-1 flex-row items-center">
                <CircleCheck size={11} color={ACCENT_GREEN} />
                <Text className="text-success text-[10px] font-extrabold ml-1">VERIFIED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Section rail ──────────────────────────────────────── */}
        <View className="px-4 pt-5 pb-2 flex-row items-center">
          <ReceiptText size={14} color={BRAND_GREEN_DARK} />
          <Text className="text-text font-extrabold text-[12.5px] tracking-widest ml-1.5">
            DEVICES IN THIS BOOKING
          </Text>
          <View className="flex-1 h-px bg-border ml-2" />
          <View className="bg-success/10 rounded-full px-2 py-0.5 ml-2">
            <Text className="text-success text-[10px] font-extrabold">{deviceCount}</Text>
          </View>
        </View>

        {/* ── Device cards ──────────────────────────────────────── */}
        <View className="px-4">
          {devices.map((d, idx) => {
            const subTotal = totalFor(d);
            const summary = [d.ramLabel, d.storageLabel, d.color].filter(Boolean).join(' · ');
            return (
              <View
                key={idx}
                className="bg-card rounded-2xl mb-3 overflow-hidden"
                style={cardShadow}
              >
                {/* Device head */}
                <View className="flex-row items-center px-3.5 pt-3.5 pb-2">
                  <View className="h-14 w-14 rounded-2xl bg-success/10 items-center justify-center overflow-hidden mr-3">
                    {d.imageUrl ? (
                      <Image source={{ uri: d.imageUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                    ) : (
                      <Smartphone size={26} color={ACCENT_GREEN} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-extrabold text-text" numberOfLines={1}>
                      {d.modelName || 'Device'}
                    </Text>
                    {summary ? (
                      <Text className="text-[11px] text-text-muted mt-0.5" numberOfLines={1}>
                        {summary}
                      </Text>
                    ) : null}
                    {d.brandName ? (
                      <View className="bg-primary/10 rounded-md px-1.5 py-0.5 self-start mt-1">
                        <Text className="text-primary text-[10px] font-extrabold">{d.brandName}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Services list */}
                {(d.services || []).length > 0 ? (
                  <View className="px-3.5 pb-3">
                    <View className="h-px bg-border mb-2.5" />
                    <Text className="text-[10px] font-extrabold text-text-muted tracking-widest mb-2">
                      REPAIR SERVICES
                    </Text>
                    {(d.services || []).map((s, i) => (
                      <View key={i} className="flex-row items-center mb-1.5">
                        <View
                          className="h-5 w-5 rounded-md items-center justify-center mr-2"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.14)' }}
                        >
                          <Text className="text-[9.5px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text className="flex-1 text-text text-[12.5px]" numberOfLines={1}>
                          {s.serviceName}
                        </Text>
                        <Text className="text-text font-extrabold text-[12.5px]">
                          ₹{formatINR(s.price)}
                        </Text>
                      </View>
                    ))}

                    {/* Dashed separator + per-device subtotal */}
                    <View
                      className="my-2"
                      style={{ borderTopWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' }}
                    />
                    <View className="flex-row items-center">
                      <Tag size={12} color={BRAND_GREEN_DARK} />
                      <Text className="flex-1 text-text font-extrabold text-[12.5px] ml-1.5">
                        Estimated repair amount
                      </Text>
                      <Text className="font-extrabold text-[14px]" style={{ color: BRAND_GREEN_DARK }}>
                        ₹{formatINR(subTotal)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Empty state */}
          {devices.length === 0 ? (
            <View className="bg-card rounded-2xl p-6 items-center" style={cardShadow}>
              <Smartphone size={28} color="#94A3B8" />
              <Text className="text-text font-extrabold text-[13px] mt-2">No device added yet</Text>
              <Text className="text-text-muted text-[11px] mt-1 text-center">
                Tap "Add device" below to start.
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Add More Device — Swiggy "Add address" pattern ─────── */}
        {params.editMode ? null : (
          <View className="px-4 mt-1">
            <Pressable
              onPress={addMore}
              className="rounded-2xl items-center justify-center py-3 active:opacity-80"
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: ACCENT_GREEN,
                backgroundColor: 'rgba(22, 163, 74, 0.04)',
              }}
            >
              <View className="flex-row items-center">
                <View
                  className="h-7 w-7 rounded-full items-center justify-center mr-2"
                  style={{ backgroundColor: ACCENT_GREEN }}
                >
                  <Plus size={14} color="#fff" />
                </View>
                <Text className="text-[13px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                  Add another device
                </Text>
              </View>
              <Text className="text-[10.5px] text-text-muted mt-1 px-2 text-center">
                Same customer? Book multiple devices in one go.
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Grand total — Swiggy "Bill summary" pattern ───────── */}
        {deviceCount > 0 ? (
          <>
            <View className="px-4 pt-5 pb-2 flex-row items-center">
              <ReceiptText size={14} color={BRAND_GREEN_DARK} />
              <Text className="text-text font-extrabold text-[12.5px] tracking-widest ml-1.5">
                BILL SUMMARY
              </Text>
              <View className="flex-1 h-px bg-border ml-2" />
            </View>
            <View className="px-4">
              <View className="bg-card rounded-2xl p-4" style={cardShadow}>
                {devices.map((d, i) => (
                  <View key={i} className="flex-row items-center mb-2">
                    <Text className="flex-1 text-text text-[12.5px]" numberOfLines={1}>
                      {d.modelName || `Device ${i + 1}`}
                    </Text>
                    <Text className="text-text font-extrabold text-[12.5px]">
                      ₹{formatINR(totalFor(d))}
                    </Text>
                  </View>
                ))}
                <View
                  className="my-2.5"
                  style={{ borderTopWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' }}
                />
                <View className="flex-row items-center">
                  <Text className="flex-1 text-text font-extrabold text-[13.5px]">Grand Total</Text>
                  <Text className="text-[19px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
                    ₹{formatINR(grandTotal)}
                  </Text>
                </View>
                <Text className="text-text-muted text-[10.5px] mt-1">
                  Final amount may vary slightly based on parts availability.
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {/* ── Trust strip ───────────────────────────────────── */}
        <View className="px-4 mt-4">
          <View className="flex-row items-center justify-around py-3 rounded-2xl bg-card" style={cardShadow}>
            <TrustItem icon={ShieldCheck} label="Genuine parts" />
            <View className="h-8 w-px bg-border" />
            <TrustItem icon={Timer} label="On-time repair" />
            <View className="h-8 w-px bg-border" />
            <TrustItem icon={CircleCheck} label="30-day warranty" />
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky green CTA ───────────────────────────────── */}
      <View
        className="absolute left-0 right-0"
        style={{ bottom: insets.bottom + 4, paddingHorizontal: 16 }}
      >
        <Pressable
          onPress={submit}
          disabled={submitting || deviceCount === 0}
          className="active:opacity-90"
          style={{
            borderRadius: 18,
            overflow: 'hidden',
            opacity: (submitting || deviceCount === 0) ? 0.6 : 1,
            shadowColor: BRAND_GREEN_DARK,
            shadowOpacity: (submitting || deviceCount === 0) ? 0 : 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: (submitting || deviceCount === 0) ? 0 : 10,
          }}
        >
          <LinearGradient
            colors={(submitting || deviceCount === 0) ? ['#94A3B8', '#64748B'] : [BRAND_GREEN, BRAND_GREEN_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
          >
            <View className="flex-1">
              <Text className="text-white text-[11px] font-bold opacity-90">
                {deviceCount === 0
                  ? 'NO DEVICE YET'
                  : `GRAND TOTAL · ${deviceCount} DEVICE${deviceCount > 1 ? 'S' : ''}`}
              </Text>
              <Text className="text-white text-[19px] font-extrabold">
                ₹{formatINR(grandTotal)}
              </Text>
            </View>
            <View className="flex-row items-center">
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={15} color="#fff" />
                  <Text className="text-white text-[14px] font-extrabold ml-1.5">
                    {params.editMode ? 'Update' : 'Submit'}
                  </Text>
                  <ChevronRight size={18} color="#fff" />
                </>
              )}
            </View>
          </LinearGradient>
        </Pressable>
        {deviceCount === 0 ? (
          <Text className="text-text-muted text-[10.5px] text-center mt-2">
            Add at least one device to submit.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function TrustItem({ icon: Icon, label }) {
  return (
    <View className="items-center flex-1">
      <Icon size={16} color={ACCENT_GREEN} />
      <Text className="text-text-muted text-[10px] font-extrabold mt-1 text-center" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
