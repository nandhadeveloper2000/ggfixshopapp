import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Avatar, Button, Card, ScreenHeader } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import { selectShopId } from '../../../store/authSlice';

export default function NewBookingScreen({ navigation }) {
  const shopId = useSelector(selectShopId);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="New Booking" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-12" keyboardShouldPersistTaps="handled">
        <View className="items-center my-6">
          <Pressable
            onPress={() => navigation.navigate('CustomerDetails')}
            className="bg-primary rounded-2xl items-center justify-center active:opacity-80"
            style={{ width: 160, height: 160 }}
          >
            <View className="bg-white/10 rounded-full p-4 mb-2">
              <Ionicons name="people" size={48} color="#fff" />
            </View>
            <Text className="text-white font-bold mt-2">New Customer</Text>
          </Pressable>
        </View>

        <View className="bg-card border border-border rounded-full flex-row items-center px-4 py-3 mt-6">
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Search Existing Customer Name or Mobile Number..."
            placeholderTextColor="#94A3B8"
            value={q}
            onChangeText={setQ}
            className="flex-1 ml-2 text-text"
          />
          {loading ? <ActivityIndicator size="small" color="#00008B" /> : null}
        </View>

        <View className="mt-4">
          {dedupedResults.map((c) => {
            const isPlatform = c.source === 'platform';
            const rowKey = `${c.source || 'shop'}:${c.id}`;
            const onPick = () => {
              navigation.navigate('CustomerDetails', {
                initial: {
                  name: c.name || '',
                  phone: c.phone || c.mobile || '',
                  email: c.email || '',
                },
                existing: c,
              });
            };
            return (
              <Card key={rowKey} className="mb-3 flex-row items-center">
                <Avatar fallback={(c.name || '?').slice(0, 2)} size={48} />
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="font-bold text-text">{c.name}</Text>
                    {isPlatform ? (
                      <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10">
                        <Text className="text-[10px] text-primary font-semibold">App user</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs text-text-muted">{c.phone || ''}</Text>
                  {c.address ? <Text className="text-xs text-text-muted">{c.address}</Text> : null}
                </View>
                <Button size="sm" onPress={onPick}>Booking</Button>
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
