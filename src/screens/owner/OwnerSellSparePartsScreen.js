import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { notify } from '../../components/confirm';
import { uploadMedia } from '../../api/masterData';

// Preset parts by group. Each part is selectable as-is; users can also add
// a custom part via the group's "+ Add" button (which spawns an empty card
// with an Upload-Image slot and an "Enter Part Name" input).
const PRESET_GROUPS = [
  { key: 'DISPLAY',      label: 'Display Combo',  sub: 'Add main & sub screen',      icon: 'phone-portrait-outline', accent: '#16A34A', tint: '#ECFDF3', slotBg: '#F4FBF6', border: '#86EFAC', parts: ['Main Screen Display Combo', 'Sub Screen Display Combo'] },
  { key: 'MOTHERBOARD',  label: 'Motherboard',    sub: 'Add motherboard & variants', icon: 'hardware-chip-outline',  accent: '#7C3AED', tint: '#F5F3FF', slotBg: '#FAF9FF', border: '#DDD6FE', parts: ['Motherboard 16GB / 512GB', 'Battery'] },
  { key: 'FRONT_CAMERA', label: 'Front Camera',   sub: 'Add front camera',           icon: 'camera-outline',         accent: '#2563EB', tint: '#EFF6FF', slotBg: '#F5F9FF', border: '#BFDBFE', parts: ['Front Camera'] },
  { key: 'BACK_CAMERA',  label: "Back Camera's",  sub: 'Add back camera',            icon: 'camera-reverse-outline', accent: '#EA580C', tint: '#FFF7ED', slotBg: '#FFFBF5', border: '#FED7AA', parts: ['Back Main Camera'] },
  { key: 'MORE',         label: 'More Items',     sub: 'Add other components',       icon: 'apps-outline',           accent: '#0D9488', tint: '#F0FDFA', slotBg: '#F5FEFC', border: '#99F6E4', parts: ['Side Frame', 'Back Panel (Backshell)', 'charging sub board', 'sim tray', 'loudspeaker'] },
];

let nextCustomId = 1;
const makeId = () => `custom-${nextCustomId++}`;

