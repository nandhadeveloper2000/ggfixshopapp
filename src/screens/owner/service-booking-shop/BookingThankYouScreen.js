import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../../components/rnr';

export default function BookingThankYouScreen({ navigation, route }) {
  const { customer = {}, devices = [], tickets = [] } = route?.params || {};
  const trackingId = tickets[0]?.trackingId || 'CSPEN00000000';
  const total = devices.reduce(
    (sum, d) => sum + (d.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0),
    0,
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="" onBack={() => navigation.popToTop()} />
      <ScrollView contentContainerClassName="px-4 pt-2 pb-12">
        {/* Hero card */}
        <View className="bg-text rounded-3xl px-5 py-6 mb-4" style={{ shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
          <View className="items-center mb-5">
            <View className="bg-card rounded-full p-1.5 mb-2">
              <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
            </View>
            <Text className="text-success text-2xl font-extrabold">Thank You!</Text>
            <Text className="text-white text-[12px] mt-1 opacity-80">Your booking has been placed.</Text>
            <View className="bg-success/20 px-3 py-1 rounded-full mt-2">
              <Text className="text-success text-[11px] font-extrabold">#{trackingId}</Text>
            </View>
          </View>

          <Section label="Customer Details">
            <SectionRow label="Shop Name" value={customer.shopName || 'Green Mobiles'} />
            <SectionRow label="Customer Name" value={customer.name} />
            <SectionRow label="Mobile Number" value={customer.phone} />
            <SectionRow label="Address" value={customer.address} />
          </Section>

          <Section label="Device & Repair Details">
            <View className="flex-row mb-1">
              <Text className="flex-1 text-text-muted text-[10px] uppercase tracking-widest">Device</Text>
              <Text className="flex-1 text-text-muted text-[10px] uppercase tracking-widest">Repair Services</Text>
            </View>
            {devices.map((d, i) => (
              <View key={i} className="flex-row mb-1">
                <Text className="flex-1 text-white text-[12px]" numberOfLines={2}>{i + 1}. {d.modelName}</Text>
                <Text className="flex-1 text-white text-[12px]" numberOfLines={2}>
                  {(d.services || []).map((s) => s.serviceName).join(', ')}
                </Text>
              </View>
            ))}
          </Section>

          <Section label="Service Information" noMargin>
            <SectionRow label="Tracking ID" value={`#${trackingId}`} />
            <SectionRow label="Service Status" value="Order Placed" />
            <SectionRow
              label="Estimated Repair Price"
              value={`₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            />
          </Section>
        </View>

        {/* Action tiles */}
        <View className="flex-row justify-between mt-2 px-1">
          <ActionTile
            icon="construct-outline"
            color="#A855F7"
            label="Assign Technician"
            onPress={() => navigation.navigate('AssignTechnician', { tickets, customer, devices })}
          />
          <ActionTile
            icon="share-social-outline"
            color="#3B82F6"
            label="Share Receipt"
            onPress={() => navigation.navigate('BookingSuccessful', { tickets, customer, devices })}
          />
          <ActionTile
            icon="qr-code-outline"
            color="#A855F7"
            label="Barcode Print"
            onPress={() => {
              const tid = tickets[0]?.id;
              if (tid) navigation.navigate('BarcodePrint', { ticketId: tid });
              else navigation.navigate('ScanQrCode');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ label, children, noMargin }) {
  return (
    <View className={noMargin ? '' : 'mb-4'}>
      <Text className="text-white font-extrabold text-[13px] mb-2">{label}</Text>
      <View className="bg-text-muted/20 rounded-xl p-3">{children}</View>
    </View>
  );
}

function SectionRow({ label, value }) {
  return (
    <View className="flex-row mb-1">
      <Text className="flex-1 text-text-muted text-[11px]">{label}</Text>
      <Text className="flex-1 text-[12px] text-white font-semibold">{value || '-'}</Text>
    </View>
  );
}

function ActionTile({ icon, color, label, onPress }) {
  return (
    <Pressable className="items-center flex-1 mx-1 active:opacity-80" onPress={onPress}>
      <View
        style={{ backgroundColor: color, shadowColor: color, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
        className="rounded-2xl w-14 h-14 items-center justify-center"
      >
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text className="text-text text-[11px] font-bold mt-2 text-center" numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}
