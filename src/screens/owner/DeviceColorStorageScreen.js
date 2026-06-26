import React, { useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { Cpu, HardDrive } from 'lucide-react-native';
import {
  AppHeader, Card, Input, BottomActionBar, FilterChipRow, ScreenContainer, useBottomBarInset,
} from '../../components/rnr';
import { tokens } from '../../theme/colors';
import { getMasterImageSource } from '../../api/masterDataImages';
import { useRamOptions, useStorageOptions } from '../../api/hooks/useMasterData';

const labelForOption = (o) => (o?.valueGb != null ? `${o.valueGb}GB` : o?.label || '');

export default function DeviceColorStorageScreen({ route, navigation }) {
  const { customer, deviceType, brand, model } = route.params || {};
  const [color, setColor] = useState('');
  const [ramOptionId, setRamOptionId] = useState(null);
  const [storageOptionId, setStorageOptionId] = useState(null);

  const { ramOptions } = useRamOptions();
  const { storageOptions } = useStorageOptions();
  const insetBottom = useBottomBarInset();

  const ramItems = (ramOptions || []).map((r) => ({ value: r.id, label: labelForOption(r) }));
  const storageItems = (storageOptions || []).map((s) => ({ value: s.id, label: labelForOption(s) }));

  const canContinue = !!ramOptionId && !!storageOptionId;

  const handleContinue = () => {
    const ram = (ramOptions || []).find((r) => r.id === ramOptionId);
    const storage = (storageOptions || []).find((s) => s.id === storageOptionId);
    navigation.navigate('DeviceServices', {
      customer,
      deviceType,
      brand,
      model,
      color,
      ramOptionId,
      storageOptionId,
      ramLabel: labelForOption(ram),
      storageLabel: labelForOption(storage),
    });
  };

  const modelImage = getMasterImageSource(model)?.uri || null;

  return (
    <ScreenContainer>
      <AppHeader title="Variant" subtitle="Pick the model variant" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insetBottom + 80 }}>
        <Card>
          <View className="flex-row items-center">
            <View className="h-14 w-14 rounded-2xl bg-surface-muted items-center justify-center overflow-hidden mr-3">
              {modelImage ? (
                <Image source={{ uri: modelImage }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <Text className="text-[16px] font-extrabold text-primary">
                  {(model?.name || '?').toString().charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-text-muted uppercase tracking-widest">Model</Text>
              <Text className="text-[15px] font-extrabold text-text" numberOfLines={1}>
                {model?.name || 'Device'}
              </Text>
              {brand?.name ? (
                <Text className="text-[11px] text-text-muted mt-0.5">{brand.name}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        <View className="mt-4">
          <Text className="text-[14px] font-extrabold text-text mb-2 px-1">Color</Text>
          <Input
            value={color}
            onChangeText={setColor}
            placeholder="e.g. Silver Shadow"
          />
        </View>

        <View className="mt-5">
          <View className="flex-row items-center mb-2 px-1">
            <Cpu size={16} color={tokens.primary} />
            <Text className="ml-2 text-[14px] font-extrabold text-text">RAM</Text>
          </View>
          <FilterChipRow
            options={ramItems}
            value={ramOptionId}
            onChange={setRamOptionId}
            className="-mx-4"
          />
        </View>

        <View className="mt-4">
          <View className="flex-row items-center mb-2 px-1">
            <HardDrive size={16} color={tokens.primary} />
            <Text className="ml-2 text-[14px] font-extrabold text-text">Storage</Text>
          </View>
          <FilterChipRow
            options={storageItems}
            value={storageOptionId}
            onChange={setStorageOptionId}
            className="-mx-4"
          />
        </View>
      </ScrollView>

      <BottomActionBar
        title="Continue"
        onPress={handleContinue}
        disabled={!canContinue}
        insetBottom={insetBottom}
      />
    </ScreenContainer>
  );
}
