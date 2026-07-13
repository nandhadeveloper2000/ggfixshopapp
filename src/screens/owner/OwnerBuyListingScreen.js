import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  X,
  ChevronLeft,
  ShoppingCart,
  MapPin,
  Navigation as NavIcon,
  Phone,
  Eye,
  Sparkles,
  Smartphone,
  Store,
  User,
  Wrench,
} from 'lucide-react-native';
import { marketplaceApi } from '../../api/client';
import { listProducts, getCart } from '../../api/marketplace';
import { fetchMe } from '../../api/auth';
import { getSession } from '../../auth/session';
import { getDeviceCategories, getBrandsForCategory, getModelsByBrand } from '../../api/masterData';
import { listShops } from '../../api/shops';
import { OfferBanner } from '../../components/rnr';
import { notify } from '../../components/confirm';

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

const CAT_EMOJI = {
  MOBILE: '📱', SMARTPHONE: '📱',
  LAPTOP: '💻',
  TABLET: '📲',
  SMARTWATCH: '⌚', SMARTWATCHES: '⌚',
  AUDIO: '🎧', AUDIO_DEVICES: '🎧',
};
function catEmoji(code) { return CAT_EMOJI[String(code || '').toUpperCase()] || '📦'; }
function catImage(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// Normalize the two data sources into one card shape. The detail screen reads a
// lenient `listing` object, so a mapped product works there too.
function listingToCard(l) {
  return { ...l, _key: `listing:${l.id}`, source: 'listing' };
}
function productToCard(p) {
  return {
    _key: `product:${p.id}`,
    source: 'product',
    id: p.id,
    sellerType: 'SHOP',
    productName: p.title,
    productImage: p.imageUrl,
    expectedPrice: p.price,
    condition: p.conditionLabel,
    description: p.description,
    productType: p.type,            // DEVICE / SPARE_PART / ...
    modelId: p.modelId,
    brandId: p.brandId,
    shopId: p.shopId,
    categoryId: null,               // catalog products carry no categoryId
  };
}

/**
 * Owner "Buy" browse screen — the dashboard Buy Categories rail and its
 * "See all" both land here. Mirrors the customer Buy experience but on the
 * shop app's own data: peer listings (/marketplace/buy/nearby — customer + shop
 * sell) merged with the shop catalog (/marketplace/products — devices + spare
 * parts), filterable by an in-screen category strip.
 */
export default function OwnerBuyListingScreen({ navigation, route }) {
  const { categoryId, categoryCode, categoryName } = route?.params || {};

  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(
    categoryId ? { id: categoryId, code: categoryCode, name: categoryName } : null,
  );
  const [listings, setListings] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [query, setQuery] = useState('');
  const [allowedModelIds, setAllowedModelIds] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const modelCache = useRef(new Map());

  // Keep the header cart badge fresh — reloads whenever the screen is focused
  // (e.g. after adding an item from the detail screen and coming back).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const c = await getCart();
          if (!cancelled) {
            setCartCount((Array.isArray(c) ? c : []).reduce((s, it) => s + (Number(it.quantity) || 0), 0));
          }
        } catch {}
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // Category strip source — same set as the customer Buy home.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getDeviceCategories();
        // Fixed display order: Mobile → Laptop → Tablet → Smartwatches → Audio Device.
        const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatches', 'audio device'];
        const rank = (c) => {
          const i = ORDER.indexOf((c.name || '').trim().toLowerCase());
          return i === -1 ? ORDER.length : i;
        };
        if (!cancelled) setCats((list || []).filter((c) => c.isActive !== false).sort((a, b) => rank(a) - rank(b)));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const ensureOrigin = useCallback(async () => {
    let session = await fetchMe().catch(() => null);
    if (!session) session = await getSession();
    const shop = session?.activeShop;
    const shopId = shop?.id || session?.shopId || null;
    if (shop && shop.latitude != null && shop.longitude != null) {
      return {
        lat: Number(shop.latitude),
        lng: Number(shop.longitude),
        shopName: shop.name,
        sellerId: session?.userId,
        shopId,
      };
    }
    return { lat: null, lng: null, shopName: session?.shopName, sellerId: session?.userId, shopId };
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
        if (o.lat != null && o.lng != null) { params.lat = o.lat; params.lng = o.lng; }
        if (o.sellerId) params.excludeSellerId = o.sellerId;

        const [listingData, productData, shopData] = await Promise.all([
          marketplaceApi.get('/marketplace/buy/nearby', { query: params }).catch(() => []),
          listProducts({ status: 'ACTIVE' }).catch(() => []),
          listShops().catch(() => []),
        ]);

        // Map shopId → shop so we can show the seller's shop name on each card.
        const shopMap = new Map();
        (Array.isArray(shopData) ? shopData : []).forEach((s) => { if (s?.id) shopMap.set(s.id, s); });

        // "Buy" = OTHER shops + customers. Never list my own shop's items —
        // peer listings already exclude my userId, but catalog products and any
        // shop listing still need an explicit shopId filter.
        const myShopId = o.shopId || null;

        const listingArr = Array.isArray(listingData)
          ? listingData : listingData?.content ?? listingData?.data ?? [];
        const listingCards = (listingArr || [])
          .filter((l) => !myShopId || l.shopId !== myShopId)
          .map((l) => {
            const shop = l.shopId ? shopMap.get(l.shopId) : null;
            const card = listingToCard(l);
            return {
              ...card,
              shopName: l.sellerType === 'SHOP' ? (shop?.name || null) : null,
              city: card.city || shop?.city || null,
              state: card.state || shop?.state || null,
            };
          });
        setListings(listingCards);

        const productCards = (productData || [])
          .filter((p) => !myShopId || p.shopId !== myShopId)
          .map((p) => {
            const card = productToCard(p);
            const shop = p.shopId ? shopMap.get(p.shopId) : null;
            return {
              ...card,
              shopName: shop?.name || null,
              city: shop?.city || null,
              state: shop?.state || null,
            };
          });
        setProducts(productCards);
      } catch (e) {
        setError(e.message || 'Failed to load listings');
        setListings([]);
        setProducts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [origin, ensureOrigin],
  );

  useEffect(() => { load(); }, [load]);

  // The Buy tab is also reached from the Home dashboard's category rail, which
  // passes a category (or categoryId:null for "All"). Sync the selection when
  // those params change so tapping a Home category lands here pre-filtered.
  useEffect(() => {
    const p = route?.params;
    if (!p || !('categoryId' in p)) return;
    setSelected(p.categoryId ? { id: p.categoryId, code: p.categoryCode, name: p.categoryName } : null);
  }, [route?.params?.categoryId, route?.params?.categoryCode, route?.params?.categoryName]);

  // Search text forwarded from the global search ("… in buy").
  useEffect(() => {
    const q = route?.params?.q;
    if (typeof q === 'string' && q) setQuery(q);
  }, [route?.params?.q]);

  // Resolve the selected category → allowed model IDs (cached), so catalog
  // products (which lack a categoryId) can be matched by their modelId.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = selected?.id || selected?.code;
      if (!key) { setAllowedModelIds(null); return; }
      if (modelCache.current.has(key)) { setAllowedModelIds(modelCache.current.get(key)); return; }
      try {
        const brands = await getBrandsForCategory(key).catch(() => []);
        const lists = await Promise.all((brands || []).map((b) => getModelsByBrand(b.id).catch(() => [])));
        const ids = new Set();
        lists.flat().forEach((m) => { if (m?.id) ids.add(m.id); });
        modelCache.current.set(key, ids);
        if (!cancelled) setAllowedModelIds(ids);
      } catch {
        if (!cancelled) setAllowedModelIds(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const visibleItems = useMemo(() => {
    const all = [...listings, ...products];
    const wantId = selected?.id || null;
    const inCat = (it) => {
      if (!selected) return true;                                         // "All"
      if (wantId && it.categoryId) return it.categoryId === wantId;       // listings
      if (it.modelId && allowedModelIds && allowedModelIds.has(it.modelId)) return true; // products/listings by model
      if (!it.categoryId && !it.modelId) return true;                     // legacy rows
      return false;
    };
    const q = query.trim().toLowerCase();
    return all.filter(inCat).filter((it) => {
      if (!q) return true;
      return [it.productName, it.condition, it.city, it.state]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [listings, products, selected, allowedModelIds, query]);

  const openDetail = (item) => navigation.navigate('OwnerBuyListingDetails', { listing: item });

  const renderItem = ({ item }) => {
    const productName = item.productName || 'Untitled';
    const isCustomer = item.sellerType === 'CUSTOMER';
    const isSpare = item.productType === 'SPARE_PART';
    const sellerLabel = isCustomer ? 'Customer' : 'Shop';
    const sellerLine = [item.city, item.state].filter(Boolean).join(', ') || item.address || '—';
    const distance = item.distanceKm != null ? `${item.distanceKm} km` : null;
    const priceNum = item.expectedPrice != null ? Number(item.expectedPrice) : null;
    const isAwaitingQuote = priceNum != null && priceNum === 0;
    const price = priceNum != null && priceNum > 0 ? priceNum.toLocaleString('en-IN') : null;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openDetail(item)}
        className="bg-white rounded-2xl p-4 mb-3"
        style={cardShadow}
      >
        <View className="flex-row items-start">
          <View style={{ position: 'relative', marginRight: 12 }}>
            <View
              className="w-[70px] h-[70px] rounded-2xl overflow-hidden items-center justify-center"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              {item.productImage ? (
                <Image source={{ uri: item.productImage }} style={{ width: 70, height: 70 }} resizeMode="cover" />
              ) : isSpare ? (
                <Wrench size={24} color={GREEN_DARK} />
              ) : (
                <Smartphone size={26} color={GREEN_DARK} />
              )}
            </View>
            <View
              style={{
                position: 'absolute', bottom: -6, left: '50%',
                transform: [{ translateX: -28 }], width: 56,
                paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999,
                borderWidth: 2, borderColor: '#FFFFFF',
                backgroundColor: isCustomer ? '#2563EB' : GREEN,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isCustomer ? <User size={9} color="#FFFFFF" /> : <Store size={9} color="#FFFFFF" />}
              <Text className="text-white text-[9px] font-extrabold ml-0.5" style={{ letterSpacing: 0.3 }}>
                {sellerLabel}
              </Text>
            </View>
          </View>

          <View className="flex-1 pr-2">
            <Text className="text-[14.5px] font-extrabold text-gray-900" numberOfLines={1}>
              {productName}
            </Text>
            <View className="flex-row items-center mt-1.5" style={{ flexWrap: 'wrap' }}>
              {isSpare ? (
                <View
                  className="self-start flex-row items-center px-2 py-1 rounded-full mr-1.5 mb-1"
                  style={{ backgroundColor: '#FEF3C7' }}
                >
                  <Wrench size={10} color="#B45309" />
                  <Text className="ml-1 text-[10px] font-extrabold" style={{ color: '#B45309', letterSpacing: 0.3 }}>
                    SPARE PART
                  </Text>
                </View>
              ) : null}
              {item.condition ? (
                <View
                  className="self-start flex-row items-center px-2 py-1 rounded-full mb-1"
                  style={{ backgroundColor: '#EDE9FE' }}
                >
                  <Sparkles size={10} color="#7C3AED" />
                  <Text className="ml-1 text-[10px] font-extrabold" style={{ color: '#7C3AED', letterSpacing: 0.3 }}>
                    {item.condition}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.shopName ? (
              <View className="flex-row items-center mt-0.5">
                <Store size={12} color="#94A3B8" />
                <Text className="text-[11.5px] text-gray-700 font-bold ml-1 flex-1" numberOfLines={1}>
                  {item.shopName}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center mt-0.5">
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
                <Text className="ml-1 text-[10px] font-extrabold" style={{ color: GREEN_DARK }}>
                  {distance} away
                </Text>
              </View>
            ) : null}
          </View>

          <View className="items-end" style={{ minWidth: 70 }}>
            {isAwaitingQuote ? (
              <View className="px-2 py-1.5 rounded-lg items-center" style={{ backgroundColor: '#FEF3C7' }}>
                <Text className="text-[10px] font-extrabold text-center" style={{ color: '#B45309', lineHeight: 13 }}>
                  Awaiting{'\n'}Quote
                </Text>
              </View>
            ) : price ? (
              <>
                <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>
                  Price
                </Text>
                <Text className="text-[17px] font-extrabold mt-0.5" style={{ color: GREEN_DARK }}>
                  ₹{price}
                </Text>
              </>
            ) : (
              <Text className="text-[15px] font-extrabold text-gray-300">—</Text>
            )}
          </View>
        </View>

        <View className="my-3" style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }} />

        <View className="flex-row">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openDetail(item)}
            className="flex-1 mr-2 rounded-xl py-2.5 flex-row items-center justify-center"
            style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' }}
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
              style={{ borderRadius: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
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

  const CategoryChip = ({ active, label, emoji, uri, onPress }) => (
    <Pressable
      onPress={onPress}
      className="items-center mr-3 active:opacity-80"
      style={{ width: 64 }}
    >
      <View
        className="h-14 w-14 rounded-2xl items-center justify-center"
        style={{
          backgroundColor: active ? GREEN : '#FFFFFF',
          borderWidth: 1,
          borderColor: active ? GREEN_DARK : '#EEF2F6',
          ...cardShadow,
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 34, height: 34 }} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        )}
      </View>
      <Text
        className="text-[10.5px] font-bold mt-1 text-center"
        numberOfLines={1}
        style={{ color: active ? GREEN_DARK : '#0F172A' }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const ListHeader = (
    <View>
      {/* Categories strip */}
      <View style={{ paddingTop: 14, paddingBottom: 4 }}>
        <Text className="text-[14px] font-extrabold text-gray-900 mb-2" style={{ paddingHorizontal: padH }}>
          Shop by category
        </Text>
        <FlatList
          data={[{ all: true }, ...cats]}
          keyExtractor={(c, i) => (c.all ? 'all' : c.id || String(i))}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: padH }}
          renderItem={({ item: c }) => {
            if (c.all) {
              return (
                <CategoryChip
                  active={!selected}
                  label="All"
                  emoji="🛍️"
                  onPress={() => setSelected(null)}
                />
              );
            }
            const code = (c.code || '').toUpperCase();
            const isActive = selected?.id === c.id;
            return (
              <CategoryChip
                active={isActive}
                label={c.name}
                emoji={catEmoji(code)}
                uri={catImage(c)}
                onPress={() => setSelected({ id: c.id, code, name: c.name })}
              />
            );
          }}
        />
      </View>

      {/* Banner */}
      <View style={{ paddingHorizontal: padH, marginTop: 12, marginBottom: 6 }}>
        <OfferBanner
          badge="NEARBY DEALS"
          title="Buy refurbished & spares"
          subtitle="From verified shops & customers within your area."
          cta="Browse all"
          palette="emerald"
          onPress={() => setSelected(null)}
        />
      </View>

      {/* Result count */}
      <View style={{ paddingHorizontal: padH, marginTop: 6, marginBottom: 4 }} className="flex-row items-center justify-between">
        <Text className="text-[13px] font-extrabold text-gray-900">
          {selected ? selected.name : 'All listings'}
        </Text>
        <Text className="text-[11px] text-gray-500 font-semibold">
          {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: 10,
            paddingBottom: 18,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <View style={{ paddingHorizontal: padH }}>
            {/* Back · Buy · Cart */}
            <View className="flex-row items-center">
              <Pressable
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                hitSlop={10}
                className="h-9 w-9 rounded-full items-center justify-center bg-surface-muted"
              >
                <ChevronLeft size={20} color="#0F172A" />
              </Pressable>
              <Text className="flex-1 text-center text-text text-[18px] font-extrabold">Buy</Text>
              <Pressable
                onPress={() => navigation.navigate('OwnerCart')}
                hitSlop={10}
                className="h-9 w-9 rounded-full items-center justify-center bg-surface-muted"
              >
                <ShoppingCart size={18} color="#0F172A" />
                {cartCount > 0 ? (
                  <View
                    className="absolute -top-1 -right-1 rounded-full min-w-[16px] h-4 px-1 items-center justify-center"
                    style={{ backgroundColor: '#F59E0B', borderWidth: 1.5, borderColor: GREEN_DARK }}
                  >
                    <Text className="text-white text-[9px] font-extrabold">{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            {/* Search box */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F1F5F9', borderRadius: 16,
                borderWidth: 1, borderColor: '#E5E7EB',
                paddingHorizontal: 14, paddingVertical: 12, marginTop: 14,
              }}
            >
              <Search size={18} color={GREEN} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                placeholder="Search mobiles, spares & more..."
                placeholderTextColor="#94A3B8"
                style={{ flex: 1, marginLeft: 10, color: '#0F172A', fontSize: 14, padding: 0 }}
              />
              {query ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setQuery('')}
                  className="w-7 h-7 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  <X size={14} color="#64748B" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View className="px-4 mt-3">
          <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text className="text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>{error}</Text>
          </View>
        </View>
      ) : null}

      {loading && listings.length === 0 && products.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={GREEN} />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item._key}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[GREEN]} tintColor={GREEN} />
          }
          contentContainerStyle={{ paddingHorizontal: padH - 2, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center pt-12 px-8">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#DCFCE7' }}>
                <Store size={32} color={GREEN_DARK} />
              </View>
              <Text className="text-[15px] font-extrabold text-gray-700">
                No {selected ? `${String(selected.name).toLowerCase()} ` : ''}items yet
              </Text>
              <Text className="text-[12px] text-gray-400 mt-2 text-center leading-5">
                Listings from customers & shops and shop catalogue items will show up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
