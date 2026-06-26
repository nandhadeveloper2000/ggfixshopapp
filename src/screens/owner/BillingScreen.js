import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  X,
  Receipt,
  Smartphone,
  User,
  Phone,
  Wrench,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { ticketApi } from '../../api/client';
import { getModelsByBrand } from '../../api/masterData';

// Swiggy / Zomato green palette — matches AllBooking screens.
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

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const STATUS_META = {
  CREATED:              { label: 'Service Accepted',     color: '#92400E', tint: '#FEF3C7', hint: 'Booking has been created.' },
  ASSIGNED:             { label: 'Technician Assigned',  color: '#1D4ED8', tint: '#DBEAFE', hint: 'Technician assigned.' },
  IN_DIAGNOSIS:         { label: 'In Diagnosis',         color: '#6D28D9', tint: '#EDE9FE', hint: 'Device is being checked.' },
  IN_REPAIR:            { label: 'In Service',           color: '#6D28D9', tint: '#EDE9FE', hint: 'Repair work is in progress.' },
  QUOTED:               { label: 'Re-Estimated',         color: '#92400E', tint: '#FEF3C7', hint: 'Estimate has been updated.' },
  APPROVED:             { label: 'Customer Approved',    color: '#1D4ED8', tint: '#DBEAFE', hint: 'Customer approved the repair.' },
  READY:                { label: 'Ready for Delivery',   color: '#B45309', tint: '#FFEDD5', hint: 'Device is ready for billing & delivery.' },
  INVOICE_GENERATED:    { label: 'Invoice Generated',    color: '#B45309', tint: '#FFEDD5', hint: 'Billing started — invoice created.' },
  INVOICE_READY:        { label: 'Invoice Ready',        color: '#B45309', tint: '#FFEDD5', hint: 'Invoice is finalized for handover.' },
  DELIVERED_PROCESSING: { label: 'Out for Delivery',     color: '#B45309', tint: '#FFEDD5', hint: 'Handover to customer in progress.' },
  DELIVERED:            { label: 'Delivered',            color: BRAND_GREEN_DARK, tint: '#DCFCE7', hint: 'Device has been delivered.' },
  CANCELLED:            { label: 'Cancelled',            color: '#B91C1C', tint: '#FEE2E2', hint: 'Booking was cancelled.' },
  RETURNED:             { label: 'Returned',             color: '#B91C1C', tint: '#FEE2E2', hint: 'Device was returned.' },
};

const emptyText = 'Not captured';