export default function OwnerSellSparePartsScreen({ navigation }) {
  // Selected preset part names per group (Set).
  const [presetSel, setPresetSel] = useState({});
  // Uploaded image per preset part: { [groupKey]: { [partName]: url } }
  const [presetImages, setPresetImages] = useState({});
  // Custom additions per group: { [groupKey]: [{ id, name, imageUrl }] }
  const [customs, setCustoms] = useState({});
  // Slot key currently uploading, e.g. "DISPLAY/preset/Main Screen…" or "DISPLAY/custom-1".
  const [uploading, setUploading] = useState(null);
  const insets = useSafeAreaInsets();

  const togglePreset = (groupKey, partName) => {
    setPresetSel((prev) => {
      const set = new Set(prev[groupKey] || []);
      if (set.has(partName)) set.delete(partName); else set.add(partName);
      return { ...prev, [groupKey]: set };
    });
  };

  const pickPresetImage = async (groupKey, partName) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      notify('Permission needed', 'Allow media library access to attach photos.');
      return;
    }
    const slotKey = `${groupKey}/preset/${partName}`;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(slotKey);
      const url = await uploadMedia(result.assets[0], 'spare-parts');
      if (!url) throw new Error('Upload returned no URL');
      setPresetImages((prev) => ({
        ...prev,
        [groupKey]: { ...(prev[groupKey] || {}), [partName]: url },
      }));
      // Uploading implies the user wants to sell this part — auto-select it.
      setPresetSel((prev) => {
        const set = new Set(prev[groupKey] || []);
        set.add(partName);
        return { ...prev, [groupKey]: set };
      });
    } catch (e) {
      notify('Upload failed', e?.message || 'Try again');
    } finally {
      setUploading(null);
    }
  };

  const removePresetImage = (groupKey, partName) => {
    setPresetImages((prev) => {
      const next = { ...(prev[groupKey] || {}) };
      delete next[partName];
      return { ...prev, [groupKey]: next };
    });
  };

  const addCustomSlot = (groupKey) => {
    setCustoms((prev) => ({
      ...prev,
      [groupKey]: [...(prev[groupKey] || []), { id: makeId(), name: '', imageUrl: '' }],
    }));
  };

  const updateCustom = (groupKey, id, patch) => {
    setCustoms((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeCustom = (groupKey, id) => {
    setCustoms((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] || []).filter((c) => c.id !== id),
    }));
  };

  const pickCustomImage = async (groupKey, id) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      notify('Permission needed', 'Allow media library access to attach photos.');
      return;
    }
    const slotKey = `${groupKey}/${id}`;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(slotKey);
      const url = await uploadMedia(result.assets[0], 'spare-parts');
      if (!url) throw new Error('Upload returned no URL');
      updateCustom(groupKey, id, { imageUrl: url });
    } catch (e) {
      notify('Upload failed', e?.message || 'Try again');
    } finally {
      setUploading(null);
    }
  };

  const { totalSelected, items, allImages } = useMemo(() => {
    const all = [];
    const imgs = [];
    PRESET_GROUPS.forEach((g) => {
      (presetSel[g.key] ? Array.from(presetSel[g.key]) : []).forEach((name) => {
        const url = presetImages[g.key]?.[name] || null;
        all.push({ groupKey: g.key, group: g.label, partName: name, imageUrl: url, custom: false });
        if (url) imgs.push(url);
      });
      (customs[g.key] || []).forEach((c) => {
        if (!c.name?.trim() && !c.imageUrl) return; // skip empty drafts
        all.push({ groupKey: g.key, group: g.label, partName: c.name?.trim() || 'Custom part', imageUrl: c.imageUrl || null, custom: true });
        if (c.imageUrl) imgs.push(c.imageUrl);
      });
    });
    return { totalSelected: all.length, items: all, allImages: imgs };
  }, [presetSel, presetImages, customs]);

  const onSellNow = () => {
    if (totalSelected === 0) return;
    // Roll image URLs into the `images` shape the price screen expects.
    const imagesObj = {};
    allImages.slice(0, 5).forEach((url, i) => { imagesObj[`p${i + 1}`] = url; });
    navigation.navigate('OwnerSellGadgetPrice', {
      flow: 'OWNER_LIST',
      descriptionType: 'SPARE_PARTS',
      spareParts: items,
      images: imagesObj,
    });
  };

  const disabled = totalSelected === 0 || !!uploading;

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7F9' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: '#DCFCE7',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#15803D" />
          </Pressable>
          <Text
            style={{
              flex: 1, textAlign: 'center',
              fontSize: 20, fontWeight: '800', color: '#0F172A',
              marginRight: 44,
            }}
          >
            Spare Parts
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }}>
        {PRESET_GROUPS.map((g) => {
          const presetSet = presetSel[g.key];
          const customList = customs[g.key] || [];
          const cardCount = (presetSet?.size || 0) + customList.length;
          return (
            <View
              key={g.key}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 14,
                marginBottom: 14,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              {/* Group header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: g.tint,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}
                >
                  <Ionicons name={g.icon} size={20} color={g.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{g.label}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{g.sub}</Text>
                </View>
                <Pressable
                  onPress={() => addCustomSlot(g.key)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#16A34A',
                    borderRadius: 999,
                    paddingHorizontal: 14, paddingVertical: 8,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 4 }}>Add</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
                {/* Preset parts */}
                {g.parts.map((name) => {
                  const active = presetSet?.has(name);
                  const imageUrl = presetImages[g.key]?.[name];
                  const slotKey = `${g.key}/preset/${name}`;
                  const busy = uploading === slotKey;
                  return (
                    <View key={name} style={{ width: '50%', paddingHorizontal: 5, marginBottom: 10 }}>
                      {/* Image area — tap to upload (or replace). */}
                      <Pressable
                        onPress={() => pickPresetImage(g.key, name)}
                        disabled={busy}
                        style={{
                          height: 132, borderRadius: 16,
                          borderWidth: 1.5, borderStyle: 'dashed',
                          borderColor: g.border,
                          backgroundColor: g.slotBg,
                          overflow: 'hidden',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator color={g.accent} />
                        ) : imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View style={{ alignItems: 'center' }}>
                            <Ionicons name={g.icon} size={34} color={g.accent} />
                            <Ionicons name="cloud-upload-outline" size={20} color={g.accent} style={{ marginTop: 8 }} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: g.accent, marginTop: 4 }}>Upload image</Text>
                          </View>
                        )}
                        {active ? (
                          <View style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: g.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="checkmark" size={13} color="#fff" />
                          </View>
                        ) : null}
                        {imageUrl ? (
                          <Pressable
                            onPress={() => removePresetImage(g.key, name)}
                            style={{ position: 'absolute', left: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                            hitSlop={6}
                          >
                            <Ionicons name="close" size={12} color="#fff" />
                          </Pressable>
                        ) : null}
                      </Pressable>
                      {/* Label area — tap to toggle selection. */}
                      <Pressable
                        onPress={() => togglePreset(g.key, name)}
                        style={{
                          borderRadius: 12, borderWidth: 1,
                          borderColor: active ? g.accent : '#E5E7EB',
                          backgroundColor: active ? g.tint : '#FFFFFF',
                          marginTop: 8, paddingHorizontal: 10, paddingVertical: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{ fontSize: 13, fontWeight: active ? '800' : '700', color: active ? g.accent : '#0F172A', textAlign: 'center' }}
                          numberOfLines={2}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}

                {/* Custom parts */}
                {customList.map((c) => {
                  const slotKey = `${g.key}/${c.id}`;
                  const busy = uploading === slotKey;
                  return (
                    <View key={c.id} style={{ width: '50%', paddingHorizontal: 5, marginBottom: 10 }}>
                      <Pressable
                        onPress={() => pickCustomImage(g.key, c.id)}
                        disabled={busy}
                        style={{
                          height: 132, borderRadius: 16,
                          borderWidth: 1.5, borderStyle: 'dashed',
                          borderColor: g.border,
                          backgroundColor: g.slotBg,
                          overflow: 'hidden',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator color={g.accent} />
                        ) : c.imageUrl ? (
                          <Image source={{ uri: c.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View style={{ alignItems: 'center' }}>
                            <Ionicons name={g.icon} size={34} color={g.accent} />
                            <Ionicons name="cloud-upload-outline" size={20} color={g.accent} style={{ marginTop: 8 }} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: g.accent, marginTop: 4 }}>Upload image</Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => removeCustom(g.key, c.id)}
                          style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={12} color="#fff" />
                        </Pressable>
                      </Pressable>
                      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                        <TextInput
                          placeholder="Enter Part Name"
                          placeholderTextColor="#94A3B8"
                          value={c.name}
                          onChangeText={(v) => updateCustom(g.key, c.id, { name: v })}
                          style={{ color: '#0F172A', fontSize: 13, fontWeight: '700', paddingVertical: 2, textAlign: 'center' }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              {cardCount > 0 ? (
                <Text style={{ fontSize: 11, color: g.accent, fontWeight: '700', marginTop: 2 }}>
                  {cardCount} item{cardCount === 1 ? '' : 's'} selected
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: 16, paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1, borderTopColor: '#EEF0F3',
          shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
        }}
      >
        <Pressable
          onPress={onSellNow}
          disabled={disabled}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: disabled ? '#9CA3AF' : '#16A34A',
            borderRadius: 999, paddingVertical: 16,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginRight: 6 }}>
            Sell Now{totalSelected ? ` (${totalSelected})` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
