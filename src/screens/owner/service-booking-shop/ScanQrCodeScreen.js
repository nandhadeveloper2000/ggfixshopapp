import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../../components/rnr';

export default function ScanQrCodeScreen({ navigation }) {
  const purple = '#7C3AED';
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Scan your QR Code" onBack={() => navigation.goBack()} />
      <View className="flex-1 items-center justify-center px-6">
        <View className="relative" style={{ width: 280, height: 280 }}>
          {/* corner brackets */}
          {[0, 1, 2, 3].map((i) => {
            const top = i < 2 ? 0 : null;
            const bottom = i >= 2 ? 0 : null;
            const left = i % 2 === 0 ? 0 : null;
            const right = i % 2 === 1 ? 0 : null;
            const borders = {
              borderTopWidth: i < 2 ? 4 : 0,
              borderBottomWidth: i >= 2 ? 4 : 0,
              borderLeftWidth: i % 2 === 0 ? 4 : 0,
              borderRightWidth: i % 2 === 1 ? 4 : 0,
            };
            return (
              <View
                key={i}
                style={{ position: 'absolute', top, bottom, left, right, width: 36, height: 36, borderColor: purple, ...borders }}
              />
            );
          })}
          <View className="absolute inset-4 bg-card items-center justify-center">
            <Ionicons name="qr-code" size={180} color="#0F172A" />
          </View>
        </View>
        <Pressable className="mt-10 items-center">
          <View style={{ backgroundColor: purple }} className="w-14 h-14 rounded-full items-center justify-center">
            <Ionicons name="image" size={26} color="#fff" />
          </View>
          <Text className="text-text mt-2 font-semibold">Upload QR</Text>
        </Pressable>
      </View>
    </View>
  );
}