function unwrap(data) {
  return Array.isArray(data) ? data : data?.content ?? data?.data ?? [];
}

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function parsePriceItems(json) {
  if (!json || typeof json !== 'string') return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function BillingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await ticketApi.get('/tickets', { query: { page: 0, size: 50, q: query || undefined } });
        const content = unwrap(data);
        const brandIds = Array.from(new Set(content.map((ticket) => ticket.brandId).filter(Boolean)));
        const modelById = {};
        await Promise.all(brandIds.map(async (brandId) => {
          try {
            const models = await getModelsByBrand(brandId);
            (models || []).forEach((model) => { modelById[model.id] = model; });
          } catch (_) {}
        }));
        setItems(content.map((ticket) => {
          const model = ticket.modelId ? modelById[ticket.modelId] : null;
          const modelImage = model?.imageUrl || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null);
          return {
            ...ticket,
            _modelName: ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || model?.name || null,
            _modelImage: ticket.deviceImageUrl || modelImage || null,
            _priceItems: parsePriceItems(ticket.priceItemsJson),
          };
        }));
      } catch (e) {
        setError(e.message || 'Failed to load billing');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.finalPrice ?? item.estimatedPrice) || 0), 0),
    [items],
  );

  const renderItem = ({ item }) => {
    const trackingId = item.trackingId || item.id || emptyText;
    const deviceName = item._modelName || emptyText;
    const color = item.color || null;
    const statusKey = String(item.status || '').toUpperCase();
    const statusMeta = STATUS_META[statusKey] || { label: item.status || emptyText, color: '#4B5563', tint: '#F3F4F6', hint: '' };
    const customer = item.customerName || emptyText;
    const phone = item.customerPhone || emptyText;
    const services = item.repairServicesSummary
      || item._priceItems?.map?.((row) => row.label).filter(Boolean).join(', ')
      || emptyText;
    const amount = formatMoney(item.finalPrice ?? item.estimatedPrice);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })}
        className="bg-white rounded-2xl p-4 mb-3"
        style={cardShadow}
      >
        {/* Top row: device thumb + name + tracking + status + amount */}
        <View className="flex-row items-start">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mr-3 overflow-hidden"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            {item._modelImage ? (
              <Image source={{ uri: item._modelImage }} style={{ width: 56, height: 56 }} />
            ) : (
              <Smartphone size={26} color={BRAND_GREEN_DARK} />
            )}
          </View>
          <View className="flex-1 pr-2">
            <Text className="text-[14.5px] font-extrabold text-gray-900" numberOfLines={1}>
              {deviceName}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-[10.5px] font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>
                ID
              </Text>
              <Text className="text-[11.5px] text-gray-600 ml-1" numberOfLines={1}>
                #{trackingId}
              </Text>
              {color ? (
                <Text className="text-[11.5px] text-gray-400 ml-1.5" numberOfLines={1}>
                  • {color}
                </Text>
              ) : null}
            </View>
            <View
              className="self-start flex-row items-center px-2 py-1 rounded-full mt-2"
              style={{ backgroundColor: statusMeta.tint }}
            >
              <View
                className="w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ backgroundColor: statusMeta.color }}
              />
              <Text
                className="text-[10.5px] font-extrabold"
                style={{ color: statusMeta.color, letterSpacing: 0.2 }}
                numberOfLines={1}
              >
                {statusMeta.label}
              </Text>
            </View>
          </View>
          {amount ? (
            <View className="items-end">
              <Text className="text-[9.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.6 }}>
                Bill
              </Text>
              <Text
                className="text-[16px] font-extrabold mt-0.5"
                style={{ color: BRAND_GREEN_DARK }}
              >
                {amount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Dashed divider */}
        <View
          className="my-3"
          style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}
        />

        {/* Customer / phone */}
        <View className="flex-row items-center mb-1.5">
          <View
            className="w-6 h-6 rounded-full items-center justify-center mr-2"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            <User size={12} color={ACCENT_GREEN} />
          </View>
          <Text className="text-[12.5px] font-semibold text-gray-800 flex-1" numberOfLines={1}>
            {customer}
          </Text>
          <View
            className="w-6 h-6 rounded-full items-center justify-center mr-2 ml-2"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            <Phone size={12} color={ACCENT_GREEN} />
          </View>
          <Text className="text-[12.5px] font-semibold text-gray-800" numberOfLines={1}>
            {phone}
          </Text>
        </View>

        {/* Services */}
        <View className="flex-row items-start">
          <View
            className="w-6 h-6 rounded-full items-center justify-center mr-2 mt-0.5"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            <Wrench size={12} color={ACCENT_GREEN} />
          </View>
          <Text className="text-[12px] text-gray-600 flex-1 leading-4" numberOfLines={2}>
            {services}
          </Text>
        </View>

        {/* Quick actions */}
        <View className="flex-row mt-3">
          <Action
            icon={FileText}
            label="Details"
            onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })}
          />
          <Action
            icon={Clock}
            label="History"
            onPress={() => navigation.navigate('BookingTimeline', { ticketId: item.id })}
          />
          <Action
            icon={Receipt}
            label="Invoice"
            primary
            onPress={async () => {
              // If an invoice has already been generated for this ticket,
              // skip the generator and go straight to the Deliver Invoice
              // (from there the owner can Share or hit Edit to come back).
              try {
                const inv = await ticketApi.get(`/tickets/${item.id}/invoice`);
                if (inv?.id) {
                  navigation.navigate('DeliveryInvoiceReport', { ticketId: item.id });
                  return;
                }
              } catch (_) { /* no invoice yet — fall through */ }
              navigation.navigate('InvoiceGenerator', { ticketId: item.id });
            }}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 28,
            paddingHorizontal: 16,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <Text className="text-white text-[22px] font-extrabold">Billing & Delivery</Text>
        </LinearGradient>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      {/* Hero gradient with title + meta + search */}
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 56,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-white text-[22px] font-extrabold" style={{ letterSpacing: 0.2 }}>
              Billing & Delivery
            </Text>
            <Text className="text-white/85 text-[12px] mt-1">
              {items.length} record{items.length === 1 ? '' : 's'}
              {totalAmount > 0 ? `  •  ${formatMoney(totalAmount)} total` : ''}
            </Text>
          </View>
          <View
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <Receipt size={20} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      {/* Floating search bar overlapping the hero */}
      <View className="px-4" style={{ marginTop: -28 }}>
        <View
          className="bg-white rounded-2xl flex-row items-center px-3 py-2.5"
          style={cardShadow}
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center mr-2"
            style={{ backgroundColor: '#DCFCE7' }}
          >
            <Search size={14} color={BRAND_GREEN_DARK} />
          </View>
          <TextInput
            className="flex-1 text-[13.5px] text-gray-900"
            placeholder="Search Tracking ID, name, or mobile"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load(true)}
            returnKeyType="search"
            style={{ padding: 0 }}
          />
          {query ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { setQuery(''); load(true); }}
              className="w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: '#F1F5F9' }}
            >
              <X size={14} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {error ? (
        <View className="px-4 mt-3">
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

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[BRAND_GREEN]}
            tintColor={BRAND_GREEN}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="items-center pt-16 px-8">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <Receipt size={32} color={BRAND_GREEN_DARK} />
            </View>
            <Text className="text-[15px] font-extrabold text-gray-700">
              No billing records yet
            </Text>
            <Text className="text-[12px] text-gray-400 mt-2 text-center leading-5">
              Completed repairs ready for billing & delivery will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function Action({ icon: Icon, label, onPress, primary }) {
  if (primary) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        className="flex-1 ml-2"
        style={softShadow}
      >
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={14} color="#FFFFFF" />
          <Text className="ml-1.5 text-white text-[12.5px] font-extrabold">{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className="flex-1 mx-0.5 flex-row items-center justify-center py-2.5 rounded-xl"
      style={{
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#DCFCE7',
      }}
    >
      <Icon size={14} color={ACCENT_GREEN} />
      <Text
        className="ml-1.5 text-[12px] font-extrabold"
        style={{ color: BRAND_GREEN_DARK }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
