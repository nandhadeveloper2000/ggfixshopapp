import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  ChevronLeft,
  Package,
  ShoppingBag,
  Smartphone,
  Search,
  ChevronRight,
} from 'lucide-react-native';
import { marketplaceApi } from '../../api/client';
import { getModelsByBrand } from '../../api/masterData';
import { selectShopId, selectUserId } from '../../store/authSlice';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

function statusMeta(rawStatus, type) {
  const s = String(rawStatus || '').toUpperCase();
  const sell = type !== 'BUY';
  if (s === 'SOLD' || s === 'COMPLETED') {
    return { short: sell ? 'Sold' : 'Done', accent: BRAND_GREEN_DARK, tint: '#DCFCE7', dot: BRAND_GREEN };
  }
  if (s === 'CANCELLED' || s === 'CANCELED') {
    return { short: 'Cancelled', accent: '#B91C1C', tint: '#FEE2E2', dot: '#EF4444' };
  }
  return { short: 'Pending', accent: '#B45309', tint: '#FEF3C7', dot: '#F59E0B' };
}

function OrderCard({ item, showPrice, onPress }) {
  const orderId = item.id ? String(item.id).slice(0, 10).toUpperCase().replace(/-/g, '') : '';
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const dateLabel = created
    ? created.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    : '';
  const specs = [item.color, item.storageLabel].filter(Boolean).join(' · ');
  const meta = statusMeta(item.status, item.type);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-3 mb-3 flex-row items-center"
      style={cardShadow}
    >
      <View
        style={{
          width: 60, height: 60, borderRadius: 14,
          backgroundColor: '#F0FDF4',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          marginRight: 12,
        }}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60 }} resizeMode="cover" />
        ) : (
          <Smartphone size={24} color={BRAND_GREEN_DARK} />
        )}
      </View>

      <View className="flex-1 pr-2">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text
            className="text-[10px] font-bold"
            style={{ color: '#94A3B8', letterSpacing: 0.4 }}
            numberOfLines={1}
          >
            #GGFIX{orderId}
          </Text>
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{ backgroundColor: meta.tint }}
          >
            <View className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: meta.dot }} />
            <Text
              className="text-[9.5px] font-extrabold"
              style={{ color: meta.accent, letterSpacing: 0.3 }}
            >
              {meta.short.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text className="text-[14px] font-extrabold text-gray-900" numberOfLines={1}>
          {item.title || 'Item'}
        </Text>

        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-[11.5px] text-gray-500 flex-1" numberOfLines={1}>
            {specs || dateLabel || ''}
          </Text>
          {showPrice && item.price != null ? (
            <Text
              className="text-[13px] font-extrabold ml-2"
              style={{ color: BRAND_GREEN_DARK }}
            >
              ₹{Number(item.price).toLocaleString('en-IN')}
            </Text>
          ) : null}
        </View>
      </View>

      <ChevronRight size={16} color="#CBD5E1" />
    </Pressable>
  );
}

export default function MarketplaceOrdersScreen({ navigation }) {
  const [tab, setTab] = useState('Sell');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const shopId = useSelector(selectShopId);
  const userId = useSelector(selectUserId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketplaceApi.get('/marketplace/products', {
        query: { type: tab.toUpperCase() },
      });
      const list = Array.isArray(data) ? data : (data?.content || data?.data || []);
      const filtered = tab === 'Sell'
        ? list.filter((p) =>
            (userId && p.sellerUserId === userId) ||
            (shopId && p.shopId === shopId) ||
            (!p.sellerUserId && !p.shopId))
        : list;

      const brandIds = Array.from(new Set(
        filtered
          .filter((p) => p.descriptionType !== 'SPARE_PARTS' && p.brandId && p.modelId)
          .map((p) => p.brandId),
      ));
      if (brandIds.length) {
        const modelMap = {};
        await Promise.all(brandIds.map(async (brandId) => {
          try {
            const models = await getModelsByBrand(brandId);
            (models || []).forEach((m) => {
              const url = m.imageUrl || (m.imageBase64 ? `data:image/png;base64,${m.imageBase64}` : null);
              if (url) modelMap[m.id] = url;
            });
          } catch (_) {}
        }));
        const enriched = filtered.map((p) => {
          if (p.descriptionType === 'SPARE_PARTS') return p;
          const url = p.modelId ? modelMap[p.modelId] : null;
          return url ? { ...p, imageUrl: url } : p;
        });
        setItems(enriched);
      } else {
        setItems(filtered);
      }
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, shopId, userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: BRAND_GREEN_DARK }}>
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 6, paddingBottom: 14, paddingHorizontal: 16 }}
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
              My Orders
            </Text>
            <Pressable
              hitSlop={8}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <Search size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Tabs */}
      <View className="px-4 mt-3">
        <View
          className="flex-row rounded-full p-1 bg-white"
          style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
        >
          {['Buy', 'Sell'].map((t) => {
            const active = tab === t;
            const Icon = t === 'Buy' ? ShoppingBag : Package;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className="flex-1 items-center justify-center py-2 rounded-full flex-row"
                style={{ backgroundColor: active ? BRAND_GREEN : 'transparent' }}
              >
                <Icon size={13} color={active ? '#FFFFFF' : '#64748B'} />
                <Text
                  className="ml-1.5 text-[12.5px] font-extrabold"
                  style={{ color: active ? '#FFFFFF' : '#64748B' }}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_GREEN_DARK} />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: '#DCFCE7' }}
          >
            <ShoppingBag size={32} color={BRAND_GREEN_DARK} />
          </View>
          <Text className="text-[15px] font-extrabold text-gray-700">
            No {tab.toLowerCase()} orders yet
          </Text>
          <Text className="text-[12px] text-gray-500 mt-2 text-center leading-5">
            {tab === 'Sell'
              ? 'Your published listings will show up here.'
              : 'Your marketplace purchases will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <OrderCard
              key={item.id}
              item={item}
              showPrice={tab === 'Sell'}
              onPress={() =>
                navigation.navigate('MarketplaceListingDetails', { productId: item.id, listing: item })
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
