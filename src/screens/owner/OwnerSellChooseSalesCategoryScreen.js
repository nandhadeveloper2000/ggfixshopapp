import React from 'react';
import { View, Text, Pressable, ScrollView, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Smartphone,
  Laptop,
  Watch,
  Tablet,
  Headphones,
  Wrench,
  ChevronRight,
} from 'lucide-react-native';

const ICONS_BY_CODE = {
  MOBILE: Smartphone,
  SMARTPHONE: Smartphone,
  LAPTOP: Laptop,
  TABLET: Tablet,
  SMARTWATCH: Watch,
  SMARTWATCHES: Watch,
  AUDIO: Headphones,
  AUDIO_DEVICES: Headphones,
};

export default function OwnerSellChooseSalesCategoryScreen({ navigation, route }) {
  const params = route?.params || {};
  const { categoryCode, categoryName, modelName, modelImageUrl } = params;
  const DeviceIcon = ICONS_BY_CODE[(categoryCode || '').toUpperCase()] || Smartphone;

  const tiles = [
    {
      key: 'device',
      title: categoryName || 'Mobile',
      sub: `List the whole ${(categoryName || 'device').toLowerCase()} for sale`,
      tag: 'Best Value',
      Icon: DeviceIcon,
      accent: '#16A34A',
      tint: '#F0FDF4',
      onPress: () => navigation.navigate('SelectVariant', params),
    },
    {
      key: 'parts',
      title: 'Spare Parts',
      sub: 'List individual parts (display, battery, camera…)',
      tag: 'Quick Sell',
      Icon: Wrench,
      accent: '#7C3AED',
      tint: '#F5F3FF',
      onPress: () => navigation.navigate('OwnerSellSpareParts', params),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6FA' }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Hero */}
      <LinearGradient
        colors={['#16A34A', '#22C55E']}
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 22,
          borderBottomLeftRadius: 22,
          borderBottomRightRadius: 22,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 }}>
              Sell on ggfix
            </Text>
            <Text style={{ fontSize: 12, color: '#DCFCE7', marginTop: 2 }}>
              Reach nearby buyers in minutes
            </Text>
          </View>
          <View
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="pricetag" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Promo strip inside hero */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.14)',
            paddingHorizontal: 12, paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <View
            style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#FFFFFF',
              alignItems: 'center', justifyContent: 'center', marginRight: 10,
            }}
          >
            <Ionicons name="flash" size={14} color="#16A34A" />
          </View>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            Zero commission on first 10 listings
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18 }}>
        {modelName ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 12,
              marginBottom: 18,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 56, height: 56, borderRadius: 14,
                backgroundColor: '#F0FDF4',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 12, overflow: 'hidden',
              }}
            >
              {modelImageUrl ? (
                <Image source={{ uri: modelImageUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              ) : (
                <DeviceIcon size={26} color="#16A34A" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: '#94A3B8', textTransform: 'uppercase' }}>
                Selected
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 }} numberOfLines={1}>
                {modelName}
              </Text>
              {categoryName ? (
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                    backgroundColor: '#F0FDF4',
                    paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 999, marginTop: 4,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={11} color="#16A34A" />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A', marginLeft: 4 }}>
                    {categoryName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text
          style={{
            fontSize: 11, fontWeight: '800',
            color: '#94A3B8',
            letterSpacing: 1,
            marginBottom: 12,
            textTransform: 'uppercase',
          }}
        >
          What are you selling?
        </Text>

        {tiles.map((t) => {
          const Icon = t.Icon;
          return (
            <Pressable
              key={t.key}
              onPress={t.onPress}
              style={({ pressed }) => [
                {
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  elevation: 2,
                  opacity: pressed ? 0.85 : 1,
                  borderLeftWidth: 4,
                  borderLeftColor: t.accent,
                },
              ]}
            >
              <View
                style={{
                  width: 60, height: 60, borderRadius: 16,
                  backgroundColor: t.tint,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Icon size={28} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{t.title}</Text>
                  <View
                    style={{
                      marginLeft: 8,
                      backgroundColor: t.tint,
                      paddingHorizontal: 6, paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: t.accent, letterSpacing: 0.3 }}>
                      {t.tag}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 17 }} numberOfLines={2}>
                  {t.sub}
                </Text>
              </View>
              <View
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: t.tint,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={16} color={t.accent} />
              </View>
            </Pressable>
          );
        })}

        {/* Why sell with us footer */}
        <View
          style={{
            marginTop: 8,
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 14,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <Text
            style={{
              fontSize: 11, fontWeight: '800', color: '#94A3B8',
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
            }}
          >
            Why sell on ggfix
          </Text>

          {[
            { icon: 'shield-checkmark', color: '#16A34A', text: 'Verified buyers in your area' },
            { icon: 'cash', color: '#F59E0B', text: 'Get paid quickly & safely' },
            { icon: 'rocket', color: '#7C3AED', text: 'Listing live in under a minute' },
          ].map((row) => (
            <View key={row.icon} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: row.color + '20',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Ionicons name={row.icon} size={14} color={row.color} />
              </View>
              <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>{row.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
