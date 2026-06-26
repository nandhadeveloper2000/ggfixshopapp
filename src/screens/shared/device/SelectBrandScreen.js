import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Check, Pencil } from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader, SearchBar, SelectionCrumb } from '../../../components/rnr';
import { getBrandsForCategory } from '../../../api/masterData';

// Canonical brand picker used by all flows (Booking / Sell / Owner-list /
// Profile). Pixel-exact card width via useWindowDimensions: 3 columns on
// phones, 4 on tablets, logo box at 55% of card width.
const HORIZONTAL_PAD = 16;
const GRID_GAP = 12;
function gridMetrics(screenWidth) {
  const numColumns = screenWidth >= 600 ? 4 : 3;
  // Math.floor — RN's layout rounds subpixel widths UP when rendering. A
  // cardWidth of 101.333 can render at 102, and 3*102 + 2*gap + padding then
  // overflows the row by 1-2px, wrapping the 3rd card to row 2. Floor keeps
  // the row a hair narrower than the available space so 3 fit reliably.
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
  // Edit mode comes from two flows: Sell order edit (editSellOrderId +
  // editHints.brandId) or Booking edit (editMode + brandId passed directly
  // from TicketDetailScreen.buildEditParams).
  const bookingEditMode = !!route?.params?.editMode;
  const isEditing = !!editSellOrderId || bookingEditMode;
  const currentBrandId = editHints?.brandId
    || (bookingEditMode ? route?.params?.brandId : null)
    || null;
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth } = gridMetrics(screenWidth);
  const logoBox = Math.round(cardWidth * 0.55);

  useEffect(() => {
    (async () => {
      try { setBrands(await getBrandsForCategory(categoryId)); } catch (_) {}
      setLoading(false);
    })();
  }, [categoryId]);

  const filtered = useMemo(() => {
    let list = brands;
    if (isEditing && currentBrandId) {
      const current = brands.find((b) => b.id === currentBrandId);
      const rest = brands.filter((b) => b.id !== currentBrandId);
      list = current ? [current, ...rest] : brands;
    }
    if (!q.trim()) return list;
    return list.filter((b) => (b.name || '').toLowerCase().includes(q.toLowerCase()));
  }, [brands, q, isEditing, currentBrandId]);

  // Spread route.params so booking-flow extras (editMode, editTicketId,
  // prefill*, customer, etc.) flow through to every downstream picker.
  const onPick = (b) => navigation.navigate('SelectSeries', {
    ...(route?.params || {}),
    flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId: b.id, brandName: b.name,
    editSellOrderId, editHints,
  });

  const crumbs = [{ label: 'Category', value: categoryName }];
  if (deviceTypeName) crumbs.push({ label: 'Device', value: deviceTypeName });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Select Brand"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        sticky={false}
      />
      <View className="px-4 pt-3 pb-3 bg-card border-b border-border">
        <SelectionCrumb items={crumbs} className="mb-3" />
        {isEditing && editHints?.modelName ? (
          <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 mb-3 flex-row items-center">
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
        ) : null}
        <SearchBar value={q} onChangeText={setQ} placeholder="Search brand" onClear={() => setQ('')} />
      </View>

      {loading ? (
        <Loader label="Loading brands..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <EmptyState
              title="No brands found"
              description={q ? `We don't recognize "${q}".` : 'No brands mapped to this category yet.'}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {filtered.map((b) => {
                const palette = paletteFor(b.name);
                const initial = (b.name || '?').slice(0, 1).toUpperCase();
                const logo = b.imageUrl || b.imageBase64;
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
                        <Image
                          source={{ uri: logo }}
                          style={{ width: logoBox - 12, height: logoBox - 12 }}
                          resizeMode="contain"
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
