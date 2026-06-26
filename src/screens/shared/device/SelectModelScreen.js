import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Smartphone, Check, Pencil } from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader, SearchBar, SelectionCrumb } from '../../../components/rnr';
import { getModelsByBrand, getModelsBySeries } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical model picker used by all flows. Pixel-exact card width, 3-on-phone
// / 4-on-tablet, logo box scales with card. Routes to DeviceColorStorage
// (booking), OwnerSellChooseSalesCategory (owner-list), SellScreening (sell),
// or SelectVariant (profile/repair) depending on flow.
const HORIZONTAL_PAD = 16;
const GRID_GAP = 12;
function gridMetrics(screenWidth) {
  const numColumns = screenWidth >= 600 ? 4 : 3;
  // Math.floor — see SelectBrandScreen for explanation; without it RN can
  // round subpixel widths up and wrap the 3rd card to a new row.
  const cardWidth = Math.floor((screenWidth - HORIZONTAL_PAD * 2 - GRID_GAP * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth };
}

export default function SelectModelScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId, brandName, seriesId, seriesName, editSellOrderId, editHints,
  } = route?.params || {};
  const bookingEditMode = !!route?.params?.editMode;
  const isEditing = !!editSellOrderId || bookingEditMode;
  const currentModelId = editHints?.modelId
    || (bookingEditMode ? route?.params?.modelId : null)
    || null;
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth } = gridMetrics(screenWidth);
  const logoBox = Math.round(cardWidth * 0.55);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list;
        if (seriesId) {
          list = await getModelsBySeries(seriesId);
        } else {
          list = await getModelsByBrand(brandId);
          // Brand may span categories (Apple = Mobile + Laptop); keep this category.
          if (UUID_RE.test(String(categoryId || ''))) {
            list = (list || []).filter((m) => !m.categoryId || m.categoryId === categoryId);
          }
        }
        if (!cancelled) setModels(list || []);
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId, seriesId, categoryId]);

  const filtered = useMemo(() => {
    let list = models;
    if (isEditing && currentModelId) {
      const current = models.find((m) => m.id === currentModelId);
      const rest = models.filter((m) => m.id !== currentModelId);
      list = current ? [current, ...rest] : models;
    }
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((m) => (m.name || '').toLowerCase().includes(needle));
  }, [models, q, isEditing, currentModelId]);

  const onPick = (m) => {
    // Spread route.params so booking-flow extras (editMode, editTicketId,
    // prefill*, customer, etc.) flow through to DeviceColorStorage and beyond.
    const baseParams = {
      ...(route?.params || {}),
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId, brandName, seriesId, seriesName, modelId: m.id, modelName: m.name,
      modelImageUrl: resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) || undefined,
      editSellOrderId, editHints,
      // Pre-seed the variant page with the order's existing color/RAM/storage/IMEI,
      // but only when the customer kept the same model. Picking a different
      // model means the old variant codes won't apply.
      ...(editSellOrderId && editHints?.modelId === m.id ? {
        ramOptionId: editHints.ramOptionId,
        storageOptionId: editHints.storageOptionId,
        color: editHints.color,
        imei: editHints.imei,
      } : {}),
    };
    // Booking flow: feed the picked model into the booking wizard's
    // DeviceColorStorage step. Forwards the same params shape the
    // booking-flow version used so the rest of the wizard works unchanged.
    if (flow === 'BOOKING') {
      navigation.navigate('DeviceColorStorage', {
        ...baseParams,
        imageUrl: baseParams.modelImageUrl,
      });
      return;
    }
    // Owner marketplace listing: insert a category/spare-parts choice between
    // model selection and the variant (colour/storage) step.
    if (flow === 'OWNER_LIST') {
      navigation.navigate('OwnerSellChooseSalesCategory', baseParams);
      return;
    }
    navigation.navigate('SelectVariant', baseParams);
  };

  const crumbs = [{ label: 'Brand', value: brandName }];
  if (seriesName) crumbs.push({ label: 'Series', value: seriesName });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Select Model"
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
        <SearchBar value={q} onChangeText={setQ} placeholder="Search model" onClear={() => setQ('')} />
      </View>

      {loading ? (
        <Loader label="Loading models..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Smartphone size={28} color="#16A34A" />}
              title="No models found"
              description={q ? 'Try a different keyword.' : 'No models published for this selection yet.'}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {filtered.map((m) => {
                const thumb = resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 });
                const sub = m.subtitle || m.seriesName || m.slug;
                const isCurrent = isEditing && m.id === currentModelId;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => onPick(m)}
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
                      className="rounded-xl items-center justify-center overflow-hidden bg-primary/10"
                      style={{ height: logoBox, width: logoBox, marginBottom: 8 }}
                    >
                      {thumb ? (
                        <Image
                          source={{ uri: thumb }}
                          style={{ width: logoBox, height: logoBox }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Smartphone size={Math.round(logoBox * 0.4)} color="#16A34A" />
                      )}
                    </View>
                    <Text
                      className="text-[12.5px] font-extrabold text-text"
                      numberOfLines={1}
                      style={{ textAlign: 'center', width: '100%' }}
                    >
                      {m.name}
                    </Text>
                    {isCurrent ? (
                      <View className="flex-row items-center bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 mt-1.5">
                        <Check size={10} color="#16A34A" />
                        <Text className="text-[9.5px] font-extrabold text-primary ml-1">Current</Text>
                      </View>
                    ) : sub ? (
                      <Text
                        className="text-[10px] text-text-muted text-center mt-0.5"
                        numberOfLines={1}
                        style={{ width: '100%' }}
                      >
                        {sub}
                      </Text>
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
