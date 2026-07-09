import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Pencil, Search, ArrowLeft, X } from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader } from '../../../components/rnr';
import DeviceImage from '../../../components/DeviceImage';
import { resolveDeviceImageSource } from '../../../utils/images';
import { getBrandsForCategory } from '../../../api/masterData';

// Canonical brand picker used by all flows (Booking / Sell / Owner-list /
// Profile). 3 columns on phones, 4 on tablets, logo box at 55% of card width.
const HORIZONTAL_PAD = 16;
const GRID_GAP = 12;
function gridMetrics(screenWidth) {
  const numColumns = screenWidth >= 600 ? 4 : 3;
  const cardWidth = Math.floor((screenWidth - HORIZONTAL_PAD * 2 - GRID_GAP * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth };
}

const BRAND_PALETTES = [
  { bg: 'bg-primary/10',   text: 'text-primary' },
  { bg: 'bg-secondary/10', text: 'text-secondary' },
  { bg: 'bg-success/10',   text: 'text-success' },
  { bg: 'bg-warning/10',   text: 'text-warning' },
  { bg: 'bg-danger/10',    text: 'text-danger' },
  { bg: 'bg-info/10',      text: 'text-info' },
];
function paletteFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_PALETTES[h % BRAND_PALETTES.length];
}

export default function SelectBrandScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    editSellOrderId, editHints,
  } = route?.params || {};
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const bookingEditMode = !!route?.params?.editMode;
  const isEditing = !!editSellOrderId || bookingEditMode;
  const currentBrandId = editHints?.brandId
    || (bookingEditMode ? route?.params?.brandId : null)
    || null;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth } = gridMetrics(screenWidth);
  const logoBox = Math.round(cardWidth * 0.55);

  useEffect(() => {
    (async () => {
      try { setBrands(await getBrandsForCategory(categoryId)); } catch (_) {}
      setLoading(false);
    })();
  }, [categoryId]);

  const gridBrands = useMemo(() => {
    if (isEditing && currentBrandId) {
      const current = brands.find((b) => b.id === currentBrandId);
      const rest = brands.filter((b) => b.id !== currentBrandId);
      return current ? [current, ...rest] : brands;
    }
    return brands;
  }, [brands, isEditing, currentBrandId]);

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((b) => (b.name || '').toLowerCase().includes(needle));
  }, [brands, q]);

  const onPick = (b) => navigation.navigate('SelectModel', {
    ...(route?.params || {}),
    flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId: b.id, brandName: b.name,
    editSellOrderId, editHints,
  });

  // ── Full-screen search mode ───────────────────────────────────────────────
  if (searchOpen) {
    return (
      <View className="flex-1 bg-background">
        <View
          className="flex-row items-center px-2 pb-2 bg-card border-b border-border"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            onPress={() => { setSearchOpen(false); setQ(''); }}
            className="h-10 w-10 items-center justify-center"
            hitSlop={8}
          >
            <ArrowLeft size={22} color="#0F172A" />
          </Pressable>
          <View className="flex-1 flex-row items-center rounded-xl px-3" style={{ backgroundColor: '#EEF2F6' }}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search brand"
              placeholderTextColor="#94A3B8"
              className="flex-1 py-2.5 ml-2 text-text text-[14px]"
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <X size={18} color="#64748B" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          {searchResults.length === 0 ? (
            <EmptyState title="No brands found" description={q ? `Nothing matches "${q.trim()}".` : 'Start typing to search.'} />
          ) : (
            searchResults.map((b) => {
              const hasImg = !!(b.imageUrl || b.imageBase64);
              const palette = paletteFor(b.name);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => onPick(b)}
                  className="flex-row items-center px-4 py-2.5 border-b border-border active:bg-primary/5"
                >
                  <View className="h-10 w-10 rounded-lg overflow-hidden bg-white border border-border items-center justify-center mr-3">
                    {hasImg ? (
                      <DeviceImage url={b.imageUrl} base64={b.imageBase64} style={{ width: 32, height: 32 }} />
                    ) : (
                      <View className={`h-10 w-10 items-center justify-center ${palette.bg}`}>
                        <Text className={`text-[14px] font-extrabold ${palette.text}`}>{(b.name || '?').slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="flex-1 text-[14px] text-text" numberOfLines={1}>{b.name}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Normal mode ───────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Select Brand"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        sticky={false}
        right={(
          <Pressable onPress={() => setSearchOpen(true)} className="h-10 w-10 items-center justify-center" hitSlop={8}>
            <Search size={22} color="#0F172A" />
          </Pressable>
        )}
      />
      {isEditing && editHints?.modelName ? (
        <View className="px-4 pt-3 pb-3 bg-card border-b border-border">
          <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 flex-row items-center">
            <Pencil size={13} color="#F59E0B" />
            <View className="flex-1 ml-2">
              <Text className="text-[10px] font-extrabold text-warning tracking-wider">
                {flow === 'BOOKING' ? 'EDITING BOOKING' : 'EDITING ORDER'}
              </Text>
              <Text className="text-[12px] text-text font-semibold" numberOfLines={1}>
                Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {loading ? (
        <Loader label="Loading brands..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {gridBrands.length === 0 ? (
            <EmptyState title="No brands found" description="No brands mapped to this category yet." />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {gridBrands.map((b) => {
                const palette = paletteFor(b.name);
                const initial = (b.name || '?').slice(0, 1).toUpperCase();
                const logo = resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 });
                const isCurrent = isEditing && b.id === currentBrandId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => onPick(b)}
                    className={`bg-card border rounded-2xl active:opacity-80 ${isCurrent ? 'border-primary' : 'border-border'}`}
                    style={{
                      width: cardWidth,
                      padding: 10,
                      alignItems: 'center',
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.04,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 1,
                    }}
                  >
                    <View
                      className="rounded-xl items-center justify-center overflow-hidden bg-white border border-border"
                      style={{ height: logoBox, width: logoBox, marginBottom: 8 }}
                    >
                      {logo ? (
                        <DeviceImage
                          url={b.imageUrl}
                          base64={b.imageBase64}
                          style={{ width: logoBox - 12, height: logoBox - 12 }}
                        />
                      ) : (
                        <View className={`items-center justify-center ${palette.bg}`} style={{ height: logoBox, width: logoBox }}>
                          <Text className={`text-[22px] font-extrabold ${palette.text}`}>{initial}</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className="text-[12.5px] font-extrabold text-text"
                      numberOfLines={1}
                      style={{ textAlign: 'center', width: '100%' }}
                    >
                      {b.name}
                    </Text>
                    {isCurrent ? (
                      <View className="flex-row items-center bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 mt-1.5">
                        <Check size={10} color="#16A34A" />
                        <Text className="text-[9.5px] font-extrabold text-primary ml-1">Current</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
