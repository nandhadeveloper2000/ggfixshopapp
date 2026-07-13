import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Mic, X, Wrench, Tag, ShoppingBag, ArrowRight, Wand2 } from 'lucide-react-native';
import { notify } from '../../components/confirm';

const GREEN       = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_DARK  = '#15803D';

// Pull the intent ("…in repair / in sell / in buy") out of the typed query and
// return the remaining device text. A forced flow (from the chips) wins.
function parseQuery(raw, forcedFlow) {
  const text = (raw || '').trim();
  const lower = text.toLowerCase();
  let flow = forcedFlow || null;
  if (!flow) {
    if (/\brepair\b/.test(lower)) flow = 'repair';
    else if (/\bsell\b/.test(lower)) flow = 'sell';
    else if (/\bbuy\b/.test(lower)) flow = 'buy';
  }
  const device = text
    .replace(/\bin\s+(repair|sell|buy)\b/gi, '')
    .replace(/\b(repair|sell|buy)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { flow, device };
}

const FLOWS = [
  { key: null,     label: 'Auto',   icon: Wand2 },
  { key: 'repair', label: 'Repair', icon: Wrench },
  { key: 'sell',   label: 'Sell',   icon: Tag },
  { key: 'buy',    label: 'Buy',    icon: ShoppingBag },
];

const FLOW_META = {
  repair: { title: 'New Booking', desc: 'Start a repair booking', icon: Wrench },
  sell:   { title: 'Sell',        desc: 'Sell a device',          icon: Tag },
  buy:    { title: 'Buy',         desc: 'Browse the marketplace',  icon: ShoppingBag },
};

export default function OwnerSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [forced, setForced] = useState(null);

  const parsed = useMemo(() => parseQuery(query, forced), [query, forced]);
  const resolvedFlow = parsed.flow || 'repair';
  const meta = FLOW_META[resolvedFlow];

  const go = () => {
    const device = parsed.device;
    if (resolvedFlow === 'repair') {
      navigation.navigate('RepairServiceBookingShop', { q: device });
    } else if (resolvedFlow === 'sell') {
      navigation.navigate('OwnerTabs', { screen: 'Sell' });
    } else {
      navigation.navigate('OwnerTabs', { screen: 'Buy', params: { q: device } });
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View
          style={{ backgroundColor: '#FFFFFF', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              className="h-9 w-9 rounded-full items-center justify-center mr-1"
              style={{ backgroundColor: '#F1F3F5' }}
            >
              <ChevronLeft size={20} color="#0F172A" />
            </Pressable>
            <View
              className="flex-1 flex-row items-center bg-white rounded-2xl px-3.5 py-2.5"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}
            >
              <Search size={16} color={GREEN} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={go}
                placeholder="e.g. apple iphone 17 in repair"
                placeholderTextColor="#94A3B8"
                style={{ flex: 1, marginLeft: 8, color: '#0F172A', fontSize: 14, padding: 0 }}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={6} className="w-6 h-6 rounded-full items-center justify-center mr-1" style={{ backgroundColor: '#F1F5F9' }}>
                  <X size={13} color="#64748B" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => notify('Voice search', "Voice input isn't enabled in this build yet — type your search instead.")}
                hitSlop={6}
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{ backgroundColor: '#F0FDF4' }}
              >
                <Mic size={15} color={GREEN_DARK} />
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {/* Flow chooser */}
        <Text className="text-[11px] font-extrabold text-gray-500 tracking-wide mb-2">SEARCH IN</Text>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
          {FLOWS.map((f) => {
            const Icon = f.icon;
            const active = forced === f.key;
            return (
              <Pressable
                key={f.label}
                onPress={() => setForced(f.key)}
                className="flex-row items-center px-3 py-2 rounded-full m-1 active:opacity-80"
                style={{
                  backgroundColor: active ? GREEN : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: active ? GREEN_DARK : '#E5E7EB',
                }}
              >
                <Icon size={13} color={active ? '#FFFFFF' : GREEN_DARK} />
                <Text className="ml-1.5 text-[12px] font-extrabold" style={{ color: active ? '#FFFFFF' : '#0F172A' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live intent preview / action */}
        {query.trim() ? (
          <Pressable
            onPress={go}
            className="mt-4 bg-white rounded-2xl p-4 flex-row items-center active:opacity-80"
            style={{ borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}
          >
            <View className="h-11 w-11 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: '#F0FDF4' }}>
              <meta.icon size={20} color={GREEN_DARK} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-extrabold text-gray-400 tracking-wide">
                {parsed.flow ? 'DETECTED' : 'DEFAULT'} · OPEN
              </Text>
              <Text className="text-[15px] font-extrabold text-gray-900">{meta.title}</Text>
              {parsed.device ? (
                <Text className="text-[12px] text-gray-500 mt-0.5" numberOfLines={1}>for “{parsed.device}”</Text>
              ) : (
                <Text className="text-[12px] text-gray-500 mt-0.5">{meta.desc}</Text>
              )}
            </View>
            <ArrowRight size={18} color={GREEN_DARK} />
          </Pressable>
        ) : null}

        {/* Examples */}
        <Text className="text-[11px] font-extrabold text-gray-500 tracking-wide mt-6 mb-2">TRY</Text>
        {[
          'apple iphone 17 in repair',
          'apple iphone 17 in sell',
          'apple iphone 17 in buy',
        ].map((ex) => (
          <Pressable
            key={ex}
            onPress={() => setQuery(ex)}
            className="flex-row items-center bg-white rounded-xl px-3.5 py-3 mb-2 active:opacity-80"
            style={{ borderWidth: 1, borderColor: '#EEF2F6' }}
          >
            <Search size={14} color="#94A3B8" />
            <Text className="ml-2.5 text-[13px] text-gray-700 flex-1">{ex}</Text>
            <ArrowRight size={15} color="#CBD5E1" />
          </Pressable>
        ))}
        <Text className="text-[11px] text-gray-400 mt-2 leading-5">
          Tip: end your search with “in repair”, “in sell” or “in buy” to jump straight into that flow.
        </Text>
      </ScrollView>
    </View>
  );
}
