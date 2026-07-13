import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  XCircle,
  User,
  CalendarDays,
  ChevronLeft,
  Clock,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { notify } from '../../components/confirm';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

const STATUS_OPTIONS = [
  { value: 'PENDING',  label: 'Pending',  accent: '#B45309', tint: '#FEF3C7' },
  { value: 'APPROVED', label: 'Approved', accent: BRAND_GREEN_DARK, tint: '#DCFCE7' },
  { value: 'REJECTED', label: 'Rejected', accent: '#B91C1C', tint: '#FEE2E2' },
];

function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OwnerLeaveRequestsScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const endpoint = status === 'PENDING'
        ? '/technicians/leaves/pending'
        : `/technicians/leaves?status=${status}`;
      const res = await ticketApi.get(endpoint);
      setList(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e?.message || 'Failed to load leave requests');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const respond = async (item, decision) => {
    setActionId(item.id);
    try {
      await ticketApi.patch(`/technicians/${item.technicianId}/leaves/${item.id}`, {
        body: { status: decision },
      });
      load(true);
    } catch (e) {
      notify('Error', e?.message ?? `Failed to ${decision.toLowerCase()}`, { preset: 'error', haptic: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const activeMeta = STATUS_OPTIONS.find((o) => o.value === status);

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: 6,
            paddingBottom: 14,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-surface-muted"
            >
              <ChevronLeft size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text className="flex-1 text-text text-[17px] font-extrabold" numberOfLines={1}>
              Leave Requests
            </Text>
            <View
              className="px-2.5 py-1 rounded-full bg-surface-muted"
            >
              <Text className="text-text text-[10.5px] font-extrabold">
                {list.length} {activeMeta?.label || 'Total'}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Filter chip row */}
      <View className="px-4 mt-3 mb-1 flex-row">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === status;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setStatus(opt.value)}
              className="flex-row items-center px-3 py-1.5 rounded-full mr-2"
              style={{
                backgroundColor: active ? opt.accent : '#FFFFFF',
                borderWidth: 1,
                borderColor: active ? opt.accent : '#E5E7EB',
              }}
            >
              <Text
                className="text-[12px] font-extrabold"
                style={{ color: active ? '#FFFFFF' : opt.accent }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && list.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_GREEN_DARK} />
        </View>
      ) : error ? (
        <View className="px-4 mt-4">
          <View
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
          >
            <Text className="text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>
              {error}
            </Text>
            <Pressable
              onPress={() => load()}
              className="mt-2 self-start px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#B91C1C' }}
            >
              <Text className="text-white text-[11px] font-extrabold">Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : list.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: activeMeta?.tint || '#DCFCE7' }}
          >
            <CheckCircle2 size={32} color={activeMeta?.accent || BRAND_GREEN_DARK} />
          </View>
          <Text className="text-[15px] font-extrabold text-gray-700">
            No {activeMeta?.label.toLowerCase() || 'matching'} leaves
          </Text>
          <Text className="text-[12px] text-gray-500 mt-2 text-center leading-5">
            {status === 'PENDING'
              ? 'New leave requests from your team will appear here.'
              : `No ${activeMeta?.label.toLowerCase()} leaves to show.`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={BRAND_GREEN_DARK}
              colors={[BRAND_GREEN_DARK]}
            />
          }
        >
          {list.map((item) => {
            const meta = STATUS_OPTIONS.find((o) => o.value === (item.status || 'PENDING'));
            const acting = actionId === item.id;
            return (
              <View
                key={item.id}
                className="bg-white rounded-2xl p-4 mb-3"
                style={cardShadow}
              >
                <View className="flex-row items-start">
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: 14,
                      backgroundColor: '#DCFCE7',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <User size={20} color={BRAND_GREEN_DARK} strokeWidth={2.2} />
                  </View>
                  <View className="flex-1 pr-2">
                    <Text className="text-[14.5px] font-extrabold text-gray-900" numberOfLines={1}>
                      {item.technicianName ?? 'Employee'}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <CalendarDays size={12} color="#94A3B8" />
                      <Text className="ml-1.5 text-[11.5px] text-gray-500">
                        {formatDate(item.startDate)} – {formatDate(item.endDate)}
                      </Text>
                    </View>
                    {item.appliedDaysLabel ? (
                      <View className="flex-row items-center mt-1">
                        <Clock size={11} color="#94A3B8" />
                        <Text className="ml-1.5 text-[11px] text-gray-500">
                          {item.appliedDaysLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: meta?.tint || '#FEF3C7' }}
                  >
                    <Text
                      className="text-[10px] font-extrabold"
                      style={{ color: meta?.accent || '#B45309', letterSpacing: 0.3 }}
                    >
                      {(item.status || 'PENDING').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.reason ? (
                  <View
                    className="mt-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F8FAFC' }}
                  >
                    <Text
                      className="text-[9.5px] uppercase font-extrabold text-gray-500"
                      style={{ letterSpacing: 0.8 }}
                    >
                      Reason
                    </Text>
                    <Text className="text-[12.5px] text-gray-700 mt-1 leading-5">
                      {item.reason}
                    </Text>
                  </View>
                ) : null}

                {status === 'PENDING' ? (
                  <View className="flex-row mt-3">
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => respond(item, 'APPROVED')}
                      disabled={actionId != null}
                      className="flex-1 mr-2"
                      style={cardShadow}
                    >
                      <LinearGradient
                        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          borderRadius: 14,
                          paddingVertical: 11,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: actionId != null && !acting ? 0.6 : 1,
                        }}
                      >
                        {acting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <CheckCircle2 size={14} color="#FFFFFF" />
                        )}
                        <Text className="ml-2 text-white text-[13px] font-extrabold">
                          Approve
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => respond(item, 'REJECTED')}
                      disabled={actionId != null}
                      className="flex-1 ml-2 rounded-2xl py-3 flex-row items-center justify-center"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#FCA5A5',
                        opacity: actionId != null && !acting ? 0.6 : 1,
                      }}
                    >
                      <XCircle size={14} color="#B91C1C" />
                      <Text className="ml-2 text-[13px] font-extrabold" style={{ color: '#B91C1C' }}>
                        Deny
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
