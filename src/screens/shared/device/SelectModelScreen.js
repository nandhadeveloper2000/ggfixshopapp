import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Smartphone, Check, Pencil, X, Search, ArrowLeft } from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader } from '../../../components/rnr';
import DeviceImage from '../../../components/DeviceImage';
import { getModelsByBrand, getSeriesForCategoryBrand } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical "Select Product" picker used by all flows. Series chips at the top
// FILTER the full model grid below (Cashify-style). Search is a header icon that
// opens a full-screen results list (no persistent search box). Routes to
// DeviceColorStorage (booking) / OwnerSellChooseSalesCategory (owner-list) /
// SelectVariant (profile/repair).
const HORIZONTAL_PAD = 16;
const GRID_GAP = 12;
function gridMetrics(screenWidth) {
  const numColumns = screenWidth >= 600 ? 4 : 3;
  const cardWidth = Math.floor((screenWidth - HORIZONTAL_PAD * 2 - GRID_GAP * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth };
}

export default function SelectModelScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId, brandName, seriesName: routeSeriesName, editSellOrderId, editHints,
  } = route?.params || {};
  const bookingEditMode = !!route?.params?.editMode;
  const isEditing = !!editSellOrderId || bookingEditMode;
  const currentModelId = editHints?.modelId
    || (bookingEditMode ? route?.params?.modelId : null)
    || null;

  const insets = useSafeAreaInsets();
  const [models, setModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selSeriesId, setSelSeriesId] = useState(
    route?.params?.seriesId || editHints?.seriesId || null,
  );

  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth } = gridMetrics(screenWidth);
  const imgBox = Math.round(cardWidth * 0.66);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [modelList, seriesList] = await Promise.all([
          getModelsByBrand(brandId),
          getSeriesForCategoryBrand(categoryId, brandId).catch(() => []),
        ]);
        if (cancelled) return;
        let ms = modelList || [];
        if (UUID_RE.test(String(categoryId || ''))) {
          ms = ms.filter((m) => !m.categoryId || m.categoryId === categoryId);
        }
        setModels(ms);
        setSeries(seriesList || []);
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId, categoryId]);

  const seriesWithModels = useMemo(() => {
    const ids = new Set(models.map((m) => m.seriesId).filter(Boolean));
    return (series || []).filter((s) => ids.has(s.id));
  }, [series, models]);

  const selectedSeries = seriesWithModels.find((s) => s.id === selSeriesId) || null;

  // Grid (chips-filtered) vs search (spans all models).
  const gridModels = useMemo(() => {
    let list = selSeriesId ? models.filter((m) => m.seriesId === selSeriesId) : models;
    if (isEditing && currentModelId) {
      const cur = list.find((m) => m.id === currentModelId);
      if (cur) list = [cur, ...list.filter((m) => m.id !== currentModelId)];
    }
    return list;
  }, [models, selSeriesId, isEditing, currentModelId]);

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((m) => (m.name || '').toLowerCase().includes(needle));
  }, [models, q]);

  const onPick = (m) => {
    const pickedSeries = (series || []).find((s) => s.id === m.seriesId);
    const baseParams = {
      ...(route?.params || {}),
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId, brandName,
      seriesId: m.seriesId || selSeriesId || undefined,
      seriesName: pickedSeries?.name || routeSeriesName || undefined,
      modelId: m.id, modelName: m.name,
      modelImageUrl: resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) || undefined,
      editSellOrderId, editHints,
      ...(editSellOrderId && editHints?.modelId === m.id ? {
        ramOptionId: editHints.ramOptionId,
        storageOptionId: editHints.storageOptionId,
        color: editHints.color,
        imei: editHints.imei,
      } : {}),
    };
    if (flow === 'BOOKING') {
      navigation.navigate('DeviceColorStorage', { ...baseParams, imageUrl: baseParams.modelImageUrl });
      return;
    }
    if (flow === 'OWNER_LIST') {
      navigation.navigate('OwnerSellChooseSalesCategory', baseParams);
      return;
    }
    navigation.navigate('SelectVariant', baseParams);
  };

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
              placeholder={`Search ${brandName || 'model'}`}
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
            <EmptyState
              icon={<Smartphone size={28} color="#16A34A" />}
              title="No products found"
              description={q ? `Nothing matches "${q.trim()}".` : 'Start typing to search.'}
            />
          ) : (
            searchResults.map((m) => {
              const hasImg = !!(m.imageUrl || m.imageBase64);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onPick(m)}
                  className="flex-row items-center px-4 py-2.5 border-b border-border active:bg-primary/5"
                >
                  <View className="h-10 w-10 rounded-lg overflow-hidden items-center justify-center mr-3" style={{ backgroundColor: '#F1F5F9' }}>
                    {hasImg ? (
                      <DeviceImage url={m.imageUrl} base64={m.imageBase64} style={{ width: 40, height: 40 }} contentFit="contain" />
                    ) : (
                      <Smartphone size={18} color="#16A34A" />
                    )}
                  </View>
                  <Text className="flex-1 text-[14px] text-text" numberOfLines={1}>{m.name}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Normal mode: series chips + model grid ────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Select Product"
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
        <Loader label="Loading products..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingTop: 14, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Series chips (compact) ────────────────────────────────── */}
          {seriesWithModels.length > 0 ? (
            <View className="mb-5">
              <Text className="text-[15px] font-extrabold text-text mb-2.5">Select Series</Text>
              {selectedSeries ? (
                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    onPress={() => setSelSeriesId(null)}
                    className="rounded-xl flex-row items-center active:opacity-80"
                    style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#EEF2F6', borderWidth: 1, borderColor: '#E2E8F0' }}
                  >
                    <Text className="text-[12.5px] font-bold text-text mr-2" numberOfLines={1}>
                      {selectedSeries.name}
                    </Text>
                    <X size={15} color="#64748B" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                  {seriesWithModels.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelSeriesId(s.id)}
                      className="rounded-xl items-center justify-center active:opacity-80"
                      style={{ width: cardWidth, minHeight: 40, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#EEF2F6', borderWidth: 1, borderColor: '#E2E8F0' }}
                    >
                      <Text className="text-[12px] font-semibold text-text text-center" numberOfLines={2}>
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── Models grid ───────────────────────────────────────────── */}
          {gridModels.length === 0 ? (
            <EmptyState
              icon={<Smartphone size={28} color="#16A34A" />}
              title="No products found"
              description="No models published for this selection yet."
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {gridModels.map((m) => {
                const isCurrent = isEditing && m.id === currentModelId;
                const hasImg = !!(m.imageUrl || m.imageBase64);
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
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{ height: imgBox, width: imgBox, marginBottom: 8, backgroundColor: '#F1F5F9' }}
                    >
                      {hasImg ? (
                        <DeviceImage
                          url={m.imageUrl}
                          base64={m.imageBase64}
                          style={{ width: imgBox - 6, height: imgBox - 6 }}
                          contentFit="contain"
                        />
                      ) : (
                        <Smartphone size={Math.round(imgBox * 0.4)} color="#16A34A" />
                      )}
                    </View>
                    <Text
                      className="text-[11px] font-extrabold text-text"
                      numberOfLines={2}
                      style={{ textAlign: 'center', width: '100%' }}
                    >
                      {m.name}
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
