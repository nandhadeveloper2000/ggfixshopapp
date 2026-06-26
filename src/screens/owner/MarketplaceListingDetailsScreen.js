import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/rnr';
import { notify } from '../../components/confirm';
import { marketplaceApi } from '../../api/client';
import { getModelsByBrand } from '../../api/masterData';

function statusMeta(rawStatus) {
  const s = String(rawStatus || '').toUpperCase();
  if (s === 'SOLD' || s === 'COMPLETED') return { label: 'Selling Completed', icon: 'checkmark', bg: '#10B981', borderClass: 'border-success/30' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'Cancelled', icon: 'close', bg: '#EF4444', borderClass: 'border-danger/30' };
  return { label: 'Selling — Pending', icon: 'time-outline', bg: '#F59E0B', borderClass: 'border-warning/30' };
}

const PHOTO_LABELS = ['Front Side', 'Backside', 'side and Center', 'Camera', 'side and Center'];

function Check() {
  return <Ionicons name="checkmark-circle-outline" size={15} color="#16A34A" style={{ marginTop: 1 }} />;
}

function Row({ label, value }) {
  return (
    <View className="flex-row mt-1">
      <Text className="text-text text-[12px] flex-1">
        <Text className="font-bold">{label}: </Text>
        {value || '-'}
      </Text>
    </View>
  );
}

