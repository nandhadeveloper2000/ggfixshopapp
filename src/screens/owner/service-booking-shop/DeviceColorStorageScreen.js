import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone,
  Cpu,
  HardDrive,
  Palette,
  Check,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { getColors, getRamOptions, getStorageOptions } from '../../../api/masterData';

// Swiggy / Zomato-inspired palette — matches the other booking screens so the
// whole flow feels like one continuous "order" journey, just in green.
const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const COLOR_SWATCHES = {
  black: '#0F172A',
  white: '#F8FAFC',
  silver: '#CBD5E1',
  gold: '#F5E6B0',
  rose: '#FBCFE8',
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#10B981',
  purple: '#A855F7',
  pink: '#EC4899',
  graphite: '#4B5563',
  midnight: '#1E1B4B',
  starlight: '#FAF7F0',
  sierra: '#B7BCC8',
  alpine: '#3F4754',
  sky: '#7DD3FC',
};

function swatchFor(name) {
  const n = (name || '').toLowerCase();
  for (const key of Object.keys(COLOR_SWATCHES)) {
    if (n.includes(key)) return COLOR_SWATCHES[key];
  }
  return '#94A3B8';
}

export default function DeviceColorStorageScreen({ navigation, route }) {
  const params = route?.params || {};
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rams, setRams] = useState([]);
  const [storages, setStorages] = useState([]);
  const [colorsList, setColorsList] = useState([]);
  // Edit mode: hydrate color/RAM/storage from the existing ticket so they show
  // pre-selected. Picking a different option just overwrites the choice.
  const [color, setColor] = useState(params.color || '');
  const [ram, setRam] = useState(params.ramOptionId || null);
  const [storage, setStorage] = useState(params.storageOptionId || null);

  useEffect(() => {
    (async () => {
      try {
        const [r, s, c] = await Promise.all([
          getRamOptions(), getStorageOptions(), getColors().catch(() => []),
        ]);
        setRams(r);
        setStorages(s);
        setColorsList(c);
      } catch (_) { }
      setLoading(false);
    })();
  }, []);

  const onContinue = () => {
    if (!color.trim() || !ram || !storage) return;
    const ramLabel = rams.find((x) => x.id === ram)?.label;
    const storageLabel = storages.find((x) => x.id === storage)?.label;
    navigation.navigate('DeviceServices', {
      ...params,
      color: color.trim(),
      ramOptionId: ram,
      storageOptionId: storage,
      ramLabel,
      storageLabel,
    });
  };

  const ready = !!color && !!ram && !!storage;

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <View
          style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
        >
          <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 rounded-full bg-surface-muted items-center justify-center">
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
        </View>
        <Loader label="Loading device options..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* ── White header — matches app's other white headers ─────── */}
      <View
        style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
      >
        <View className="relative flex-row items-center justify-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="absolute left-0 h-10 w-10 rounded-full bg-surface-muted items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>

          <View className="items-center px-12">
            <Text className="text-text-muted text-[11px] font-bold tracking-widest text-center">
              CUSTOMIZE
            </Text>

            <Text
              className="text-text text-[19px] font-extrabold mt-0.5 text-center"
              numberOfLines={1}
            >
              Color, RAM & Storage
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Device card overlapping hero ─────────────────────────────── */}
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
              <View className="h-16 w-16 rounded-2xl bg-success/10 items-center justify-center overflow-hidden mr-3">
                {params.imageUrl ? (
                  <Image source={{ uri: params.imageUrl }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                ) : (
                  <Smartphone size={28} color={ACCENT_GREEN} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-text" numberOfLines={1}>
                  {params.modelName || 'Device'}
                </Text>
                <Text className="text-[11.5px] text-text-muted mt-0.5" numberOfLines={1}>
                  {params.brandName || ''}
                </Text>
                {ready ? (
                  <View className="bg-success/10 rounded-md px-1.5 py-0.5 self-start mt-1.5">
                    <Text className="text-success text-[10px] font-extrabold">READY TO CONTINUE</Text>
                  </View>
                ) : (
                  <Text className="text-text-muted text-[10.5px] mt-1.5">Pick color, RAM and storage</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Color section — Swiggy/Zomato menu rhythm ─────────────── */}
        <SectionHeader icon={Palette} label="MODEL COLOR" />
        <View className="px-4">
          <View className="bg-card rounded-2xl p-3.5" style={cardShadow}>
            {color ? (
              <View className="flex-row items-center mb-3">
                <View
                  className="h-6 w-6 rounded-full border border-border mr-2"
                  style={{ backgroundColor: swatchFor(color) }}
                />
                <Text className="flex-1 text-[13px] font-extrabold text-text">{color}</Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)' }}>
                  <Text className="text-[10px] font-extrabold" style={{ color: ACCENT_GREEN }}>SELECTED</Text>
                </View>
              </View>
            ) : null}

            {colorsList.length > 0 ? (
              <View className="flex-row flex-wrap -mx-1">
                {colorsList.map((c) => {
                  const active = color === c.name;
                  const sw = swatchFor(c.name);
                  return (
                    <View key={c.id || c.name} className="p-1" style={{ width: '33.333%' }}>
                      <Pressable
                        onPress={() => setColor(c.name)}
                        className="rounded-xl items-center"
                        style={{
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? ACCENT_GREEN : '#E5E7EB',
                          backgroundColor: active ? 'rgba(22, 163, 74, 0.06)' : '#FFFFFF',
                          paddingVertical: 10,
                          paddingHorizontal: 6,
                          shadowColor: active ? ACCENT_GREEN : 'transparent',
                          shadowOpacity: active ? 0.18 : 0,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: active ? 2 : 0,
                        }}
                      >
                        <View className="flex-row items-center justify-center">
                          <View
                            className="h-6 w-6 rounded-full border border-border"
                            style={{ backgroundColor: sw }}
                          />
                          {active ? (
                            <View
                              className="ml-1 h-5 w-5 rounded-full items-center justify-center"
                              style={{ backgroundColor: ACCENT_GREEN }}
                            >
                              <Check size={11} color="#fff" strokeWidth={3} />
                            </View>
                          ) : null}
                        </View>
                        <Text
                          className={`text-[11px] font-extrabold mt-1.5 text-center ${active ? 'text-success' : 'text-text'}`}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View
                className="flex-row items-center rounded-xl px-3"
                style={{ borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}
              >
                <TextInput
                  placeholder="e.g. Silver Shadow"
                  placeholderTextColor="#94A3B8"
                  value={color}
                  onChangeText={setColor}
                  className="flex-1 py-3 text-text text-[14px]"
                />
              </View>
            )}
          </View>
        </View>

        {/* ── RAM section ──────────────────────────────────────────── */}
        <SectionHeader icon={Cpu} label="RAM" subtitle="Pick the memory size" />
        <View className="px-4">
          <VariantGrid
            options={rams}
            selected={ram}
            onSelect={setRam}
            getLabel={(r) => r.label}
            keyOf={(r) => r.id}
          />
        </View>

        {/* ── Storage section ──────────────────────────────────────── */}
        <SectionHeader icon={HardDrive} label="STORAGE" subtitle="Pick the capacity" />
        <View className="px-4">
          <VariantGrid
            options={storages}
            selected={storage}
            onSelect={setStorage}
            getLabel={(s) => s.label}
            keyOf={(s) => s.id}
          />
        </View>

        {/* ── Trust strip — "Genuine ingredients" Swiggy pattern ───── */}
        <View className="px-4 mt-4">
          <View className="flex-row items-center justify-around py-3 rounded-2xl bg-card" style={cardShadow}>
            <TrustItem icon={Sparkles} label="100% original" />
            <View className="h-8 w-px bg-border" />
            <TrustItem icon={Check} label="Verified specs" />
            <View className="h-8 w-px bg-border" />
            <TrustItem icon={Smartphone} label="Tested fit" />
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky green-gradient CTA — matches sibling screens ─────── */}
      <View
        className="absolute left-0 right-0"
        style={{ bottom: insets.bottom + 4, paddingHorizontal: 16 }}
      >
        <Pressable
          onPress={onContinue}
          disabled={!ready}
          className="active:opacity-90"
          style={{
            borderRadius: 18,
            overflow: 'hidden',
            opacity: ready ? 1 : 0.55,
            shadowColor: BRAND_GREEN_DARK,
            shadowOpacity: ready ? 0.35 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: ready ? 10 : 0,
          }}
        >
          <LinearGradient
            colors={ready ? [BRAND_GREEN, BRAND_GREEN_DARK] : ['#94A3B8', '#64748B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
          >
            <View className="flex-1">
              <Text className="text-white text-[11px] font-bold opacity-90">YOUR CONFIGURATION</Text>
              <Text className="text-white text-[14px] font-extrabold" numberOfLines={1}>
                {summaryLabel(color, rams.find((x) => x.id === ram)?.label, storages.find((x) => x.id === storage)?.label)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-white text-[14px] font-extrabold">Continue</Text>
              <ChevronRight size={18} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
        {!ready ? (
          <Text className="text-text-muted text-[10.5px] text-center mt-2">
            Pick color, RAM and storage to continue.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Reusable bits
// ════════════════════════════════════════════════════════════════════════════
function SectionHeader({ icon: Icon, label, subtitle }) {
  return (
    <View className="px-4 pt-5 pb-2">
      <View className="flex-row items-center">
        <Icon size={14} color={BRAND_GREEN_DARK} />
        <Text className="text-text font-extrabold text-[12.5px] tracking-widest ml-1.5">{label}</Text>
        <View className="flex-1 h-px bg-border ml-2" />
      </View>
      {subtitle ? (
        <Text className="text-text-muted text-[10.5px] mt-1 ml-5">{subtitle}</Text>
      ) : null}
    </View>
  );
}

function VariantGrid({ options, selected, onSelect, getLabel, keyOf }) {
  return (
    <View className="bg-card rounded-2xl p-3.5" style={cardShadow}>
      <View className="flex-row flex-wrap -mx-1">
        {options.map((o) => {
          const k = keyOf(o);
          const active = selected === k;
          return (
            <View key={k} className="p-1" style={{ width: '33.333%' }}>
              <Pressable
                onPress={() => onSelect(k)}
                className="rounded-xl items-center"
                style={{
                  borderWidth: active ? 0 : 1,
                  borderColor: '#E5E7EB',
                  backgroundColor: active ? ACCENT_GREEN : '#FFFFFF',
                  paddingVertical: 12,
                  paddingHorizontal: 6,
                  shadowColor: active ? ACCENT_GREEN : 'transparent',
                  shadowOpacity: active ? 0.28 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: active ? 3 : 0,
                }}
              >
                <Text
                  className={`text-[14px] font-extrabold ${active ? 'text-white' : 'text-text'}`}
                  numberOfLines={1}
                >
                  {getLabel(o)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TrustItem({ icon: Icon, label }) {
  return (
    <View className="items-center flex-1">
      <Icon size={16} color={ACCENT_GREEN} />
      <Text className="text-text-muted text-[10px] font-extrabold mt-1 text-center" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function summaryLabel(color, ramLabel, storageLabel) {
  const parts = [color, ramLabel, storageLabel].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Pick your variant';
}

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
