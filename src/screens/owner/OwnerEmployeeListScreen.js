import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Users,
  Phone,
  Truck,
  Wrench,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { assignPickupPerson } from '../../api/orders';
import { notify } from '../../components/confirm';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const PICKUP_ROLE = 'Pickup Person';

export default function OwnerEmployeeListScreen({ navigation, route }) {
  const assignFor = route?.params?.assignFor || null;
  const bookingId = route?.params?.bookingId || null;
  const isPickupPicker = assignFor === 'pickup' && !!bookingId;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await ticketApi.get('/technicians');
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const onToggleActive = async (tech, value) => {
    setToggling(tech.id);
    try {
      await ticketApi.patch(`/technicians/${tech.id}`, {
        body: { isAvailable: value },
      });
      setList((prev) =>
        prev.map((t) => (t.id === tech.id ? { ...t, isAvailable: value } : t))
      );
    } catch (e) {
      notify('Error', e.message || 'Failed to update', { preset: 'error', haptic: 'error' });
    } finally {
      setToggling(null);
    }
  };

  const handlePickPickupPerson = async (tech) => {
    if (!isPickupPicker || assigning) return;
    setAssigning(tech.id);
    try {
      await assignPickupPerson(bookingId, {
        pickupPersonId: tech.id,
        pickupPersonName: tech.name || null,
        pickupPersonPhone: tech.phone || null,
      });
      navigation.goBack();
    } catch (e) {
      notify(
        'Could not assign',
        e?.body?.message || e?.message || 'Please try again.',
        { preset: 'error', haptic: 'error' },
      );
    } finally {
      setAssigning(null);
    }
  };

  const visibleList = isPickupPicker
    ? list.filter((e) => (e.roleLabel || '').toLowerCase() === PICKUP_ROLE.toLowerCase())
    : list;
  const activeCount = visibleList.filter((e) => e.isAvailable !== false).length;

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
              {isPickupPicker ? 'Select Pickup Person' : 'Employees'}
            </Text>
            {!isPickupPicker ? (
              <Pressable
                onPress={() => navigation.navigate('OwnerEmployeeAdd')}
                hitSlop={6}
                className="flex-row items-center px-2.5 py-1.5 rounded-full bg-surface-muted"
              >
                <UserPlus size={12} color="#0F172A" />
                <Text className="ml-1 text-text text-[10.5px] font-extrabold">ADD</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {loading && list.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_GREEN_DARK} />
        </View>
      ) : (
        <>
          {/* Status bar */}
          <View className="flex-row items-center px-5 mt-3 mb-2">
            <View
              className="w-9 h-9 rounded-full items-center justify-center mr-2.5"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Users size={16} color={BRAND_GREEN_DARK} />
            </View>
            <View className="flex-1">
              <Text className="text-[13.5px] font-extrabold text-gray-900">
                {isPickupPicker ? 'Pickup-eligible staff' : 'All Employees'}
              </Text>
              <Text className="text-[11px] text-gray-500 mt-0.5">
                {activeCount} active · {visibleList.length} total
              </Text>
            </View>
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Text
                className="text-[10.5px] font-extrabold"
                style={{ color: BRAND_GREEN_DARK }}
              >
                {activeCount}/{visibleList.length}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
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
            {visibleList.length === 0 ? (
              <View className="items-center pt-12 px-8">
                <View
                  className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: '#DCFCE7' }}
                >
                  <Users size={32} color={BRAND_GREEN_DARK} />
                </View>
                <Text className="text-[14.5px] font-extrabold text-gray-700 text-center">
                  {isPickupPicker ? 'No pickup persons yet' : 'No employees yet'}
                </Text>
                <Text className="text-[12px] text-gray-500 mt-2 text-center leading-5">
                  {isPickupPicker
                    ? 'Add staff with the "Pickup Person" role to assign pickups.'
                    : 'Tap "Add" to add your first staff member.'}
                </Text>
              </View>
            ) : visibleList.map((e) => {
              const isActive = e.isAvailable !== false;
              const initial = (e.name || '?').trim().charAt(0).toUpperCase();
              const role = e.roleLabel || 'Technician';
              const isPickup = role.toLowerCase() === PICKUP_ROLE.toLowerCase();
              const RoleIcon = isPickup ? Truck : Wrench;
              const roleTint = isPickup ? '#FFEDD5' : '#DBEAFE';
              const roleAccent = isPickup ? '#C2410C' : '#1D4ED8';
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() =>
                    isPickupPicker
                      ? handlePickPickupPerson(e)
                      : navigation.navigate('OwnerEmployeeDetail', { employee: e })
                  }
                  activeOpacity={0.85}
                  disabled={isPickupPicker && (assigning !== null || !isActive)}
                  className="bg-white rounded-2xl p-3 mb-3 flex-row items-center"
                  style={[cardShadow, { opacity: isActive ? 1 : 0.72 }]}
                >
                  {/* Avatar */}
                  <View style={{ position: 'relative' }}>
                    <View
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text
                        className="text-[16px] font-extrabold"
                        style={{ color: isActive ? BRAND_GREEN_DARK : '#94A3B8' }}
                      >
                        {initial}
                      </Text>
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        right: -1, bottom: -1,
                        width: 12, height: 12, borderRadius: 6,
                        backgroundColor: isActive ? BRAND_GREEN : '#9CA3AF',
                        borderWidth: 2, borderColor: '#FFFFFF',
                      }}
                    />
                  </View>

                  <View className="flex-1 ml-3 pr-1">
                    <Text className="text-[14px] font-extrabold text-gray-900" numberOfLines={1}>
                      {e.name || '—'}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Phone size={10} color="#94A3B8" />
                      <Text className="text-[11.5px] text-gray-500 ml-1" numberOfLines={1}>
                        {e.phone || e.email || '—'}
                      </Text>
                    </View>
                    <View
                      className="flex-row items-center self-start px-2 py-0.5 rounded-full mt-1.5"
                      style={{ backgroundColor: roleTint }}
                    >
                      <RoleIcon size={10} color={roleAccent} />
                      <Text
                        className="ml-1 text-[10px] font-extrabold"
                        style={{ color: roleAccent, letterSpacing: 0.3 }}
                      >
                        {role}
                      </Text>
                    </View>
                  </View>

                  {/* Right side */}
                  {isPickupPicker ? (
                    <View>
                      {assigning === e.id ? (
                        <ActivityIndicator size="small" color={BRAND_GREEN_DARK} />
                      ) : (
                        <ChevronRight size={18} color={BRAND_GREEN_DARK} />
                      )}
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      {toggling === e.id ? (
                        <ActivityIndicator size="small" color={BRAND_GREEN} style={{ transform: [{ scale: 0.75 }] }} />
                      ) : (
                        <Switch
                          value={isActive}
                          onValueChange={(v) => onToggleActive(e, v)}
                          trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                          thumbColor={isActive ? BRAND_GREEN : '#9CA3AF'}
                          style={{ transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] }}
                        />
                      )}
                      <Pressable
                        onPress={() => navigation.navigate('OwnerEmployeeDetail', { employee: e })}
                        hitSlop={8}
                        className="ml-1"
                      >
                        <ChevronRight size={16} color="#94A3B8" />
                      </Pressable>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}
