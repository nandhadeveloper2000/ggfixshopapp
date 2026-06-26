import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Store,
  Wrench,
  MapPin,
  Camera,
  Smartphone,
  Apple,
  CalendarDays,
  Pencil,
  Eye,
  CheckCircle2,
  Save,
  Image as ImageIcon,
} from 'lucide-react-native';
import { fetchMe, updateOwnerShop } from '../../api/auth';
import { getSession } from '../../auth/session';
import { uploadMedia } from '../../api/masterData';
import { notify } from '../../components/confirm';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN     = '#16A34A';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const ANDROID_SERVICES = [
  'Screen Repair',
  'Display Replacement',
  'Battery Replacement',
  'Charging Port Repair',
  'Camera Repair',
  'Water Damage Repair',
  'Audio Repair',
  'Button Repair',
  'Software Issues',
  'Data Recovery',
  'Phone Unlocking',
];

const APPLE_SERVICES = ANDROID_SERVICES;

export default function OwnerShopInfoScreen({ navigation }) {
  const [ownerId, setOwnerId] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopSince, setShopSince] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const session = (await fetchMe().catch(() => null)) || (await getSession());
      const fullShop = session?.activeShop || null;
      setOwnerId(session?.userId || null);
      setShopId(fullShop?.id || null);
      if (fullShop) {
        setShopName(fullShop.name || '');
        setShopSince(fullShop.createdAt ? new Date(fullShop.createdAt).getFullYear().toString() : '');
        setAddressLine([fullShop.street, fullShop.address].filter(Boolean).join(', '));
        setCity(fullShop.area || fullShop.taluk || '');
        setDistrict(fullShop.district || '');
        setState(fullShop.state || '');
        setPincode(fullShop.pincode || '');
        setFrontImageUrl(fullShop.frontImageUrl || '');
        setBannerImageUrl(fullShop.bannerImageUrl || '');

        // Rehydrate the Android / Apple service toggles from the saved JSON
        // snapshot. NULL = first time on this screen → keep the default
        // "all selected" so the owner sees the full list and can deselect.
        try {
          const parsed = fullShop.serviceCategoriesJson
            ? JSON.parse(fullShop.serviceCategoriesJson)
            : null;
          if (parsed && (parsed.android || parsed.apple)) {
            const a = new Set(Array.isArray(parsed.android) ? parsed.android : []);
            const b = new Set(Array.isArray(parsed.apple) ? parsed.apple : []);
            setAndroidSelected(
              Object.fromEntries(ANDROID_SERVICES.map((s) => [s, a.has(s)])),
            );
            setAppleSelected(
              Object.fromEntries(APPLE_SERVICES.map((s) => [s, b.has(s)])),
            );
          }
        } catch (_) { /* malformed JSON — fall back to defaults */ }

        const looksComplete = !!(fullShop.name && (fullShop.address || fullShop.street) && fullShop.frontImageUrl);
        setEditing(!looksComplete);
      } else {
        setEditing(true);
      }
      setHydrated(true);
    })();
  }, []);

  const pickAndUpload = async (slot) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      notify('Permission needed', 'Allow photo library access to upload shop images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: slot === 'banner' ? [16, 9] : [1, 1],
      quality: 0.75,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const setBusy = slot === 'banner' ? setUploadingBanner : setUploadingFront;
    const setUrl = slot === 'banner' ? setBannerImageUrl : setFrontImageUrl;
    setBusy(true);
    try {
      const url = await uploadMedia(result.assets[0], `shops/${slot}`);
      if (!url) throw new Error('Upload returned no URL');
      setUrl(url);
    } catch (e) {
      notify('Upload failed', e?.message || 'Could not upload image. Try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!ownerId || !shopId) {
      notify('Not ready', 'Could not resolve your shop. Pull to refresh and try again.', { preset: 'error' });
      return;
    }
    if (!frontImageUrl || !bannerImageUrl) {
      notify('Photos required', 'Please upload both shop front view and shop banner / visiting card.');
      return;
    }
    setSaving(true);
    try {
      // Persist selected Android / Apple categories as an opaque JSON snapshot
      // so the View tab shows exactly what the owner chose. Without this the
      // server returned NULL on next load and the toggles snapped back to
      // "all selected" — the bug the owner reported.
      const serviceCategoriesJson = JSON.stringify({
        android: ANDROID_SERVICES.filter((s) => androidSelected[s]),
        apple:   APPLE_SERVICES.filter((s) => appleSelected[s]),
      });
      await updateOwnerShop(ownerId, shopId, {
        name: shopName,
        address: addressLine,
        area: city,
        district,
        state,
        pincode,
        frontImageUrl,
        bannerImageUrl,
        serviceCategoriesJson,
      });
      await fetchMe().catch(() => null);
      setEditing(false);
    } catch (e) {
      notify('Save failed', e?.message || 'Could not save. Try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const [androidSelected, setAndroidSelected] = useState(
    Object.fromEntries(ANDROID_SERVICES.map((s) => [s, true])),
  );
  const [appleSelected, setAppleSelected] = useState(
    Object.fromEntries(APPLE_SERVICES.map((s) => [s, true])),
  );

  const toggleAndroid = (key) =>
    setAndroidSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleApple = (key) =>
    setAppleSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const fullAddress = useMemo(() => {
    const parts = [addressLine, city, district, state, pincode].filter(Boolean);
    return parts.join(', ');
  }, [addressLine, city, district, state, pincode]);

  const activeAndroid = ANDROID_SERVICES.filter((s) => androidSelected[s]);
  const activeApple = APPLE_SERVICES.filter((s) => appleSelected[s]);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#F4FBF6' }}>
        <ActivityIndicator size="large" color={BRAND_GREEN_DARK} />
      </View>
    );
  }

  // Shared green hero — slim single row + edit/view chip.
  const renderHero = () => (
    <SafeAreaView edges={['top']} style={{ backgroundColor: BRAND_GREEN_DARK }}>
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 6, paddingBottom: 14, paddingHorizontal: 16 }}
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
            Shop Information
          </Text>
          <Pressable
            onPress={() => setEditing((v) => !v)}
            hitSlop={6}
            className="px-2.5 py-1 rounded-full flex-row items-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            {editing ? <Eye size={12} color="#FFFFFF" /> : <Pencil size={12} color="#FFFFFF" />}
            <Text className="ml-1 text-white text-[10.5px] font-extrabold">
              {editing ? 'PREVIEW' : 'EDIT'}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />
      {renderHero()}

      {!editing ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
        >
          {/* Identity card */}
          <View className="bg-white rounded-2xl p-4 flex-row items-center" style={cardShadow}>
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mr-3 overflow-hidden"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              {frontImageUrl ? (
                <Image source={{ uri: frontImageUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              ) : (
                <Store size={24} color={BRAND_GREEN_DARK} />
              )}
            </View>
            <View className="flex-1">
              <Text
                className="text-[10.5px] font-extrabold uppercase"
                style={{ color: BRAND_GREEN_DARK, letterSpacing: 1 }}
              >
                Shop
              </Text>
              <Text className="text-[16px] font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                {shopName || '—'}
              </Text>
              {shopSince ? (
                <View className="flex-row items-center mt-1">
                  <CalendarDays size={11} color="#94A3B8" />
                  <Text className="ml-1 text-[11px] text-gray-500">Since {shopSince}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Repair categories */}
          <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
            <SectionHeader Icon={Wrench} label="REPAIR SERVICE CATEGORIES" />
            <View className="flex-row -mx-1">
              <CategoryColumn
                title="Android Repair"
                sub="Mobile / Tablet"
                Icon={Smartphone}
                items={activeAndroid}
              />
              <CategoryColumn
                title="Apple Repair"
                sub="iPhone / Tablet"
                Icon={Apple}
                items={activeApple}
              />
            </View>
          </View>

          {/* Address */}
          <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
            <SectionHeader Icon={MapPin} label="SHOP ADDRESS" />
            <View
              className="rounded-2xl p-3 flex-row items-start"
              style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                <MapPin size={16} color="#FFFFFF" />
              </View>
              <Text
                className="flex-1 text-[12.5px] font-semibold text-gray-800 leading-5"
                numberOfLines={5}
              >
                {fullAddress || '—'}
              </Text>
            </View>
          </View>

          {/* Photos */}
          <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  className="w-7 h-7 rounded-full items-center justify-center mr-2"
                  style={{ backgroundColor: '#DCFCE7' }}
                >
                  <Camera size={14} color={BRAND_GREEN_DARK} />
                </View>
                <Text
                  className="text-[11px] font-extrabold tracking-widest"
                  style={{ color: BRAND_GREEN_DARK, letterSpacing: 1.3 }}
                >
                  SHOP PHOTOS
                </Text>
                <Text className="text-[12px] ml-1" style={{ color: '#DC2626' }}>*</Text>
              </View>
              {(!frontImageUrl || !bannerImageUrl) ? (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#FEE2E2' }}
                >
                  <Text className="text-[9.5px] font-extrabold" style={{ color: '#B91C1C' }}>
                    Both required
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row -mx-1">
              <PhotoPreview label="Front View" uri={frontImageUrl} />
              <PhotoPreview label="Banner / Visiting Card" uri={bannerImageUrl} />
            </View>
          </View>

          {/* Edit CTA */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setEditing(true)}
            className="mt-4"
            style={cardShadow}
          >
            <LinearGradient
              colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pencil size={16} color="#FFFFFF" />
              <Text className="ml-2 text-white text-[14px] font-extrabold">
                Edit Shop Information
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
          >
            {/* Basic Info */}
            <View className="bg-white rounded-2xl p-4" style={cardShadow}>
              <SectionHeader Icon={Store} label="BASIC SHOP INFO" />
              <Field label="Shop name" value={shopName} onChangeText={setShopName} />
              <Field
                label="Shop Since (year)"
                value={shopSince}
                onChangeText={setShopSince}
                keyboardType="number-pad"
                last
              />
            </View>

            {/* Repair Categories (edit mode) */}
            <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
              <SectionHeader Icon={Wrench} label="REPAIR SERVICE CATEGORIES" />
              <View className="flex-row -mx-1">
                <CategoryColumnEdit
                  title="Android"
                  sub="Mobile / Tablet"
                  Icon={Smartphone}
                  items={ANDROID_SERVICES}
                  selected={androidSelected}
                  onToggle={toggleAndroid}
                />
                <CategoryColumnEdit
                  title="Apple"
                  sub="iPhone / Tablet"
                  Icon={Apple}
                  items={APPLE_SERVICES}
                  selected={appleSelected}
                  onToggle={toggleApple}
                />
              </View>
            </View>

            {/* Address */}
            <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
              <SectionHeader Icon={MapPin} label="SHOP ADDRESS" />
              <Field label="Address" value={addressLine} onChangeText={setAddressLine} />
              <View className="flex-row">
                <Field small label="Area / City" value={city} onChangeText={setCity} />
                <Field small last label="District" value={district} onChangeText={setDistrict} />
              </View>
              <View className="flex-row">
                <Field small label="State" value={state} onChangeText={setState} />
                <Field
                  small
                  last
                  label="Pincode"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Photos */}
            <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
              <SectionHeader Icon={Camera} label="SHOP PHOTOS" />
              <Text className="text-[11px] text-gray-500 mb-3 leading-4">
                Both photos are required to publish your shop. Front view should be a
                square; banner / visiting card works best in 16:9.
              </Text>
              <View className="flex-row -mx-1">
                <PhotoUpload
                  label="Shop Front View"
                  url={frontImageUrl}
                  busy={uploadingFront}
                  onPress={() => pickAndUpload('front')}
                />
                <PhotoUpload
                  label="Shop Banner / Visiting Card"
                  url={bannerImageUrl}
                  busy={uploadingBanner}
                  onPress={() => pickAndUpload('banner')}
                />
              </View>
            </View>
          </ScrollView>

          {/* Sticky save bar */}
          <View
            className="absolute left-0 right-0 bottom-0 px-4 pt-3"
            style={{
              paddingBottom: 16,
              backgroundColor: 'rgba(244,251,246,0.96)',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={saving}
              onPress={handleSave}
              style={cardShadow}
            >
              <LinearGradient
                colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 18,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Save size={18} color="#FFFFFF" />
                )}
                <Text className="ml-2 text-white text-[15px] font-extrabold">
                  {saving ? 'Saving...' : 'Save Shop Details'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ Icon, label }) {
  return (
    <View className="flex-row items-center mb-3">
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: '#DCFCE7' }}
      >
        <Icon size={14} color={BRAND_GREEN_DARK} />
      </View>
      <Text
        className="text-[11px] font-extrabold tracking-widest"
        style={{ color: BRAND_GREEN_DARK, letterSpacing: 1.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

function CategoryColumn({ title, sub, Icon, items }) {
  return (
    <View
      style={{ flex: 1, marginHorizontal: 4, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' }}
      >
        <Icon size={16} color="#FFFFFF" />
        <Text className="text-white text-[12.5px] font-extrabold mt-1" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-white/85 text-[10px]">{sub}</Text>
      </LinearGradient>
      <View style={{ padding: 10 }}>
        {items.length === 0 ? (
          <Text className="text-[11px] text-gray-400 text-center py-2">No services</Text>
        ) : items.map((s) => (
          <View
            key={s}
            className="flex-row items-center py-1.5"
          >
            <CheckCircle2 size={11} color={BRAND_GREEN_DARK} />
            <Text className="ml-1.5 text-[11.5px] text-gray-700 flex-1" numberOfLines={1}>
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CategoryColumnEdit({ title, sub, Icon, items, selected, onToggle }) {
  return (
    <View
      style={{ flex: 1, marginHorizontal: 4, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' }}
      >
        <Icon size={16} color="#FFFFFF" />
        <Text className="text-white text-[12.5px] font-extrabold mt-1">{title}</Text>
        <Text className="text-white/85 text-[10px]">{sub}</Text>
      </LinearGradient>
      <View style={{ padding: 8 }}>
        {items.map((name) => {
          const active = !!selected[name];
          return (
            <Pressable
              key={name}
              onPress={() => onToggle(name)}
              className="flex-row items-center px-1 py-1.5"
            >
              <View
                style={{
                  width: 16, height: 16, borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: active ? BRAND_GREEN_DARK : '#CBD5E1',
                  backgroundColor: active ? BRAND_GREEN_DARK : '#FFFFFF',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 6,
                }}
              >
                {active ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} /> : null}
              </View>
              <Text
                className="text-[11px] flex-1"
                style={{ color: active ? '#111827' : '#94A3B8' }}
                numberOfLines={1}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PhotoPreview({ label, uri }) {
  return (
    <View style={{ flex: 1, marginHorizontal: 4 }}>
      <Text className="text-[10.5px] text-gray-500 mb-1.5" numberOfLines={1}>
        {label}
      </Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: 110, borderRadius: 14, backgroundColor: '#F0FDF4' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: '100%', height: 110, borderRadius: 14,
            backgroundColor: '#F0FDF4',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#86EFAC',
          }}
        >
          <ImageIcon size={22} color={BRAND_GREEN_DARK} />
          <Text className="text-[10px] text-gray-500 mt-1">Not uploaded</Text>
        </View>
      )}
    </View>
  );
}

function PhotoUpload({ label, url, busy, onPress }) {
  return (
    <View style={{ flex: 1, marginHorizontal: 4 }}>
      <Text className="text-[10.5px] uppercase font-bold text-gray-500 mb-1.5" style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={busy}
        style={{
          width: '100%', minHeight: 130, borderRadius: 16,
          backgroundColor: '#F0FDF4',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: '#86EFAC',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {url ? (
          <>
            <Image source={{ uri: url }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
            {busy ? (
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(15,23,42,0.45)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <View
                style={{
                  position: 'absolute', bottom: 6, right: 6,
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: 'rgba(15,23,42,0.7)',
                  flexDirection: 'row', alignItems: 'center',
                }}
              >
                <Pencil size={9} color="#FFFFFF" />
                <Text className="text-white text-[9.5px] font-extrabold ml-1">Change</Text>
              </View>
            )}
          </>
        ) : busy ? (
          <ActivityIndicator color={BRAND_GREEN_DARK} />
        ) : (
          <>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#DCFCE7',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Camera size={18} color={BRAND_GREEN_DARK} />
            </View>
            <Text className="text-[11px] font-extrabold mt-2" style={{ color: BRAND_GREEN_DARK }}>
              Upload photo
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function Field({ label, small, last, ...inputProps }) {
  return (
    <View
      style={{
        flex: small ? 1 : undefined,
        marginRight: small ? 8 : 0,
        marginBottom: last ? 0 : 12,
      }}
    >
      <Text
        className="text-[10.5px] uppercase font-bold text-gray-500 mb-1"
        style={{ letterSpacing: 0.6 }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        {...inputProps}
        style={{
          backgroundColor: '#F8FAFC',
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: '#E5E7EB',
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 13.5,
          color: '#0F172A',
        }}
      />
    </View>
  );
}
