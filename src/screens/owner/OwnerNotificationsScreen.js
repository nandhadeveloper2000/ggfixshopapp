import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Bell, ChevronRight, CheckCheck } from 'lucide-react-native';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications';

const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export default function OwnerNotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await listNotifications();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch fresh every time the screen is focused.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unread = items.filter((n) => !n.read).length;

  const onTap = async (n) => {
    if (!n?.read) {
      try { await markNotificationRead(n.id); } catch {}
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    // Drop the owner into their Bookings tab to find the affected row.
    navigation.navigate('OwnerTabs', { screen: 'Bookings' });
  };

  const onMarkAll = async () => {
    if (!unread) return;
    try { await markAllNotificationsRead(); } catch {}
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const renderItem = ({ item: n }) => (
    <Pressable
      onPress={() => onTap(n)}
      className="bg-white rounded-2xl p-3.5 mb-2.5 flex-row items-start active:opacity-80"
      style={cardShadow}
    >
      <View
        className="h-10 w-10 rounded-full items-center justify-center mr-3 mt-0.5"
        style={{ backgroundColor: n.read ? '#F1F5F9' : '#DCFCE7' }}
      >
        <Bell size={17} color={n.read ? '#94A3B8' : GREEN_DARK} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text
            className={`flex-1 text-[13.5px] ${n.read ? 'font-bold text-gray-500' : 'font-extrabold text-gray-900'}`}
            numberOfLines={1}
          >
            {n.title}
          </Text>
          {!n.read ? <View className="h-2 w-2 rounded-full ml-1" style={{ backgroundColor: '#F59E0B' }} /> : null}
        </View>
        {n.body ? (
          <Text className="text-[11.5px] text-gray-500 mt-0.5" numberOfLines={2}>{n.body}</Text>
        ) : null}
        <Text className="text-[10px] text-gray-400 mt-1">
          {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
        </Text>
      </View>
      <ChevronRight size={15} color="#CBD5E1" style={{ marginTop: 8 }} />
    </Pressable>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 10, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <View className="flex-row items-center" style={{ paddingHorizontal: 16 }}>
            <Pressable
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              hitSlop={10}
              className="h-9 w-9 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </Pressable>
            <View className="flex-1 flex-row items-center justify-center">
              <Text className="text-center text-white text-[18px] font-extrabold">Notifications</Text>
              {unread > 0 ? (
                <View className="ml-2 rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                  <Text className="text-white text-[10px] font-extrabold">{unread} new</Text>
                </View>
              ) : null}
            </View>
            {unread > 0 ? (
              <Pressable
                onPress={onMarkAll}
                hitSlop={10}
                className="h-9 px-2.5 rounded-full flex-row items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
              >
                <CheckCheck size={14} color="#FFFFFF" />
              </Pressable>
            ) : (
              <View className="h-9 w-9" />
            )}
          </View>
        </LinearGradient>
      </SafeAreaView>

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={GREEN} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[GREEN]} tintColor={GREEN} />
          }
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center pt-24 px-8">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#DCFCE7' }}>
                <Bell size={32} color={GREEN_DARK} />
              </View>
              <Text className="text-[15px] font-extrabold text-gray-700">You're all caught up</Text>
              <Text className="text-[12px] text-gray-400 mt-2 text-center leading-5">
                Booking updates, payouts and team alerts will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