export default function MarketplaceListingDetailsScreen({ navigation, route }) {
  const productId = route?.params?.productId || route?.params?.id;
  const [item, setItem] = useState(route?.params?.listing || null);
  const [loading, setLoading] = useState(!route?.params?.listing);
  const [acting, setActing] = useState(false);

  const updateStatus = async (newStatus, prettyLabel) => {
    if (!productId) return;
    setActing(true);
    try {
      const res = await marketplaceApi.put(`/marketplace/products/${productId}`, { body: { status: newStatus } });
      setItem(res);
      notify('Updated', `Listing marked as ${prettyLabel}.`);
    } catch (e) {
      notify('Action failed', e?.message || 'Could not update the listing');
    } finally {
      setActing(false);
    }
  };

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await marketplaceApi.get(`/marketplace/products/${productId}`);
        if (cancelled) return;
        // For non-spare-parts listings, prefer the model's catalog image as the
        // primary thumbnail (rescues older listings that stored a condition
        // photo as imageUrl).
        if (data && data.descriptionType !== 'SPARE_PARTS' && data.brandId && data.modelId) {
          try {
            const models = await getModelsByBrand(data.brandId);
            const model = (models || []).find((m) => m.id === data.modelId);
            const modelUrl = model?.imageUrl || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null);
            if (modelUrl) data.imageUrl = modelUrl;
          } catch (_) {}
        }
        setItem(data);
      } catch (_) {
        // keep whatever route param we received
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Sell Device Details" onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#00008B" /></View>
      </View>
    );
  }
  if (!item) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Sell Device Details" onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-muted">Could not load this listing.</Text>
        </View>
      </View>
    );
  }

  let assessment = {};
  try { assessment = item.assessmentJson ? JSON.parse(item.assessmentJson) : {}; } catch (_) {}
  // Device Photo's = the user's uploaded condition photos (Front, Back, …).
  // imageUrl is the model's catalog image used for the card thumbnail, so we
  // exclude it from the gallery. Older listings without extraImageUrls fall
  // back to imageUrl as a single-entry gallery.
  const extras = (item.extraImageUrls || []).filter(Boolean);
  const allPhotos = extras.length > 0 ? extras : (item.imageUrl ? [item.imageUrl] : []);
  const orderId = item.id ? `GGFIX${String(item.id).slice(0, 12).toUpperCase().replace(/-/g, '')}` : '';
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const dateLabel = created ? created.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const conditionText = item.workingCondition === 'DEAD' ? 'Dead / Unknown' : (item.conditionLabel || 'Good');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Sell Device Details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
        {/* Status banner */}
        {(() => {
          const meta = statusMeta(item.status);
          return (
            <View className={`bg-card border ${meta.borderClass} rounded-2xl p-3 mb-3 flex-row items-center`}>
              <View className="w-7 h-7 rounded-full items-center justify-center mr-2.5" style={{ backgroundColor: meta.bg }}>
                <Ionicons name={meta.icon} size={16} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-text font-extrabold text-[14px]">{meta.label}</Text>
                <Text className="text-text-muted text-[10px] mt-0.5">{dateLabel} · {orderId}</Text>
              </View>
              {item.price != null ? (
                <Text className="text-primary font-extrabold text-[15px]">₹{Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              ) : null}
            </View>
          );
        })()}

        {/* Device card */}
        <View className="bg-card border border-border rounded-2xl p-3 mb-3">
          <View className="flex-row items-center">
            <View className="w-[88px] h-[100px] bg-background rounded-md overflow-hidden items-center justify-center">
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: 88, height: 100 }} resizeMode="cover" />
              ) : (
                <Ionicons name="phone-portrait-outline" size={28} color="#94A3B8" />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-text font-extrabold text-[15px]" numberOfLines={2}>{item.title || 'Device'}</Text>
              {item.color ? <Row label="Color" value={item.color} /> : null}
              {(item.ramLabel || item.storageLabel) ? (
                <Row label="Storage" value={[item.ramLabel, item.storageLabel].filter(Boolean).join(' / ')} />
              ) : null}
              <Row label="Device Condition" value={conditionText} />
              {item.imei ? <Row label="IMEI Number" value={item.imei} /> : null}
            </View>
          </View>

          {allPhotos.length > 0 ? (
            <>
              <Text className="text-text font-bold text-[12px] mt-3 mb-2">Device Photo's</Text>
              <View className="flex-row flex-wrap -mx-1">
                {allPhotos.map((url, i) => (
                  <View key={i} className="px-1 mb-2" style={{ width: '33.333%' }}>
                    <View className="rounded-md border border-dashed border-primary/40 overflow-hidden" style={{ height: 76 }}>
                      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <Text className="text-text-muted text-[10px] mt-0.5 text-center" numberOfLines={1}>
                      {PHOTO_LABELS[i] || `Photo ${i + 1}`}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* Device Summary */}
        {(assessment.screeningAnswers?.length || assessment.conditions?.length || assessment.accessories?.length || assessment.warrantyLabel) ? (
          <View className="bg-card border border-secondary/40 rounded-2xl p-3 mb-3">
            <Text className="text-secondary font-extrabold text-[14px] mb-2">Device Summary</Text>

            {assessment.screeningAnswers?.length ? (
              <>
                <Text className="text-text font-bold text-[12px] mt-2 mb-1">Screening Question</Text>
                {assessment.screeningAnswers.map((a, i) => (
                  <View key={i} className="flex-row items-start mt-1">
                    <Check />
                    <Text className="text-text text-[12px] ml-1.5 flex-1">
                      {[a.answer, a.question].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {assessment.conditions?.length ? (
              <>
                <Text className="text-text font-bold text-[12px] mt-2 mb-1">Screen</Text>
                {assessment.conditions.map((c, i) => (
                  <View key={i} className="flex-row items-start mt-1">
                    <Check />
                    <Text className="text-text text-[12px] ml-1.5 flex-1">
                      {[c.optionLabel, c.groupName].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {assessment.accessories?.length ? (
              <>
                <Text className="text-text font-bold text-[12px] mt-2 mb-1">Accessories</Text>
                {assessment.accessories.map((a, i) => (
                  <View key={i} className="flex-row items-start mt-1">
                    <Check />
                    <Text className="text-text text-[12px] ml-1.5 flex-1">{a.label || a.accessoryCode}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {assessment.warrantyLabel ? (
              <>
                <Text className="text-text font-bold text-[12px] mt-2 mb-1">Warranty</Text>
                <View className="flex-row items-start mt-1">
                  <Check />
                  <Text className="text-text text-[12px] ml-1.5 flex-1">{assessment.warrantyLabel}</Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Description type pill */}
        {item.descriptionType ? (
          <View className="bg-card border border-border rounded-2xl p-3">
            <Text className="text-text-muted text-[10px] uppercase tracking-widest font-extrabold">Description Type</Text>
            <Text className="text-text text-[13px] font-bold mt-1">
              {item.descriptionType === 'DETAILED' ? 'Detailed Description'
                : item.descriptionType === 'SHORT' ? 'Short Description'
                : item.descriptionType === 'DEAD_SHORT' ? 'Dead Phone Short Description'
                : item.descriptionType === 'SPARE_PARTS' ? 'Spare Parts Listing'
                : item.descriptionType}
            </Text>
          </View>
        ) : null}

        {/* Sale outcome banner once it's a terminal state. */}
        {(() => {
          const s = String(item.status || '').toUpperCase();
          if (s === 'SOLD' || s === 'COMPLETED') {
            return (
              <View className="bg-success/10 border border-success/30 rounded-2xl p-3 mt-3 items-center">
                <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                <Text className="text-success text-[14px] font-extrabold mt-1">Selling Completed</Text>
              </View>
            );
          }
          if (s === 'CANCELLED' || s === 'CANCELED') {
            return (
              <View className="bg-danger/10 border border-danger/30 rounded-2xl p-3 mt-3 items-center">
                <Ionicons name="close-circle" size={28} color="#EF4444" />
                <Text className="text-danger text-[14px] font-extrabold mt-1">Listing Cancelled</Text>
              </View>
            );
          }
          return null;
        })()}
      </ScrollView>

      {/* Action buttons — only while the listing is still live. */}
      {(() => {
        const s = String(item.status || '').toUpperCase();
        const isLive = s !== 'SOLD' && s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'CANCELED';
        if (!isLive) return null;
        return (
          <View className="absolute left-0 right-0 bottom-0 px-3 py-3 bg-card border-t border-border flex-row" style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
            <Pressable
              onPress={() => updateStatus('CANCELLED', 'Cancelled')}
              disabled={acting}
              className="flex-1 mr-2 rounded-xl bg-danger/10 border border-danger/40 py-3 items-center justify-center active:opacity-80"
            >
              {acting ? <ActivityIndicator color="#EF4444" /> : (
                <View className="flex-row items-center">
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text className="text-danger font-extrabold text-[13px] ml-1.5">Selling Cancel</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => updateStatus('SOLD', 'Completed')}
              disabled={acting}
              className="flex-1 rounded-xl bg-success py-3 items-center justify-center active:opacity-80"
            >
              {acting ? <ActivityIndicator color="#fff" /> : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text className="text-white font-extrabold text-[13px] ml-1.5">Selling Completed</Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      })()}
    </View>
  );
}
