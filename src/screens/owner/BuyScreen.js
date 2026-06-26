import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  X,
  ShoppingBag,
  MapPin,
  Navigation as NavIcon,
  Phone,
  Eye,
  Sparkles,
  TrendingDown,
  ShieldCheck,
  Truck,
  Smartphone,
  Wrench,
  Zap,
  Store,
  User,
  ChevronDown,
} from 'lucide-react-native';
import { marketplaceApi } from '../../api/client';
import { fetchMe } from '../../api/auth';
import { notify } from '../../components/confirm';
import { getSession } from '../../auth/session';

const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

const RADIUS_KM = 20;

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const PROMISES = [
  { icon: TrendingDown, label: 'Best Deals',     tint: '#DCFCE7', color: GREEN_DARK },
  { icon: ShieldCheck,  label: 'Verified Shops', tint: '#FFEDD5', color: '#C2410C' },
  { icon: Truck,        label: 'Fast Pickup',    tint: '#FEF3C7', color: '#B45309' },
];

export default function BuyScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [origin, setOrigin] = useState(null);
  // Pure-client filter strip — kept simple so it works without changing the
  // backend query. Filters by sellerType / item type derived from the listing.
  const [activeFilter, setActiveFilter] = useState('ALL');

  const ensureOrigin = useCallback(async () => {
    let session = await fetchMe().catch(() => null);
    if (!session) session = await getSession();
    const shop = session?.activeShop;
    if (shop && shop.latitude != null && shop.longitude != null) {
      return {
        lat: Number(shop.latitude),
        lng: Number(shop.longitude),
        shopName: shop.name,
        sellerId: session?.userId,
      };
    }
    return { lat: null, lng: null, shopName: session?.shopName, sellerId: session?.userId };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const o = origin || (await ensureOrigin());
        if (!origin) setOrigin(o);
        const params = { radiusKm: RADIUS_KM };
        if (o.lat != null && o.lng != null) {
          params.lat = o.lat;
          params.lng = o.lng;
        }
        if (query) params.q = query;
        if (o.sellerId) params.excludeSellerId = o.sellerId;
        const data = await marketplaceApi.get('/marketplace/buy/nearby', { query: params });
        const content = Array.isArray(data) ? data : data?.content ?? data?.data ?? [];
        setItems(content);
      } catch (e) {
        setError(e.message || 'Failed to load listings');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [origin, ensureOrigin, query],
  );

  useEffect(() => { load(); }, [load]);

  // Cheap client-side filter — keep all data, just hide rows by chip.
  const visibleItems = items.filter((it) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'NEARBY') return it.distanceKm != null;
    if (activeFilter === 'MOBILES') {
      const name = String(it.productName || '').toLowerCase();
      return /(mobile|phone|iphone|samsung|galaxy|redmi|vivo|oppo|realme)/.test(name);
    }
    if (activeFilter === 'SPARES') {
      const name = String(it.productName || '').toLowerCase();
      return /(display|battery|combo|board|camera|spare|part)/.test(name);
    }
    return true;
  });

  const renderItem = ({ item }) => {
    const productName = item.productName || 'Untitled';
    const sellerLabel = item.sellerType === 'CUSTOMER' ? 'Customer' : 'Shop';
    const sellerLine = [item.city, item.state].filter(Boolean).join(', ') || item.address || '—';
    const distance = item.distanceKm != null ? `${item.distanceKm} km` : null;
    const priceNum = item.expectedPrice != null ? Number(item.expectedPrice) : null;
    const isAwaitingQuote = priceNum != null && priceNum === 0;
    const price = priceNum != null && priceNum > 0
      ? priceNum.toLocaleString('en-IN')
      : null;
    const isCustomer = item.sellerType === 'CUSTOMER';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation?.navigate?.('OwnerBuyListingDetails', { listing: item })}
        className="bg-white rounded-2xl p-4 mb-3"
        style={cardShadow}
      >
        {/* Top row: thumb + name + meta + price */}
        <View className="flex-row items-start">
          <View style={{ position: 'relative', marginRight: 12 }}>
            <View
              className="w-[70px] h-[70px] rounded-2xl overflow-hidden items-center justify-center"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              {item.productImage ? (
                <Image
                  source={{ uri: item.productImage }}
                  style={{ width: 70, height: 70 }}
                  resizeMode="cover"
                />
              ) : (
                <Smartphone size={26} color={GREEN_DARK} />
              )}
            </View>
            {/* Seller pill anchored to the thumb */}
            <View
              style={{
                position: 'absolute',
                bottom: -6,
                left: '50%',
                transform: [{ translateX: -28 }],
                width: 56,
                paddingHorizontal: 6, paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 2, borderColor: '#FFFFFF',
                backgroundColor: isCustomer ? '#2563EB' : GREEN,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isCustomer ? (
                <User size={9} color="#FFFFFF" />
              ) : (
                <Store size={9} color="#FFFFFF" />
              )}
              <Text className="text-white text-[9px] font-extrabold ml-0.5" style={{ letterSpacing: 0.3 }}>
                {sellerLabel}
              </Text>
            </View>
          </View>

          <View className="flex-1 pr-2">
            <Text className="text-[14.5px] font-extrabold text-gray-900" numberOfLines={1}>
              {productName}
            </Text>
            {item.condition ? (
              <View
                className="self-start flex-row items-center px-2 py-1 rounded-full mt-1.5"
                style={{ backgroundColor: '#EDE9FE' }}
              >
                <Sparkles size={10} color="#7C3AED" />
                <Text
                  className="ml-1 text-[10px] font-extrabold"
                  style={{ color: '#7C3AED', letterSpacing: 0.3 }}
                >
                  {item.condition}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center mt-1.5">
              <MapPin size={12} color="#94A3B8" />
              <Text className="text-[11px] text-gray-500 ml-1 flex-1" numberOfLines={1}>
                {sellerLine}
              </Text>
            </View>
            {distance ? (
              <View
                className="self-start flex-row items-center px-2 py-1 rounded-full mt-1.5"
                style={{ backgroundColor: '#F0FDF4' }}
              >
                <NavIcon size={10} color={GREEN_DARK} />
                <Text
                  className="ml-1 text-[10px] font-extrabold"
                  style={{ color: GREEN_DARK }}
                >
                  {distance} away
                </Text>
              </View>
            ) : null}
          </View>

          <View className="items-end" style={{ minWidth: 70 }}>
            {isAwaitingQuote ? (
              <View
                className="px-2 py-1.5 rounded-lg items-center"
                style={{ backgroundColor: '#FEF3C7' }}
              >
                <Text
                  className="text-[10px] font-extrabold text-center"
                  style={{ color: '#B45309', lineHeight: 13 }}
                >
                  Awaiting{'\n'}Quote
                </Text>
              </View>
            ) : price ? (
              <>
                <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>
                  Price
                </Text>
                <Text
                  className="text-[17px] font-extrabold mt-0.5"
                  style={{ color: GREEN_DARK }}
                >
                  ₹{price}
                </Text>
              </>
            ) : (
              <Text className="text-[15px] font-extrabold text-gray-300">—</Text>
            )}
          </View>
        </View>

        {/* Dashed divider */}
        <View
          className="my-3"
          style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}
        />

        {/* Actions */}
        <View className="flex-row">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation?.navigate?.('OwnerBuyListingDetails', { listing: item })}
            className="flex-1 mr-2 rounded-xl py-2.5 flex-row items-center justify-center"
            style={{
              backgroundColor: '#F0FDF4',
              borderWidth: 1,
              borderColor: '#DCFCE7',
            }}
          >
            <Eye size={14} color={GREEN_DARK} />
            <Text className="ml-1.5 text-[12.5px] font-extrabold" style={{ color: GREEN_DARK }}>
              View Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              const phone = item.contactPhone || item.sellerPhone;
              if (phone) {
                Linking.openURL(`tel:${phone}`).catch(() => {});
              } else {
                notify(
                  'No phone yet',
                  isCustomer
                    ? 'This customer has not shared a phone number on this listing. Tap View Details to send a quotation instead.'
                    : 'No contact phone available for this seller.',
                );
              }
            }}
            className="flex-1 ml-2"
            style={cardShadow}
          >
            <LinearGradient
              colors={[GREEN_LIGHT, GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 12,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone size={14} color="#FFFFFF" />
              <Text className="ml-1.5 text-white text-[12.5px] font-extrabold">Contact</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const padH = 16;

  if (loading && items.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />
        <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
          <LinearGradient
            colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: 10,
              paddingBottom: 22,
              paddingHorizontal: padH,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}
          >
            <Text className="text-white text-[22px] font-extrabold">Buy</Text>
          </LinearGradient>
        </SafeAreaView>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 10,
            paddingBottom: 18,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View style={{ paddingHorizontal: padH }}>
            <View className="flex-row items-center">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <ShoppingBag size={14} color="#FFFFFF" />
                  <Text
                    className="text-white text-[13px] font-extrabold ml-1"
                    style={{ letterSpacing: 0.5 }}
                  >
                    BUY ON GGFIX
                  </Text>
                </View>
                <View className="flex-row items-center mt-0.5">
                  <MapPin size={13} color="rgba(255,255,255,0.9)" />
                  <Text
                    className="text-white text-[14px] font-bold ml-1"
                    style={{ maxWidth: width - 160 }}
                    numberOfLines={1}
                  >
                    {origin?.lat != null
                      ? `Within ${RADIUS_KM} km of ${origin.shopName || 'your shop'}`
                      : 'Set shop location for nearby deals'}
                  </Text>
                  <ChevronDown size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
              </View>
              <View
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ShoppingBag size={18} color="#FFFFFF" />
              </View>
            </View>

            <Text
              className="text-white text-[22px] font-extrabold mt-3.5"
              style={{ letterSpacing: -0.3 }}
            >
              Buy Mobiles & Spares
            </Text>
            <Text className="text-white/85 text-[12.5px] mt-1">
              Deals from verified shops & customers nearby.
            </Text>

            {/* Search pill */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                paddingHorizontal: 14, paddingVertical: 12,
                marginTop: 16,
                shadowColor: '#0F172A',
                shadowOpacity: 0.12,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <Search size={18} color={GREEN} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => load(true)}
                returnKeyType="search"
                placeholder="Search for models, spare parts..."
                placeholderTextColor="#94A3B8"
                style={{ flex: 1, marginLeft: 10, color: '#0F172A', fontSize: 14, padding: 0 }}
              />
              {query ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { setQuery(''); load(true); }}
                  className="w-7 h-7 rounded-full items-center justify-center mr-1"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  <X size={14} color="#64748B" />
                </TouchableOpacity>
              ) : null}
              <View
                style={{
                  backgroundColor: '#DCFCE7', borderRadius: 999,
                  paddingHorizontal: 10, paddingVertical: 4,
                  marginLeft: 4,
                }}
              >
                <Text style={{ color: GREEN_DARK, fontSize: 11, fontWeight: '800' }}>BUY</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Promise tiles */}
      <View className="flex-row mt-4" style={{ paddingHorizontal: padH }}>
        {PROMISES.map((p) => {
          const Icon = p.icon;
          return (
            <View
              key={p.label}
              className="flex-1 mx-1 rounded-xl bg-white items-center"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderWidth: 1,
                borderColor: '#F1F5F9',
              }}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mb-1.5"
                style={{ backgroundColor: p.tint }}
              >
                <Icon size={16} color={p.color} />
              </View>
              <Text
                className="text-[10.5px] font-extrabold text-gray-900 text-center"
                numberOfLines={1}
              >
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Filter strip */}
      <View
        className="flex-row items-center mt-4"
        style={{ paddingHorizontal: padH - 2 }}
      >
        <FilterChip
          icon={Zap}
          label="All"
          active={activeFilter === 'ALL'}
          onPress={() => setActiveFilter('ALL')}
        />
        <FilterChip
          icon={NavIcon}
          label="Nearby"
          active={activeFilter === 'NEARBY'}
          onPress={() => setActiveFilter('NEARBY')}
        />
        <FilterChip
          icon={Smartphone}
          label="Mobiles"
          active={activeFilter === 'MOBILES'}
          onPress={() => setActiveFilter('MOBILES')}
        />
        <FilterChip
          icon={Wrench}
          label="Spares"
          active={activeFilter === 'SPARES'}
          onPress={() => setActiveFilter('SPARES')}
        />
        <View style={{ marginLeft: 'auto' }}>
          <Text className="text-[11px] text-gray-500 font-semibold">
            {visibleItems.length} listing{visibleItems.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {error ? (
        <View className="px-4 mt-3">
          <View
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
          >
            <Text className="text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>
              {error}
            </Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[GREEN]}
            tintColor={GREEN}
          />
        }
        contentContainerStyle={{ paddingHorizontal: padH - 2, paddingTop: 14, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="items-center pt-16 px-8">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Store size={32} color={GREEN_DARK} />
            </View>
            <Text className="text-[15px] font-extrabold text-gray-700">
              No listings nearby
            </Text>
            <Text className="text-[12px] text-gray-400 mt-2 text-center leading-5">
              When customers or other shops within {RADIUS_KM} km post items for sale, they'll show up here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function FilterChip({ icon: Icon, label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-3 py-1.5 rounded-full mx-1"
      style={{
        backgroundColor: active ? GREEN : '#FFFFFF',
        borderWidth: 1,
        borderColor: active ? GREEN_DARK : '#DCFCE7',
      }}
    >
      <Icon size={12} color={active ? '#FFFFFF' : GREEN_DARK} />
      <Text
        className="ml-1 text-[11.5px] font-extrabold"
        style={{ color: active ? '#FFFFFF' : GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
