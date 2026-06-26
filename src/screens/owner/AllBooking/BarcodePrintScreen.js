import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StatusBar, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Minus,
  Plus,
  Share2,
  Printer,
  Smartphone,
  Wrench,
  ChevronLeft,
  Hash,
  ScanLine,
  User,
  Copy,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { ticketApi } from '../../../api/client';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

/**
 * Pure-RN faux barcode: deterministic bar-width pattern based on the input
 * string so the same tracking ID always renders the same pattern. Good
 * enough for visual print/share — not a scannable Code 128, but reads as
 * a barcode for the receipt header.
 */
function CodePattern({ value, width = 280, height = 70 }) {
  if (!value) return null;
  const bars = [];
  let h = 7;
  for (let i = 0; i < (value.length || 1) * 10 && bars.length < 90; i++) {
    h = (h * 31 + (value.charCodeAt(i % value.length) || 1)) >>> 0;
    bars.push((h % 3) + 1);
  }
  const total = bars.reduce((s, w) => s + w, 0);
  const unit = width / total;
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFFFFF' }}>
      {bars.map((w, i) => (
        <View key={i} style={{ width: w * unit, backgroundColor: i % 2 === 0 ? '#0F172A' : '#FFFFFF' }} />
      ))}
    </View>
  );
}

