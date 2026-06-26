import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';

const TILES = [
  { key: 'SERVICE_ACCEPTED',   label: 'Service Accepted',   color: '#60A5FA', icon: 'document-text-outline' },
  { key: 'TECHNICIAN_ASSIGNED', label: 'Technician Assigned', color: '#7C3AED', icon: 'construct-outline' },
  { key: 'IN_SERVICE_PROCESS', label: 'In Service Process', color: '#475569', icon: 'build-outline' },
  { key: 'WORK_COMPLETED',     label: 'Work Completed',     color: '#22C55E', icon: 'checkmark-circle-outline' },
  { key: 'OUT_OF_DELIVERY',    label: 'Out of Delivery',    color: '#14B8A6', icon: 'car-outline' },
  { key: 'RE_ASSIGN_TECH',     label: 'Re-Assign Technician', color: '#F97316', icon: 'people-circle-outline' },
  { key: 'WORK_PENDING',       label: 'Work Pending',       color: '#EF4444', icon: 'warning-outline' },
  { key: 'DELIVERED',          label: 'Delivered',          color: '#65A30D', icon: 'cube-outline' },
];

export default function BookingStatusScreen({ navigation }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(React.useCallback(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await ticketApi.get('/tickets/counts');
        if (!cancelled) setCounts(data || {});
      } catch (_) { if (!cancelled) setCounts({}); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []));

  const count = (k) => {
    const c = counts[k] ?? counts[k.toLowerCase()] ?? 0;
    return String(c).padStart(2, '0');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Booking Status" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerClassName="px-4 pt-4 pb-12">
        <View className="flex-row items-center mb-4">
          <Text className="flex-1 font-bold text-text">This Month Booking Status Sumary</Text>
          <Pressable><Text className="text-primary font-semibold underline">Previous Report</Text></Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('ShopServiceStatus')}
          className="bg-primary rounded-2xl py-3 px-4 mb-4 flex-row items-center justify-center active:opacity-80"
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text className="text-white font-bold ml-2">Update Customer Service Status</Text>
        </Pressable>

        {loading ? <ActivityIndicator color="#00008B" /> : null}

        <View className="flex-row flex-wrap">
          {TILES.map((t) => (
            <View key={t.key} className="w-1/2 p-2">
              <View style={{ backgroundColor: t.color }} className="rounded-2xl py-6 items-center">
                <Ionicons name={t.icon} size={28} color="#fff" />
                <Text className="text-white font-bold mt-2 text-center">{t.label}</Text>
                <Text className="text-white font-extrabold text-2xl mt-1">{count(t.key)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
