import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, ScreenHeader } from '../../components/rnr';
import { notify } from '../../components/confirm';
import { uploadMedia } from '../../api/masterData';

// Preset parts by group. Each part is selectable as-is; users can also add
// a custom part via the group's "+ Add" button (which spawns an empty card
// with an Upload-Image slot and an "Enter Part Name" input).
const PRESET_GROUPS = [
  { key: 'DISPLAY',      label: 'Display Combo',  icon: 'phone-portrait-outline', parts: ['Main Screen Display Combo', 'Sub Screen Display Combo'] },
  { key: 'MOTHERBOARD',  label: 'Motherboard',    icon: 'hardware-chip-outline',  parts: ['Motherboard 16GB / 512GB', 'Battery'] },
  { key: 'FRONT_CAMERA', label: 'Front Camera',   icon: 'camera-outline',         parts: ['Front Camera'] },
  { key: 'BACK_CAMERA',  label: "Back Camera's",  icon: 'camera-reverse-outline', parts: ['Back Main Camera'] },
  { key: 'MORE',         label: 'More Items',     icon: 'apps-outline',           parts: ['Side Frame', 'Back Panel (Backshell)', 'charging sub board', 'sim tray', 'loudspeaker'] },
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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Spare Parts" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>
        {PRESET_GROUPS.map((g) => {
          const presetSet = presetSel[g.key];
          const customList = customs[g.key] || [];
          const cardCount = (presetSet?.size || 0) + customList.length;
          return (
            <View key={g.key} className="mb-3">
              {/* Group header */}
              <View className="flex-row items-center mb-2 px-1">
                <View className="h-7 w-7 rounded-lg bg-primary/10 items-center justify-center mr-2">
                  <Ionicons name={g.icon} size={14} color="#00008B" />
                </View>
                <Text className="flex-1 font-extrabold text-text text-[13px]">{g.label}</Text>
                <Pressable
                  onPress={() => addCustomSlot(g.key)}
                  className="flex-row items-center bg-primary/90 rounded-full px-3 py-1.5 active:opacity-80"
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text className="text-white text-[11px] font-extrabold ml-1">Add</Text>
                </Pressable>
              </View>

              <View className="flex-row flex-wrap -mx-1">
                {/* Preset parts */}
                {g.parts.map((name) => {
                  const active = presetSet?.has(name);
                  const imageUrl = presetImages[g.key]?.[name];
                  const slotKey = `${g.key}/preset/${name}`;
                  const busy = uploading === slotKey;
                  return (
                    <View key={name} className="px-1 mb-2.5" style={{ width: '50%' }}>
                      {/* Image area — tap to upload (or replace). */}
                      <Pressable
                        onPress={() => pickPresetImage(g.key, name)}
                        disabled={busy}
                        className={`rounded-xl border border-dashed overflow-hidden ${active ? 'border-primary' : 'border-primary/40'}`}
                        style={{ height: 90, backgroundColor: '#F8FAFC' }}
                      >
                        {busy ? (
                          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#00008B" /></View>
                        ) : imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name={g.icon} size={26} color="#94A3B8" />
                            <View className="flex-row items-center mt-1">
                              <Ionicons name="cloud-upload-outline" size={11} color="#10B981" />
                              <Text className="text-[9px] text-text-muted ml-0.5">Upload image</Text>
                            </View>
                          </View>
                        )}
                        {active ? (
                          <View className="absolute right-1.5 top-1.5 h-5 w-5 rounded-full bg-primary items-center justify-center">
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        ) : null}
                        {imageUrl ? (
                          <Pressable
                            onPress={() => removePresetImage(g.key, name)}
                            className="absolute left-1 top-1 h-5 w-5 rounded-full items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                            hitSlop={6}
                          >
                            <Ionicons name="close" size={11} color="#fff" />
                          </Pressable>
                        ) : null}
                      </Pressable>
                      {/* Label area — tap to toggle selection. */}
                      <Pressable
                        onPress={() => togglePreset(g.key, name)}
                        className={`rounded-md border ${active ? 'border-primary bg-primary/5' : 'border-border bg-card'} mt-1 px-2 py-1 active:opacity-80`}
                      >
                        <Text className={`text-[11px] ${active ? 'text-primary font-extrabold' : 'text-text font-semibold'}`} numberOfLines={2}>
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
                    <View key={c.id} className="px-1 mb-2.5" style={{ width: '50%' }}>
                      <Pressable
                        onPress={() => pickCustomImage(g.key, c.id)}
                        disabled={busy}
                        className="rounded-xl border border-dashed border-primary/40 overflow-hidden"
                        style={{ height: 90, backgroundColor: '#F8FAFC' }}
                      >
                        {busy ? (
                          <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color="#00008B" />
                          </View>
                        ) : c.imageUrl ? (
                          <Image source={{ uri: c.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <View className="bg-success/15 rounded-full p-2">
                              <Ionicons name="cloud-upload-outline" size={20} color="#10B981" />
                            </View>
                            <Text className="text-[10px] text-text-muted mt-1">Upload Image</Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => removeCustom(g.key, c.id)}
                          className="absolute right-1 top-1 h-5 w-5 rounded-full items-center justify-center"
                          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={11} color="#fff" />
                        </Pressable>
                      </Pressable>
                      <View className="bg-card border border-border rounded-md mt-1 px-2 py-1">
                        <TextInput
                          placeholder="Enter Part Name"
                          placeholderTextColor="#94A3B8"
                          value={c.name}
                          onChangeText={(v) => updateCustom(g.key, c.id, { name: v })}
                          className="text-text text-[11px] font-semibold"
                          style={{ paddingVertical: 2 }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              {cardCount > 0 ? (
                <Text className="text-[10px] text-text-muted px-1 -mt-1">{cardCount} item{cardCount === 1 ? '' : 's'} in {g.label}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 p-4 bg-card border-t border-border" style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
        <Button
          onPress={onSellNow}
          disabled={totalSelected === 0 || !!uploading}
          className="bg-success"
          rightIcon={<Ionicons name="chevron-forward" size={18} color="#fff" />}
        >
          Sell Now{totalSelected ? ` (${totalSelected})` : ''}
        </Button>
      </View>
    </View>
  );
}
