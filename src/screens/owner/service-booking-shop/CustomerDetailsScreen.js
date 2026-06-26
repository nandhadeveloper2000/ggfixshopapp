import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { UserPlus, ChevronDown, Upload, Save, MapPin, Search, CheckCircle2 } from 'lucide-react-native';
import { Button, Input, Label, ScreenHeader, Select } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import { notify } from '../../../components/confirm';

const STATES = [
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
];

const DISTRICTS_TN = [
  'Chennai', 'Cuddalore', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli',
  'Tirunelveli', 'Vellore', 'Erode', 'Thanjavur',
].map((d) => ({ value: d, label: d }));

const TALUKS = ['Cuddalore', 'Chidambaram', 'Bhuvanagiri', 'Panruti', 'Virudhachalam', 'Kattumannar Koil']
  .map((t) => ({ value: t, label: t }));

const INPUT_CLS = 'py-2 text-[13px]';

function Field({ label, required, children, half = false, className }) {
  return (
    <View className={`${half ? 'flex-1' : ''} mb-2 ${className || ''}`}>
      <Label className="text-[11px] mb-1">
        {label}{required ? <Text className="text-danger"> *</Text> : null}
      </Label>
      {children}
    </View>
  );
}

export default function CustomerDetailsScreen({ navigation, route }) {
  const initial = route?.params?.initial || {};
  // The picker passes the resolved customer in `existing`; the ticket-service
  // CustomerResponse now carries structured address fields (state/city/
  // locality/addressLine/pincode) sourced from the platform customer_addresses
  // row. Fall back to `initial` so callers that already split the address
  // themselves still work.
  const existingPick = route?.params?.existing || {};
  const [data, setData] = useState({
    name: initial.name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    state: initial.state || existingPick.state || 'Tamil Nadu',
    district: initial.district || existingPick.district || existingPick.city || '',
    taluk: initial.taluk || existingPick.taluk || '',
    area: initial.area || existingPick.area || existingPick.locality || '',
    addressLine: initial.addressLine || existingPick.addressLine || '',
    pincode: initial.pincode || existingPick.pincode || '',
  });
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  // When a lookup hits an existing customer (shop or platform), remember the
  // resolved row so Save & Continue can reuse / link it instead of creating
  // a duplicate. Cleared whenever the phone field changes.
  // Pre-seeded when the caller already picked an existing customer (e.g. from
  // the New Booking search results) so we skip the lookup round-trip.
  const [existing, setExisting] = useState(route?.params?.existing || null);
  // Don't pre-seed: even when the picker handed us an `existing` row, the
  // search endpoint may have returned it without the structured address
  // overlay. Letting the auto-lookup run once re-fetches via /customers/lookup
  // which guarantees state/city/locality/addressLine/pincode from the platform
  // customer_addresses row.
  const lastLookedUpPhoneRef = useRef('');
  const prePickedRef = useRef(!!route?.params?.existing);

  const doLookup = async (rawPhone, { silentMissing = false, silentFound = false } = {}) => {
    const phone = (rawPhone || '').replace(/[\s+\-]/g, '');
    if (phone.length < 10) return;
    if (lastLookedUpPhoneRef.current === phone && existing) return;
    lastLookedUpPhoneRef.current = phone;
    setLookupLoading(true);
    try {
      const found = await ticketApi.get('/customers/lookup', { query: { mobile: phone } });
      if (!found) {
        setExisting(null);
        if (!silentMissing) {
          notify('New customer', 'No existing customer with this mobile. Fill in the details to create one.');
        }
        return;
      }
      setExisting(found);
      setData((d) => ({
        ...d,
        name: found.name || d.name,
        phone: found.phone || d.phone,
        email: found.email || d.email,
        state: found.state || d.state,
        // Prefer the new structured fields from migration 55; fall back to
        // legacy city/locality so this still works against old DTOs in flight.
        district: found.district || found.city || d.district,
        taluk: found.taluk || d.taluk,
        area: found.area || found.locality || d.area,
        addressLine: found.addressLine || d.addressLine,
        pincode: found.pincode || d.pincode,
      }));
      if (!silentFound) {
        const where = found.source === 'platform'
          ? 'This mobile is registered in the app. Details auto-filled — review and Save & Continue to add them to this shop.'
          : 'This customer already exists in this shop. Details auto-filled — Save & Continue will reuse them.';
        notify('Customer found', where);
      }
    } catch (_) {
      // Network or other error: stay silent on auto-lookup, surface on manual.
      if (!silentMissing) notify('Lookup failed', 'Could not check existing customers. Continue manually.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Auto-lookup once the phone reaches 10 digits, debounced.
  useEffect(() => {
    const phone = (data.phone || '').replace(/[\s+\-]/g, '');
    if (phone.length < 10) {
      if (existing) setExisting(null);
      lastLookedUpPhoneRef.current = '';
      return;
    }
    const wasPrePicked = prePickedRef.current;
    prePickedRef.current = false;
    const t = setTimeout(() => {
      doLookup(data.phone, { silentMissing: true, silentFound: wasPrePicked });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.phone]);

  const save = async () => {
    if (!data.name.trim() || !data.phone.trim()) {
      notify('Required', 'Customer name and mobile number are required');
      return;
    }
    setSaving(true);
    try {
      let resolved = existing;
      // If we have a platform match, materialize the shop-scoped row now.
      if (resolved && resolved.source === 'platform') {
        resolved = await ticketApi.post('/customers/link', {
          body: { platformUserId: resolved.platformUserId || resolved.id },
        });
      }
      // Nothing matched — create a fresh customer in customer_users +
      // customer_addresses. Structured fields land in their own columns so
      // the customer app can prefill them later; we also still send the
      // legacy `address` concat so older backends keep working.
      if (!resolved) {
        const structured = {
          addressLine: data.addressLine?.trim() || null,
          locality:    data.taluk?.trim()       || data.area?.trim() || null,
          city:        data.district?.trim()    || null,
          state:       data.state?.trim()       || null,
          pincode:     data.pincode?.trim()     || null,
        };
        resolved = await ticketApi.post('/customers', {
          body: {
            name: data.name.trim(),
            phone: data.phone.trim(),
            email: data.email.trim() || null,
            ...structured,
            address: [data.addressLine, data.area, data.taluk, data.district, data.state, data.pincode]
              .filter(Boolean).join(', '),
          },
        });
      }
      navigation.replace('ChooseDevice', { customerId: resolved.id, customer: resolved });
    } catch (e) {
      notify('Error', e?.message || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Customer Details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 96 }} keyboardShouldPersistTaps="handled">

        {/* Personal info */}
        <View className="bg-card border border-border rounded-2xl p-3 mb-3">
          <View className="flex-row items-center mb-2.5">
            <View className="h-8 w-8 rounded-full bg-success/10 items-center justify-center mr-2">
              <UserPlus size={14} color="#10B981" />
            </View>
            <Text className="text-[13px] font-extrabold text-text">Personal Info</Text>
          </View>

          <Field label="Customer Name" required>
            <Input placeholder="Enter customer name" value={data.name} onChangeText={(v) => setData({ ...data, name: v })} className={INPUT_CLS} />
          </Field>

          <Field label="Mobile Number" required>
            <View className="flex-row">
              <Pressable className="bg-card border border-border rounded-xl px-2.5 py-2 mr-2 flex-row items-center">
                <Text className="text-[13px] text-text font-semibold">+91</Text>
                <ChevronDown size={12} color="#64748B" />
              </Pressable>
              <View className="flex-1 relative">
                <Input
                  className={`${INPUT_CLS} pr-9`}
                  placeholder="10-digit number"
                  keyboardType="phone-pad"
                  value={data.phone}
                  onChangeText={(v) => setData({ ...data, phone: v })}
                />
                <Pressable
                  onPress={() => doLookup(data.phone)}
                  className="absolute right-2 top-0 bottom-0 items-center justify-center px-1"
                  hitSlop={6}
                >
                  {lookupLoading ? (
                    <ActivityIndicator size="small" color="#00008B" />
                  ) : existing ? (
                    <CheckCircle2 size={18} color="#10B981" />
                  ) : (
                    <Search size={18} color="#64748B" />
                  )}
                </Pressable>
              </View>
            </View>
            {existing ? (
              <Text className="text-[10px] text-success mt-1">
                {existing.source === 'platform' ? 'App user found — will be linked to this shop' : 'Existing customer in this shop'}
              </Text>
            ) : null}
          </Field>

          <Field label="Email Address" className="mb-0">
            <Input placeholder="email@example.com" autoCapitalize="none" keyboardType="email-address" value={data.email} onChangeText={(v) => setData({ ...data, email: v })} className={INPUT_CLS} />
          </Field>
        </View>

        {/* Address */}
        <View className="bg-card border border-border rounded-2xl p-3 mb-3">
          <View className="flex-row items-center mb-2.5">
            <View className="h-8 w-8 rounded-full bg-primary/10 items-center justify-center mr-2">
              <MapPin size={14} color="#00008B" />
            </View>
            <Text className="text-[13px] font-extrabold text-text">Address</Text>
          </View>

          <View className="flex-row -mx-1">
            <View className="px-1 flex-1">
              <Field label="State" half>
                <Select value={data.state} options={STATES} onChange={(v) => setData({ ...data, state: v })} />
              </Field>
            </View>
            <View className="px-1 flex-1">
              <Field label="District" half>
                <Select value={data.district} options={DISTRICTS_TN} placeholder="Select district" onChange={(v) => setData({ ...data, district: v })} />
              </Field>
            </View>
          </View>

          <View className="flex-row -mx-1">
            <View className="px-1 flex-1">
              <Field label="Taluk" half>
                <Select value={data.taluk} options={TALUKS} placeholder="Select Taluk" onChange={(v) => setData({ ...data, taluk: v })} />
              </Field>
            </View>
            <View className="px-1 flex-1">
              <Field label="Area" half>
                <Input placeholder="Area" value={data.area} onChangeText={(v) => setData({ ...data, area: v })} className={INPUT_CLS} />
              </Field>
            </View>
          </View>

          <View className="flex-row -mx-1">
            <View className="px-1 flex-1">
              <Field label="Door no. / Street" half className="mb-0">
                <Input placeholder="Door No. / Street" value={data.addressLine} onChangeText={(v) => setData({ ...data, addressLine: v })} className={INPUT_CLS} />
              </Field>
            </View>
            <View className="px-1 flex-1">
              <Field label="Pin Code" half className="mb-0">
                <Input placeholder="Pincode" keyboardType="number-pad" value={data.pincode} onChangeText={(v) => setData({ ...data, pincode: v })} className={INPUT_CLS} />
              </Field>
            </View>
          </View>
        </View>

        {/* Upload */}
        <Pressable className="border border-dashed border-primary/40 bg-primary/5 rounded-2xl py-4 items-center active:opacity-80 mb-3">
          <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center">
            <Upload size={18} color="#00008B" />
          </View>
          <Text className="text-primary font-extrabold text-[13px] mt-1.5">Upload ID Proof</Text>
          <Text className="text-[10px] text-text-muted mt-0.5">Optional · Max 1MB</Text>
        </Pressable>

        <Button onPress={save} loading={saving} fullWidth leftIcon={<Save size={16} color="#fff" />}>
          Save & Continue
        </Button>
      </ScrollView>
    </View>
  );
}
