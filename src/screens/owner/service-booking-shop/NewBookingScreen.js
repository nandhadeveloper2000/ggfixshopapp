import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { Avatar, Button, Card, MintBackdrop, BrandHeader } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import { selectShopId } from '../../../store/authSlice';

const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};

export default function NewBookingScreen({ navigation }) {
  const shopId = useSelector(selectShopId);
  const { width } = useWindowDimensions();

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  // Hero card sizing — prominent and centered, slightly taller than wide.
  const cardW = Math.min(320, Math.round(width * 0.66));
  const cardH = Math.round(cardW * 1.04);
  const iconCircle = Math.round(cardW * 0.42);

  // Backend can return the same person more than once (multiple legacy rows for
  // the same phone). Collapse them by name+phone so the search list shows one
  // row per real customer. Prefer the shop-scoped row over the platform row
  // when both exist for the same phone — booking needs a shop customers.id.
  const dedupedResults = useMemo(() => {
    const byKey = new Map();
    for (const c of results) {
      const phone = String(c.phone || c.mobile || '').replace(/\s|\+|-/g, '');
      const key = `${String(c.name || '').toLowerCase().trim()}|${phone}`;
      const existing = byKey.get(key);
      if (!existing) { byKey.set(key, c); continue; }
      if (existing.source === 'platform' && c.source === 'shop') byKey.set(key, c);
    }
    return Array.from(byKey.values());
  }, [results]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const data = await ticketApi.get('/customers', { query: { q: q.trim() } });
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch (_) { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, shopId]);

  // The search field can still own focus when the owner starts a booking.
  // Blur it before navigation so its keyboard/caret never carries into the
  // Customer Details form.
  const openCustomerDetails = (params) => {
    Keyboard.dismiss();
    navigation.navigate('CustomerDetails', params);
  };

  return (
    <View className="flex-1">
      <MintBackdrop dots circles />
      <BrandHeader title="New Booking" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Subtle rounded panel holding the hero + search */}
        <View
          style={{
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.42)',
            paddingTop: 28,
            paddingBottom: 26,
            paddingHorizontal: 20,
          }}
        >
          {/* New Customer hero card */}
          <Pressable
            onPress={() => openCustomerDetails()}
            className="self-center active:opacity-90"
            style={{
              width: cardW,
              height: cardH,
              borderRadius: 30,
              overflow: 'hidden',
              shadowColor: GREEN_DARK,
              shadowOpacity: 0.32,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
            }}
          >
            <LinearGradient
              colors={['#2FB85D', '#16A34A', '#12833B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}
            >
              {/* Icon with a soft glow ring */}
              <View
                style={{
                  width: iconCircle * 1.34,
                  height: iconCircle * 1.34,
                  borderRadius: (iconCircle * 1.34) / 2,
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: iconCircle,
                    height: iconCircle,
                    borderRadius: iconCircle / 2,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="people" size={Math.round(iconCircle * 0.5)} color={GREEN} />
                </View>
              </View>

              <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 18 }}>
                New Customer
              </Text>
              <Text
                style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 5, textAlign: 'center' }}
              >
                Add a new customer to get started
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Search existing customer */}
          <View
            className="flex-row items-center"
            style={{
              marginTop: 26,
              backgroundColor: '#FFFFFF',
              borderRadius: 999,
              paddingHorizontal: 20,
              height: 56,
              ...softShadow,
            }}
          >
            <Ionicons name="search" size={20} color={GREEN} />
            <TextInput
              placeholder="Search Existing Customer Name or Mobile Number..."
              placeholderTextColor="#94A3B8"
              value={q}
              onChangeText={setQ}
              className="flex-1 ml-3 text-text"
              style={{ paddingVertical: 0, fontSize: 12.5 }}
            />
            {loading ? <ActivityIndicator size="small" color={GREEN} /> : null}
          </View>
        </View>

        {/* Search results */}
        <View className="mt-4">
          {dedupedResults.map((c) => {
            const isPlatform = c.source === 'platform';
            const rowKey = `${c.source || 'shop'}:${c.id}`;
            const onPick = () => {
              openCustomerDetails({
                initial: {
                  name: c.name || '',
                  phone: c.phone || c.mobile || '',
                  email: c.email || '',
                },
                existing: c,
              });
            };
            return (
              <Card
                key={rowKey}
                className="mb-3 flex-row items-center"
                style={{ borderWidth: 0, borderRadius: 20 }}
              >
                <Avatar fallback={(c.name || '?').slice(0, 2)} size={56} />
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center flex-wrap">
                    <Text className="font-extrabold text-text text-[15px] mr-2">{c.name}</Text>
                    {isPlatform ? (
                      <View className="px-2.5 py-1 rounded-full bg-primary/10">
                        <Text className="text-[11px] text-primary font-bold">App user</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[13px] text-text-muted mt-1">{c.phone || ''}</Text>
                  {c.address ? (
                    <Text className="text-[13px] text-text-muted mt-0.5 leading-5">{c.address}</Text>
                  ) : null}
                </View>
                <Button size="sm" onPress={onPick} className="ml-3">Booking</Button>
              </Card>
            );
          })}
          {!loading && q.trim() && dedupedResults.length === 0 ? (
            <Text className="text-center text-text-muted py-6">No matching customers</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
