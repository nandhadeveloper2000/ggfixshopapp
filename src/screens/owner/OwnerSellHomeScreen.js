import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Search,
  Store,
  ChevronDown,
  Tag,
  MapPin,
  ChevronLeft,
} from 'lucide-react-native';
import { EmptyState, Loader } from '../../components/rnr';
import { getDeviceCategories } from '../../api/masterData';

// Mirrors the customer SellHomeScreen palette + layout so both apps speak
// the same visual language for the "Sell" flow. Differences: routes into
// the OWNER_LIST flow (SelectBrand instead of SellSelectDevice), copy is
// shop-owner phrased ("List for sale" vs "Sell & Earn"), and "My Listings"
// CTA replaces the customer's bell notification chip.
const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

const CODE_META = {
  MOBILE:        { bg: '#DCFCE7', emoji: '📱', sub: 'Smartphones' },
  SMARTPHONE:    { bg: '#DCFCE7', emoji: '📱', sub: 'Smartphones' },
  LAPTOP:        { bg: '#F5F3FF', emoji: '💻', sub: 'Laptops & Notebooks' },
  SMARTWATCH:    { bg: '#FFFBEB', emoji: '⌚', sub: 'Smart Watches' },
  SMARTWATCHES:  { bg: '#FFFBEB', emoji: '⌚', sub: 'Smart Watches' },
  TABLET:        { bg: '#F0F9FF', emoji: '📲', sub: 'Tablets' },
  AUDIO:         { bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds & Headphones' },
  AUDIO_DEVICES: { bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds & Headphones' },
  SPEAKER:       { bg: '#ECFDF5', emoji: '🔈', sub: 'Speakers' },
};
const DEFAULT_META = { bg: '#DCFCE7', emoji: '📱', sub: 'Devices' };

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

const PROMISES = [
  { icon: TrendingUp,  label: 'Quick Listing',   tint: '#DCFCE7', color: GREEN_DARK },
  { icon: ShieldCheck, label: 'Trusted Buyers',  tint: '#FFEDD5', color: '#C2410C' },
  { icon: Sparkles,    label: 'Boost Visibility', tint: '#FEF3C7', color: '#B45309' },
];

const STEPS = [
  { n: 1, title: 'Pick a category',         sub: 'Mobile · Laptop · Audio · Tablet…' },
  { n: 2, title: 'Add device & photos',     sub: 'Condition · IMEI · pricing' },
  { n: 3, title: 'Publish to marketplace',  sub: 'Buyers see your listing instantly' },
];

function columnsFor(width) {
  if (width >= 1000) return 4;
  if (width >= 720)  return 3;
  if (width >= 360)  return 2;
  return 1;
}

export default function OwnerSellHomeScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'OWNER_LIST';
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      try {
        const list = await getDeviceCategories();
        // Fixed display order: Mobile → Laptop → Tablet → Smartwatches → Audio Device.
        const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatches', 'audio device'];
        const rank = (c) => {
          const i = ORDER.indexOf((c.name || '').trim().toLowerCase());
          return i === -1 ? ORDER.length : i;
        };
        setCats((list || []).filter((c) => c.isActive !== false).sort((a, b) => rank(a) - rank(b)));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return cats;
    const needle = q.toLowerCase();
    return cats.filter((c) => (c.name || '').toLowerCase().includes(needle));
  }, [cats, q]);

  const padH = 16;
  const numCols = columnsFor(width);
  const gridGap = 12;
  const cardW = Math.floor((width - padH * 2 - gridGap * (numCols - 1)) / numCols);
  const imgH = Math.round(cardW * 0.7);

  const goPickCategory = (c) =>
    navigation.navigate('SelectBrand', {
      flow,
      categoryId: c.id,
      categoryCode: (c.code || '').toUpperCase(),
      categoryName: c.name,
      editSellOrderId: route?.params?.editSellOrderId,
    });

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: 10,
            paddingBottom: 18,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <View style={{ paddingHorizontal: padH }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {navigation?.canGoBack?.() ? (
                <Pressable
                  onPress={() => navigation.goBack()}
                  hitSlop={8}
                  style={{
                    height: 36, width: 36, borderRadius: 18,
                    backgroundColor: '#F1F3F5',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <ChevronLeft size={20} color="#0F172A" />
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Store size={14} color="#0F172A" />
                  <Text
                    style={{
                      color: '#0F172A', fontWeight: '800', fontSize: 13,
                      marginLeft: 4, letterSpacing: 0.5,
                    }}
                  >
                    SELL ON GGFIX
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <MapPin size={13} color="#64748B" />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#0F172A', fontWeight: '700', fontSize: 14,
                      marginLeft: 4, maxWidth: width - 180,
                    }}
                  >
                    Listings reach nearby buyers
                  </Text>
                  <ChevronDown size={15} color="#0F172A" style={{ marginLeft: 4 }} />
                </View>
              </View>
              <Pressable
                onPress={() => navigation.navigate('OwnerSellListed')}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: '#F1F3F5',
                  flexDirection: 'row', alignItems: 'center',
                }}
              >
                <Store size={12} color="#0F172A" />
                <Text style={{ color: '#64748B', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, marginLeft: 4 }}>
                  MY LIST
                </Text>
              </Pressable>
            </View>

            <Text
              style={{
                color: '#0F172A', fontSize: 22, fontWeight: '800',
                marginTop: 14, letterSpacing: -0.3,
              }}
            >
              List a device for sale
            </Text>
            <Text
              style={{ color: '#64748B', fontSize: 12.5, marginTop: 3 }}
            >
              Reach verified buyers — quick listing, instant exposure.
            </Text>

            {/* Search pill — visually opens the search bar below the hero so
                tapping it scrolls the user into the same field they'd use on
                the customer side. */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#fff', borderRadius: 16,
                paddingHorizontal: 14, paddingVertical: 12,
                marginTop: 16,
                shadowColor: '#0F172A', shadowOpacity: 0.12,
                shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
              }}
            >
              <Search size={18} color={GREEN} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search a category to list"
                placeholderTextColor="#94A3B8"
                style={{
                  flex: 1, marginLeft: 10,
                  color: '#0F172A', fontSize: 14, padding: 0,
                }}
              />
              <View
                style={{
                  backgroundColor: '#DCFCE7', borderRadius: 999,
                  paddingHorizontal: 10, paddingVertical: 4,
                  marginLeft: 6,
                }}
              >
                <Text style={{ color: GREEN_DARK, fontSize: 11, fontWeight: '800' }}>LIST</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <Loader label="Loading categories..." />
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Promise tiles */}
          <View style={{ flexDirection: 'row', paddingHorizontal: padH, marginTop: 16 }}>
            {PROMISES.map((p) => {
              const Icon = p.icon;
              return (
                <View
                  key={p.label}
                  style={{
                    flex: 1, marginHorizontal: 4,
                    backgroundColor: '#fff', borderRadius: 14,
                    paddingVertical: 12, paddingHorizontal: 6,
                    alignItems: 'center',
                    borderWidth: 1, borderColor: '#F1F5F9',
                  }}
                >
                  <View
                    style={{
                      height: 32, width: 32, borderRadius: 16,
                      backgroundColor: p.tint,
                      alignItems: 'center', justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Icon size={16} color={p.color} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10.5, fontWeight: '700', color: '#0F172A', textAlign: 'center',
                    }}
                  >
                    {p.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Section header */}
          <View
            style={{
              paddingHorizontal: padH,
              marginTop: 22, marginBottom: 10,
              flexDirection: 'row', alignItems: 'flex-end',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17, fontWeight: '800',
                  color: '#0F172A', letterSpacing: -0.2,
                }}
              >
                Choose sales category
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                What are you listing today?
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#DCFCE7', borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 4,
              }}
            >
              <Text style={{ color: GREEN_DARK, fontSize: 11, fontWeight: '800' }}>
                {cats.length} options
              </Text>
            </View>
          </View>

          {/* Category grid */}
          {filtered.length === 0 ? (
            <View style={{ paddingHorizontal: padH }}>
              <EmptyState
                title="No categories"
                description={q ? `No matches for "${q}".` : "The admin hasn't published any device categories."}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: padH }}>
              {filtered.map((c, i) => {
                const code = (c.code || '').toUpperCase();
                const meta = CODE_META[code] || DEFAULT_META;
                const uri = imgUri(c);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => goPickCategory(c)}
                    style={{
                      width: cardW,
                      marginLeft: i % numCols === 0 ? 0 : gridGap,
                      marginBottom: gridGap,
                      backgroundColor: '#fff',
                      borderRadius: 18,
                      padding: 10,
                      borderWidth: 1, borderColor: '#F1F5F9',
                      shadowColor: '#0F172A', shadowOpacity: 0.05,
                      shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
                    }}
                  >
                    <View
                      style={{
                        width: '100%', height: imgH, borderRadius: 14,
                        backgroundColor: uri ? '#FFFFFF' : meta.bg,
                        alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: Math.min(44, imgH * 0.5) }}>{meta.emoji}</Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}
                    >
                      {c.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}
                    >
                      {meta.sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Bottom CTA */}
          <View style={{ paddingHorizontal: padH, marginTop: 18 }}>
            <Pressable
              onPress={() => navigation.navigate('OwnerSellListed')}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#F0FDF4', borderRadius: 16,
                borderWidth: 1, borderColor: '#BBF7D0',
                paddingHorizontal: 14, paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    height: 36, width: 36, borderRadius: 18,
                    backgroundColor: '#DCFCE7',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Store size={18} color={GREEN_DARK} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                    My Listings
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                    Manage devices you've already published
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: GREEN_DARK }}>
                View →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
