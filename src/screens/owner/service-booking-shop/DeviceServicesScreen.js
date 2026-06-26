import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wrench,
  BatteryMedium,
  Cpu,
  Zap,
  Volume2,
  Aperture,
  LayoutGrid,
  Smartphone,
  Droplets,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Star,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRepairServices, getRepairCategories } from '../../../api/masterData';

// Swiggy / Zomato-inspired palette — green theme. Vibrant green hero gradient,
// deeper green for the floating cart bar shadow + bill total emphasis. ADD
// button uses a slightly different green shade so it stays distinct.
const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const WARRANTY_OPTIONS = [
  { code: 'W_3M', label: '3 Months' },
  { code: 'W_6M', label: '6 Months' },
  { code: 'W_12M', label: '12 Months' },
];

const priceNum = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;

const formatINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function DeviceServicesScreen({ navigation, route }) {
  const params = route?.params || {};
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState([]);
  const [mainCats, setMainCats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Per-service input state, regardless of picked status — so the price the user
  // typed is what +Add commits, and persists if they Remove and re-Add.
  // When entering from "Edit Booking", prefillServices seeds the rows + picks so
  // existing line items show as already added with their saved price/warranty.
  const seedFromPrefill = () => {
    const prefill = Array.isArray(params.prefillServices) ? params.prefillServices : [];
    const rowSeed = {};
    const idSeed = new Set();
    for (const s of prefill) {
      if (!s?.serviceId) continue;
      rowSeed[s.serviceId] = { price: String(s.price ?? ''), warranty: s.warranty || '' };
      idSeed.add(s.serviceId);
    }
    return { rowSeed, idSeed };
  };
  const seed = useMemo(seedFromPrefill, []);
  const [rows, setRows] = useState(seed.rowSeed); // { [serviceId]: { price, warranty } }
  const [pickedIds, setPickedIds] = useState(() => new Set(seed.idSeed));
  const [expanded, setExpanded] = useState({}); // { [groupId]: bool }

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([
          getRepairServices().catch(() => []),
          getRepairCategories().catch(() => []),
        ]);
        setServices(s);
        setMainCats(c);
      } catch (_) { }
      setLoading(false);
    })();
  }, []);

  // Group services by main category (categoryId on the service points to repair-category).
  const groups = useMemo(() => {
    const catById = {};
    (mainCats || []).forEach((c) => { catById[c.id] = c; });
    const byCat = new Map();
    (services || []).forEach((s) => {
      const key = s.categoryId || '__ungrouped__';
      if (!byCat.has(key)) byCat.set(key, { id: key, name: catById[key]?.name || 'Other', services: [] });
      byCat.get(key).services.push(s);
    });
    return Array.from(byCat.values());
  }, [services, mainCats]);

  // When entering from Edit Booking, auto-expand the groups that already have
  // prefilled picks so the user can see/modify them without hunting for them.
  useEffect(() => {
    if (pickedIds.size === 0 || groups.length === 0) return;
    setExpanded((prev) => {
      const next = { ...prev };
      let touched = false;
      for (const g of groups) {
        if (next[g.id]) continue;
        if (g.services.some((s) => pickedIds.has(s.id))) { next[g.id] = true; touched = true; }
      }
      return touched ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Default-open the first group when nothing has been picked yet so the user
  // immediately sees the menu without an extra tap (matches Swiggy's "first
  // section auto-open" UX).
  useEffect(() => {
    if (loading || pickedIds.size > 0 || groups.length === 0) return;
    setExpanded((prev) => (prev[groups[0].id] ? prev : { ...prev, [groups[0].id]: true }));
  }, [loading, groups, pickedIds.size]);

  const ensureRow = (id) => rows[id] || { price: '', warranty: '' };
  const setField = (id, key, value) => {
    setRows((p) => {
      const existing = p[id] || { price: '', warranty: '' };
      return { ...p, [id]: { ...existing, [key]: value } };
    });
  };

  const addService = (s) => {
    if (!(priceNum(ensureRow(s.id).price) > 0)) return;
    setPickedIds((p) => { const n = new Set(p); n.add(s.id); return n; });
  };
  const removeService = (s) => {
    setPickedIds((p) => { const n = new Set(p); n.delete(s.id); return n; });
  };

  const toggleGroup = (gid) => setExpanded((e) => ({ ...e, [gid]: !e[gid] }));

  // Running total — drives the floating cart bar at the bottom.
  const cartTotal = useMemo(() => {
    let sum = 0;
    for (const id of pickedIds) {
      const r = ensureRow(id);
      sum += priceNum(r.price);
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedIds, rows]);

  const onContinue = () => {
    const byId = {}; (services || []).forEach((s) => { byId[s.id] = s; });
    const selected = [...pickedIds].map((id) => {
      const s = byId[id]; const r = ensureRow(id);
      return {
        serviceId: id,
        serviceCode: s?.code,
        serviceName: s?.name,
        price: priceNum(r.price),
        warranty: r.warranty || null,
      };
    });
    if (selected.length === 0) return;
    navigation.navigate('ServicePriceEstimate', { ...params, services: selected });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16 }}
        >
          <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 rounded-full bg-white/20 items-center justify-center">
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
        </LinearGradient>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={BRAND_GREEN} size="large" />
        </View>
      </View>
    );
  }

  const totalSelected = pickedIds.size;

  return (
    <View className="flex-1 bg-background">
      {/* ── Hero gradient header — Swiggy "section banner" pattern ─────────── */}
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 16 }}
      >
        <View className="relative flex-row items-center justify-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="absolute left-0 h-10 w-10 rounded-full bg-white/20 items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>

          <View className="items-center px-12">
            <Text className="text-white/80 text-[11px] font-bold tracking-widest text-center">
              REPAIR MENU
            </Text>

            <Text
              className="text-white text-[19px] font-extrabold mt-0.5 text-center"
              numberOfLines={1}
            >
              Add Issue Services
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Device "restaurant card" — overlaps the gradient, Zomato-style ── */}
        <View className="px-4" style={{ marginTop: 14 }}>
          <View
            className="bg-card rounded-2xl p-3.5"
            style={{
              shadowColor: '#0F172A',
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center overflow-hidden mr-3">
                {params.imageUrl ? (
                  <Image source={{ uri: params.imageUrl }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                ) : (
                  <Smartphone size={28} color="#00008B" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-text" numberOfLines={1}>
                  {params.modelName || 'Device'}
                </Text>
                <Text className="text-[11.5px] text-text-muted mt-0.5" numberOfLines={1}>
                  {[params.ramLabel, params.storageLabel, params.color].filter(Boolean).join(' · ')}
                </Text>
                <View className="flex-row items-center mt-1.5">
                  <View className="flex-row items-center bg-success/10 rounded-md px-1.5 py-0.5 mr-1.5">
                    <Star size={10} color={ACCENT_GREEN} fill={ACCENT_GREEN} />
                    <Text className="text-success text-[10px] font-extrabold ml-0.5">4.8</Text>
                  </View>
                  <View className="flex-row items-center">
                    <ShieldCheck size={11} color="#64748B" />
                    <Text className="text-text-muted text-[10.5px] font-semibold ml-1">Genuine parts</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Section header — like Swiggy's "Recommended" rail ──────────── */}
        <View className="px-4 pt-5 pb-2 flex-row items-center">
          <Sparkles size={14} color={BRAND_GREEN} />
          <Text className="text-text font-extrabold text-[13px] tracking-widest ml-1.5">RECOMMENDED REPAIRS</Text>
          <View className="flex-1 h-px bg-border ml-2" />
        </View>

        {/* ── Categories: accordion list (Swiggy menu-section style) ─────── */}
        <View className="px-4">
          {groups.map((g) => {
            const open = !!expanded[g.id];
            const pickedInGroup = g.services.filter((s) => pickedIds.has(s.id)).length;
            const Chevron = open ? ChevronUp : ChevronDown;
            return (
              <View
                key={g.id}
                className="mb-3 bg-card rounded-2xl overflow-hidden"
                style={{
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <Pressable
                  onPress={() => toggleGroup(g.id)}
                  className="flex-row items-center px-3.5 py-3.5 active:opacity-80"
                >
                  <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}>
                    <Wrench size={17} color={BRAND_GREEN} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-extrabold text-text" numberOfLines={1}>{g.name}</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-[10.5px] text-text-muted">
                        {g.services.length} {g.services.length === 1 ? 'option' : 'options'}
                      </Text>
                      {pickedInGroup ? (
                        <>
                          <View className="h-1 w-1 rounded-full bg-text-muted mx-1.5" />
                          <Text className="text-success text-[10.5px] font-extrabold">
                            {pickedInGroup} added
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Chevron size={18} color="#64748B" />
                </Pressable>

                {open ? (
                  <View className="px-3.5 pb-3.5 pt-1">
                    {g.services.map((s) => {
                      const r = ensureRow(s.id);
                      const isPicked = pickedIds.has(s.id);
                      const Icon = iconFor(s.code);
                      const canAdd = priceNum(r.price) > 0;
                      return (
                        <ServiceItem
                          key={s.id}
                          name={s.name}
                          Icon={Icon}
                          isPicked={isPicked}
                          canAdd={canAdd}
                          price={r.price}
                          onPriceChange={(v) => setField(s.id, 'price', v)}
                          warranty={r.warranty}
                          onWarrantyChange={(c) => setField(s.id, 'warranty', c)}
                          onAdd={() => addService(s)}
                          onRemove={() => removeService(s)}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Floating "View Cart" style sticky CTA ─────────────────────── */}
      {totalSelected > 0 ? (
        <View
          className="absolute left-0 right-0"
          style={{ bottom: insets.bottom + 4, paddingHorizontal: 16 }}
        >
          <Pressable
            onPress={onContinue}
            className="active:opacity-90"
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              shadowColor: BRAND_GREEN_DARK,
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <LinearGradient
              colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
            >
              <View className="bg-white/20 rounded-full h-9 px-2.5 items-center justify-center flex-row mr-3">
                <Text className="text-white text-[13px] font-extrabold">{totalSelected}</Text>
                <Text className="text-white text-[10.5px] font-bold ml-1">item{totalSelected > 1 ? 's' : ''}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white text-[12px] font-bold opacity-90">Total estimated</Text>
                <Text className="text-white text-[18px] font-extrabold">₹{formatINR(cartTotal)}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-white text-[14px] font-extrabold">Continue</Text>
                <ChevronRight size={18} color="#fff" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <View
          className="absolute left-0 right-0 items-center"
          style={{ bottom: insets.bottom + 6, paddingHorizontal: 16 }}
        >
          <View className="bg-card border border-border rounded-full px-4 py-2 flex-row items-center" style={{ elevation: 2 }}>
            <Plus size={14} color={BRAND_GREEN} />
            <Text className="text-text-muted text-[12px] font-semibold ml-1.5">
              Add a service to continue
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Service "menu item" card — Swiggy/Zomato food-item rhythm:
//   [thumbnail]  Name + spec      [Add] / [Remove]
//                price input + warranty pills
// ════════════════════════════════════════════════════════════════════════════
function ServiceItem({
  name, Icon, isPicked, canAdd, price, onPriceChange, warranty, onWarrantyChange, onAdd, onRemove,
}) {
  return (
    <View
      className={`rounded-2xl mb-2.5 ${isPicked ? 'bg-success/5 border-success/40' : 'bg-background border-border'}`}
      style={{ borderWidth: isPicked ? 1.5 : 1, padding: 12 }}
    >
      <View className="flex-row items-start">
        <View
          className={`h-12 w-12 rounded-xl items-center justify-center mr-3 ${isPicked ? '' : 'bg-card'}`}
          style={isPicked ? { backgroundColor: ACCENT_GREEN } : null}
        >
          <Icon size={20} color={isPicked ? '#fff' : '#0F172A'} />
        </View>

        <View className="flex-1 pr-1.5">
          <Text className="font-extrabold text-text text-[13.5px]" numberOfLines={2}>{name}</Text>

          {/* Price input — chip-style */}
          <View className="flex-row items-center mt-2">
            <View className={`flex-row items-center rounded-lg border px-2 ${isPicked ? 'border-success/40 bg-card' : 'border-border bg-card'}`}>
              <Text className="text-text-muted text-[13px] mr-1">₹</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={String(price ?? '')}
                onChangeText={onPriceChange}
                className="text-text text-[13.5px] font-bold min-w-[80px]"
                style={{ paddingVertical: 6 }}
              />
            </View>
            <Pressable className="ml-2 active:opacity-60">
              <Text className="text-primary text-[10px] underline">Last 5 prices</Text>
            </Pressable>
          </View>
        </View>

        {/* Add / Remove button — Swiggy stepper-shape */}
        <View className="items-end">
          {isPicked ? (
            <Pressable
              onPress={onRemove}
              className="flex-row items-center rounded-full px-3 py-1.5 active:opacity-80"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.10)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.35)' }}
            >
              <X size={12} color="#EF4444" />
              <Text className="text-danger text-[11.5px] font-extrabold ml-1">REMOVE</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={!canAdd}
              onPress={onAdd}
              className={`flex-row items-center rounded-full px-3.5 py-1.5 ${canAdd ? 'active:opacity-80' : ''}`}
              style={{
                backgroundColor: canAdd ? ACCENT_GREEN : 'rgba(22, 163, 74, 0.35)',
                shadowColor: canAdd ? ACCENT_GREEN : 'transparent',
                shadowOpacity: canAdd ? 0.25 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: canAdd ? 3 : 0,
              }}
            >
              <Plus size={12} color="#fff" />
              <Text className="text-white text-[11.5px] font-extrabold ml-0.5">ADD</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Warranty pills — like Swiggy's "Size" / Zomato's "Variant" chips */}
      <View className="mt-3">
        <Text className="text-[9.5px] font-extrabold text-text-muted tracking-widest mb-1.5">WARRANTY</Text>
        <View className="flex-row -mx-1">
          {WARRANTY_OPTIONS.map((w) => {
            const active = warranty === w.code;
            return (
              <Pressable
                key={w.code}
                onPress={() => onWarrantyChange(w.code)}
                className="flex-1 mx-1 py-2 rounded-full items-center"
                style={{
                  backgroundColor: active ? BRAND_GREEN : '#fff',
                  borderWidth: 1,
                  borderColor: active ? BRAND_GREEN : '#E5E7EB',
                  shadowColor: active ? BRAND_GREEN : 'transparent',
                  shadowOpacity: active ? 0.25 : 0,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: active ? 2 : 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-text'}`}
                >
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function iconFor(code) {
  switch (code) {
    case 'DISPLAY': return Smartphone;
    case 'BATTERY': return BatteryMedium;
    case 'MOTHERBOARD': return Cpu;
    case 'CHARGING_PORT': return Zap;
    case 'SPEAKER': return Volume2;
    case 'CAMERA': return Aperture;
    case 'BUTTON': return LayoutGrid;
    case 'WATER_DAMAGE': return Droplets;
    case 'DEAD_PHONE': return Smartphone;
    default: return Wrench;
  }
}
