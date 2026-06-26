import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Hash,
  Activity,
  History,
  Radio,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';
import {
  ServiceHistoryTimeline,
  getCurrentPhaseLabel,
} from '../../common/serviceHistoryPhases';

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

const hashed = (n) => (n ? (String(n).startsWith('#') ? n : `#${n}`) : '');

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

export default function BookingTimelineScreen({ route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const ticketId = route?.params?.ticketId;
  const [ticket, setTicket] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [t, ev] = await Promise.all([
        ticketApi.get(`/tickets/${ticketId}`).catch(() => null),
        ticketApi.get(`/tickets/${ticketId}/events`).catch(() => []),
      ]);
      setTicket(t);
      setEvents(Array.isArray(ev) ? ev : (ev?.content ?? []));
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load history');
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => { await load(); if (active) setLoading(false); })();
    timer.current = setInterval(load, 10000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader label="Loading history..." />;

  const currentLabel = getCurrentPhaseLabel(events, ticket?.status);
  const tracking = ticket?.trackingId ? hashed(ticket.trackingId) : ticketId;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      {/* Hero gradient (slim — replaces native white header) */}
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
            Service History
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', maxWidth: 160 }}
          >
            <Text className="text-white text-[11px] font-extrabold" numberOfLines={1}>
              {tracking}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_GREEN_DARK}
            colors={[BRAND_GREEN_DARK]}
          />
        }
      >
        {/* Current status floating card */}
        <View className="px-4" style={{ marginTop: -40 }}>
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <View className="flex-row items-center">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: '#DCFCE7' }}
              >
                <Radio size={20} color={BRAND_GREEN_DARK} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[10.5px] uppercase font-bold text-gray-400"
                  style={{ letterSpacing: 0.7 }}
                >
                  Current Status
                </Text>
                <Text className="text-[15px] font-extrabold text-gray-900 mt-0.5">
                  {currentLabel || 'Booking Placed'}
                </Text>
              </View>
              <View
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: '#DCFCE7' }}
              >
                <Text
                  className="text-[11px] font-extrabold"
                  style={{ color: BRAND_GREEN_DARK }}
                >
                  {events.length}
                </Text>
              </View>
            </View>
            <View
              className="mt-3 pt-3 flex-row items-center"
              style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
            >
              <Activity size={11} color="#9CA3AF" />
              <Text className="ml-1.5 text-[10.5px] text-gray-500">
                {events.length} event{events.length === 1 ? '' : 's'} • Updates live • Pull to refresh
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View className="px-4 mt-4">
            <View
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
            >
              <Text className="text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>
                {error}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Timeline */}
        <View className="px-4" style={{ marginTop: 14 }}>
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={History} label="SERVICE TIMELINE" />
            <ServiceHistoryTimeline events={events} status={ticket?.status} phaseFilter="SERVICE" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