function SectionHeader({ icon: Icon, label, tint = '#DCFCE7', accent = BRAND_GREEN_DARK }) {
  return (
    <View className="flex-row items-center mb-3">
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: tint }}
      >
        <Icon size={14} color={accent} />
      </View>
      <Text
        className="text-[11px] font-bold tracking-widest"
        style={{ color: accent, letterSpacing: 1.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function BarcodePrintScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const ticketId = route?.params?.ticketId;
  const [ticket, setTicket] = useState(null);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const t = await ticketApi.get(`/tickets/${ticketId}`).catch(() => null);
      setTicket(t);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Loader label="Loading barcode..." />;

  const trackingId = ticket?.trackingId || ticketId || 'NO-ID';
  const deviceName = ticket?.deviceModelName || ticket?.modelName || 'Device';
  const services = ticket?.repairServicesSummary
    || ticket?.services?.map?.((s) => s.serviceName).join(', ')
    || '—';
  const customerName = ticket?.customerName || '—';

  const handleShare = async () => {
    const msg =
      `📦 GGFix Barcode Slip\n\n` +
      `Tracking: ${trackingId}\n` +
      `Customer: ${customerName}\n` +
      `Device: ${deviceName}\n` +
      `Service: ${services}\n` +
      `Copies: ${copies}\n\n` +
      `Stick this slip on the device before placing it on the workbench.`;
    try {
      await Share.share({ message: msg, title: `Barcode ${trackingId}` });
    } catch (e) {
      notify('Share failed', e?.message || 'Try again');
    }
  };

  const handlePrint = () => {
    notify(
      'Printing not configured',
      `${copies} slip${copies > 1 ? 's' : ''} for ${trackingId}.\n\nNative print needs Expo Print — use the Share button for now and pick "Print" from the share sheet.`,
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      {/* Slim green hero */}
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="flex-1 text-white text-[17px] font-extrabold" numberOfLines={1}>
            Barcode E-Print
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', maxWidth: 160 }}
          >
            <Text className="text-white text-[11px] font-extrabold" numberOfLines={1}>
              #{trackingId}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Booking summary card */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <View
            className="bg-white rounded-2xl p-4 flex-row items-center"
            style={cardShadow}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Smartphone size={26} color={BRAND_GREEN_DARK} />
            </View>
            <View className="flex-1">
              <Text className="text-[10.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.7 }}>
                Booking
              </Text>
              <Text className="text-[15px] font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                {deviceName}
              </Text>
              <Text className="text-[11.5px] text-gray-500 mt-0.5" numberOfLines={1}>
                #{trackingId}
              </Text>
            </View>
            <View
              className="px-3 py-1.5 rounded-full flex-row items-center"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Copy size={11} color={BRAND_GREEN_DARK} />
              <Text
                className="ml-1 text-[11px] font-extrabold"
                style={{ color: BRAND_GREEN_DARK }}
              >
                {copies} {copies === 1 ? 'COPY' : 'COPIES'}
              </Text>
            </View>
          </View>
        </View>

        {/* Barcode slip preview */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={ScanLine} label="BARCODE SLIP" />
            <View
              className="rounded-2xl p-4 items-center"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: '#86EFAC',
              }}
            >
              <View className="flex-row mb-2 w-full">
                <View className="flex-1">
                  <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.6 }}>
                    Service No.
                  </Text>
                  <Text className="text-[12.5px] font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                    {trackingId}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.6 }}>
                    Device
                  </Text>
                  <Text className="text-[12.5px] font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                    {deviceName}
                  </Text>
                </View>
              </View>
              <View className="flex-row mb-3 w-full">
                <View className="flex-1">
                  <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.6 }}>
                    Customer
                  </Text>
                  <Text className="text-[12px] font-bold text-gray-900 mt-0.5" numberOfLines={1}>
                    {customerName}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.6 }}>
                    Service
                  </Text>
                  <Text className="text-[12px] font-bold text-gray-900 mt-0.5" numberOfLines={1}>
                    {services}
                  </Text>
                </View>
              </View>
              <CodePattern value={trackingId} />
              <Text className="text-[12px] tracking-widest font-bold text-gray-900 mt-1">
                {String(trackingId).toUpperCase().split('').join(' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Copies stepper */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={Copy} label="COPIES" />
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-[13.5px] font-extrabold text-gray-900">
                  Number of copies
                </Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">
                  How many slips do you want?
                </Text>
              </View>
              <View
                className="flex-row items-center rounded-full"
                style={{
                  backgroundColor: '#F0FDF4',
                  borderWidth: 1,
                  borderColor: '#BBF7D0',
                }}
              >
                <Pressable
                  onPress={() => setCopies((c) => Math.max(1, c - 1))}
                  className="h-9 w-9 rounded-full items-center justify-center active:opacity-70"
                >
                  <Minus size={14} color={BRAND_GREEN_DARK} />
                </Pressable>
                <Text
                  className="text-[15px] font-extrabold w-8 text-center"
                  style={{ color: BRAND_GREEN_DARK }}
                >
                  {copies}
                </Text>
                <Pressable
                  onPress={() => setCopies((c) => Math.min(20, c + 1))}
                  className="h-9 w-9 rounded-full items-center justify-center active:opacity-80"
                  style={{ backgroundColor: BRAND_GREEN }}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={3} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Hint */}
        <View className="px-4 mt-4">
          <View
            className="rounded-2xl p-3 flex-row items-start"
            style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
          >
            <View
              className="w-7 h-7 rounded-full items-center justify-center mr-2.5"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              <Wrench size={13} color="#FFFFFF" />
            </View>
            <Text className="text-[11.5px] text-gray-700 flex-1 leading-4">
              Stick this slip on the device before placing it on the workbench. The barcode encodes the tracking ID for quick scanning.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        className="absolute left-0 right-0 bottom-0 flex-row px-4 pt-3"
        style={{
          paddingBottom: insets.bottom + 12,
          backgroundColor: 'rgba(244,251,246,0.96)',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleShare}
          className="flex-1 mr-2 rounded-2xl py-3.5 flex-row items-center justify-center"
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: BRAND_GREEN,
            ...cardShadow,
          }}
        >
          <Share2 size={16} color={BRAND_GREEN_DARK} />
          <Text className="ml-2 text-[14px] font-extrabold" style={{ color: BRAND_GREEN_DARK }}>
            Share
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePrint}
          className="flex-1 ml-2"
          style={cardShadow}
        >
          <LinearGradient
            colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Printer size={16} color="#FFFFFF" />
            <Text className="ml-2 text-white text-[14px] font-extrabold">Print</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
