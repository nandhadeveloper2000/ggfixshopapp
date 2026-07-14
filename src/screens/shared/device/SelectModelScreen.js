import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Smartphone, Check, Pencil, X, Search, ArrowLeft, Maximize2, Plus, Minus } from 'lucide-react-native';
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

// Gallery-style image viewer: pinch-to-zoom + double-tap + drag, focused on the
// touch point (like the native Android/iOS Gallery). Pure RN Animated +
// PanResponder — no reanimated/worklets, so it runs in any build. zoomIn/zoomOut
// are exposed via ref for the toolbar buttons.
const ZoomableImage = forwardRef(function ZoomableImage({ url, base64, size }, ref) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const st = useRef({ scale: 1, tx: 0, ty: 0, W: size, H: size, originX: 0, originY: 0, last: null, tap: 0, quick: null, pinch: null }).current;
  const viewRef = useRef(null);
  const MIN = 1, MAX = 5;

  // Keep the (scaled) image from panning past its own edges.
  const clamp = (s, x, y) => {
    const m = Math.max(0, (size * s - size) / 2);
    return { x: Math.max(-m, Math.min(m, x)), y: Math.max(-m, Math.min(m, y)) };
  };
  const commit = (s, x, y, animate) => {
    st.scale = s; st.tx = x; st.ty = y;
    if (animate) {
      Animated.parallel([
        Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 7, tension: 70 }),
        Animated.spring(tx, { toValue: x, useNativeDriver: true, friction: 7, tension: 70 }),
        Animated.spring(ty, { toValue: y, useNativeDriver: true, friction: 7, tension: 70 }),
      ]).start();
    } else {
      scale.setValue(s); tx.setValue(x); ty.setValue(y);
    }
  };
  // Scale toward `target`, keeping focal point (fx,fy relative to view center) fixed.
  // t1 = f - (s1/s0)*(f - t0) keeps the pixel under the finger anchored.
  const zoomToPoint = (target, fx, fy, animate) => {
    const s1 = Math.max(MIN, Math.min(MAX, target));
    if (s1 <= MIN) { commit(MIN, 0, 0, animate); return; }
    const s0 = st.scale || 1;
    const c = clamp(s1, fx - (s1 / s0) * (fx - st.tx), fy - (s1 / s0) * (fy - st.ty));
    commit(s1, c.x, c.y, animate);
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomToPoint(st.scale + 0.6, 0, 0, true),
    zoomOut: () => zoomToPoint(st.scale - 0.6, 0, 0, true),
  }));

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length === 2 || !!st.quick || st.scale > 1 || Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 1) {
          const now = Date.now();
          const t = touches[0];
          const fx = t.locationX - st.W / 2;
          const fy = t.locationY - st.H / 2;
          if (now - st.tap < 300) {
            // Second tap → arm one-finger zoom. If the finger now drags it becomes a
            // drag-to-zoom (Google Photos style); a clean release = double-tap toggle.
            st.quick = { scale: st.scale, tx: st.tx, ty: st.ty, fx, fy, startY: t.pageY, moved: false };
            st.tap = 0;
          } else {
            st.tap = now; st.quick = null;
          }
        }
        st.pinch = null; st.last = null;
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        // One-finger zoom: after a double-tap, drag up = zoom in, drag down = zoom out.
        if (st.quick && touches.length === 1) {
          const t = touches[0];
          const dy = st.quick.startY - t.pageY;
          if (Math.abs(dy) > 4) st.quick.moved = true;
          const s0 = st.quick.scale || 1;
          const s1 = Math.max(MIN, Math.min(MAX, s0 * Math.pow(2, dy / 300)));
          const fx = st.quick.fx, fy = st.quick.fy;
          const c = clamp(s1, fx - (s1 / s0) * (fx - st.quick.tx), fy - (s1 / s0) * (fy - st.quick.ty));
          st.scale = s1; st.tx = c.x; st.ty = c.y;
          scale.setValue(s1); tx.setValue(c.x); ty.setValue(c.y);
          return;
        }
        // Two-finger pinch. Anchored to the gesture START (fixed focal + base scale) so it
        // tracks the fingers smoothly instead of drifting frame-to-frame. Uses pageX/pageY
        // (reliable for multitouch) — locationX is unreliable for the 2nd finger on Android.
        if (touches.length === 2) {
          st.quick = null; st.last = null;
          const [a, b] = touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
          const midX = (a.pageX + b.pageX) / 2;
          const midY = (a.pageY + b.pageY) / 2;
          if (!st.pinch) {
            st.pinch = {
              startDist: dist,
              baseScale: st.scale,
              baseTx: st.tx,
              baseTy: st.ty,
              fx: midX - st.originX - st.W / 2,
              fy: midY - st.originY - st.H / 2,
              startMidX: midX,
              startMidY: midY,
            };
            return;
          }
          const p = st.pinch;
          const s1 = Math.max(MIN, Math.min(MAX, p.baseScale * (dist / p.startDist)));
          // hold the focal point fixed while scaling, then let the two fingers pan too
          const nx = p.fx - (s1 / p.baseScale) * (p.fx - p.baseTx) + (midX - p.startMidX);
          const ny = p.fy - (s1 / p.baseScale) * (p.fy - p.baseTy) + (midY - p.startMidY);
          const c = clamp(s1, nx, ny);
          st.scale = s1; st.tx = c.x; st.ty = c.y;
          scale.setValue(s1); tx.setValue(c.x); ty.setValue(c.y);
          return;
        }
        // One-finger pan while zoomed in.
        if (touches.length === 1 && st.scale > 1) {
          st.pinch = null;
          const t = touches[0];
          if (st.last) {
            const c = clamp(st.scale, st.tx + (t.pageX - st.last.x), st.ty + (t.pageY - st.last.y));
            st.tx = c.x; st.ty = c.y; tx.setValue(c.x); ty.setValue(c.y);
          }
          st.last = { x: t.pageX, y: t.pageY };
        }
      },
      onPanResponderRelease: () => {
        if (st.quick) {
          if (!st.quick.moved) zoomToPoint(st.scale > 1 ? 1 : 2, st.quick.fx, st.quick.fy, true);
          else if (st.scale <= MIN + 0.02) commit(MIN, 0, 0, true);
          st.quick = null;
        } else if (st.scale <= MIN + 0.02) {
          commit(MIN, 0, 0, true);
        }
        st.pinch = null; st.last = null;
      },
      onPanResponderTerminate: () => { st.quick = null; st.pinch = null; st.last = null; },
    }),
  ).current;

  return (
    <View
      ref={viewRef}
      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      onLayout={(e) => {
        st.W = e.nativeEvent.layout.width;
        st.H = e.nativeEvent.layout.height;
        // window-relative origin so pinch focal (from touch pageX/pageY) is accurate
        viewRef.current?.measureInWindow?.((x, y, w, h) => { st.originX = x; st.originY = y; if (w) st.W = w; if (h) st.H = h; });
      }}
      {...responder.panHandlers}
    >
      <Animated.View style={{ transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
        <DeviceImage url={url} base64={base64} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
});

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
  const [preview, setPreview] = useState(null); // model whose image is shown full-screen
  const zoomRef = useRef(null); // drives the preview's ＋ / − zoom buttons
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
                    <Pressable
                      onPress={() => setPreview(m)}
                      disabled={!hasImg}
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{ height: imgBox, width: imgBox, marginBottom: 8, backgroundColor: '#F1F5F9' }}
                    >
                      {hasImg ? (
                        <>
                          <DeviceImage
                            url={m.imageUrl}
                            base64={m.imageBase64}
                            style={{ width: imgBox - 6, height: imgBox - 6 }}
                            contentFit="contain"
                          />
                          <View style={{ position: 'absolute', top: 4, right: 4, height: 20, width: 20, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                            <Maximize2 size={11} color="#FFFFFF" />
                          </View>
                        </>
                      ) : (
                        <Smartphone size={Math.round(imgBox * 0.4)} color="#16A34A" />
                      )}
                    </Pressable>
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

      {/* Full-screen original image preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.94)' }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text className="text-white/60 text-[11px] font-semibold">Pinch · double-tap · double-tap+drag · ＋ / −</Text>
              <Pressable
                onPress={() => setPreview(null)}
                hitSlop={12}
                style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {preview && (preview.imageUrl || preview.imageBase64) ? (
                <ZoomableImage ref={zoomRef} key={preview.id} url={preview.imageUrl} base64={preview.imageBase64} size={screenWidth - 40} />
              ) : (
                <Smartphone size={140} color="#FFFFFF" />
              )}
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
              {/* Zoom toolbar — kept outside the gesture surface so taps never fight the pan/pinch responder */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Pressable
                  onPress={() => zoomRef.current?.zoomOut()}
                  hitSlop={8}
                  style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16 }}
                >
                  <Minus size={24} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => zoomRef.current?.zoomIn()}
                  hitSlop={8}
                  style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16 }}
                >
                  <Plus size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text className="text-white text-[15px] font-extrabold mb-3 text-center" numberOfLines={2}>
                {preview?.name}
              </Text>
              <Pressable
                onPress={() => { const m = preview; setPreview(null); if (m) onPick(m); }}
                className="rounded-2xl py-4 items-center active:opacity-80"
                style={{ backgroundColor: '#16A34A' }}
              >
                <Text className="text-white text-[15px] font-extrabold">Select this product</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
