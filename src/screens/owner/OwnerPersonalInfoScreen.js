import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { getSession } from '../../auth/session';
import { fetchMe } from '../../api/auth';
import { uploadMedia } from '../../api/masterData';
import { notify } from '../../components/confirm';

// Swiggy / Zomato green palette — same as the rest of the owner-side flows.
// Constant names left as PRIMARY etc. so the rest of the file keeps reading
// naturally; only the hex values are swapped.
const PRIMARY = '#15803D';        // BRAND_GREEN_DARK
const PRIMARY_MID = '#16A34A';    // ACCENT_GREEN
const PRIMARY_LIGHT = '#22C55E';  // BRAND_GREEN
const SUCCESS = '#15803D';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const BG = '#F4FBF6';
const PRIMARY_SOFT = '#DCFCE7';

function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OwnerPersonalInfoScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [additional, setAdditional] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  // Guards so the async /auth/me fetch doesn't clobber whatever the user has
  // already typed. Without these the network response would overwrite the
  // controlled `value` mid-typing and reset the TextInput cursor — what the
  // user described as the "auto loop moving cursor" bug.
  const hydratedRef = useRef(false);
  const dirtyRef = useRef({
    fullName: false,
    email: false,
    mobile: false,
    additional: false,
  });

  useEffect(() => {
    // Pull live data from /auth/me so the form reflects what's actually in
    // Postgres, not a snapshot from login time. The dirty-flag guards skip
    // any field the user has already started editing.
    if (hydratedRef.current) return;
    (async () => {
      const apply = (s) => {
        if (s?.name && !dirtyRef.current.fullName) setFullName(s.name);
        if (s?.email && !dirtyRef.current.email) setEmail(s.email);
        if (s?.phone && !dirtyRef.current.mobile) setMobile(s.phone);
        if (s?.shopName) setShopName(s.shopName);
        if (s?.avatarUrl) setAvatarUrl(s.avatarUrl);
      };
      try {
        apply(await fetchMe());
      } catch {
        apply(await getSession());
      } finally {
        hydratedRef.current = true;
        setLoading(false);
      }
    })();
  }, []);

  // Stable per-field change handlers — flip the dirty flag on first keystroke
  // so the (possibly still-running) /auth/me call won't overwrite this value.
  const onChangeFullName = useCallback((v) => { dirtyRef.current.fullName = true; setFullName(v); }, []);
  const onChangeEmail    = useCallback((v) => { dirtyRef.current.email = true; setEmail(v); }, []);
  const onChangeMobile   = useCallback((v) => { dirtyRef.current.mobile = true; setMobile(v); }, []);
  const onChangeAdditional = useCallback((v) => { dirtyRef.current.additional = true; setAdditional(v); }, []);

  const initials = useMemo(() => initialsOf(fullName), [fullName]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      notify('Permission needed', 'Allow media library access to update your photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingAvatar(true);
      const url = await uploadMedia(result.assets[0], 'avatars');
      if (!url) throw new Error('Upload returned no URL');
      setAvatarUrl(url);
    } catch (e) {
      notify('Upload failed', e?.message || 'Try again');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: PUT /owners/me when the endpoint is in place.
    setTimeout(() => {
      setSaving(false);
      setSavedFlash(true);
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSavedFlash(false);
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      });
    }, 600);
  };

  return (
    <View style={styles.root}>
      {/* Slim green hero — single row, matches the rest of the Swiggy/Zomato
          screens. Subtitle copy moved into the identity card below so the
          green band stays short and the avatar/stats card sits high on the
          screen instead of being pushed below a tall banner. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <LinearGradient
          colors={[PRIMARY_LIGHT, PRIMARY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.bannerTitle} numberOfLines={1}>Personal Information</Text>
            <View style={styles.bannerKickerPill}>
              <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" />
              <Text style={styles.bannerKicker}>OWNER</Text>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card — overlaps the banner */}
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              <Pressable
                onPress={pickAvatar}
                disabled={uploadingAvatar}
                style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.85 }]}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </Pressable>
              <Pressable
                onPress={pickAvatar}
                disabled={uploadingAvatar}
                style={styles.avatarEditBtn}
                hitSlop={8}
              >
                <Ionicons name={avatarUrl ? 'pencil' : 'camera'} size={11} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {fullName || 'Shop Owner'}
                </Text>
                <View style={styles.verifiedPill}>
                  <Ionicons name="shield-checkmark" size={9} color={SUCCESS} />
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>
              <View style={styles.shopRow}>
                <Ionicons name="storefront-outline" size={12} color={MUTED} />
                <Text style={styles.shopName} numberOfLines={1}>
                  {shopName}
                </Text>
              </View>
            </View>
          </View>

          {/* Stat row */}
          <View style={styles.statsRow}>
            <Stat icon="briefcase-outline" label="Bookings" value="128" />
            <View style={styles.statDivider} />
            <Stat icon="star" iconColor="#F59E0B" label="Rating" value="4.8" />
            <View style={styles.statDivider} />
            <Stat icon="calendar-outline" label="Since" value="2024" />
          </View>
        </View>

        {/* Personal Details */}
        <SectionLabel icon="person-circle-outline">Personal Details</SectionLabel>
        <View style={styles.card}>
          <Field
            icon="person-outline"
            label="Full Name"
            value={fullName}
            onChangeText={onChangeFullName}
            placeholder="Enter your full name"
          />
          <Field
            icon="mail-outline"
            label="Email Address"
            value={email}
            onChangeText={onChangeEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            last
          />
        </View>

        {/* Contact Numbers */}
        <SectionLabel icon="call-outline">Contact Numbers</SectionLabel>
        <View style={styles.card}>
          <Field
            icon="logo-whatsapp"
            iconColor="#25D366"
            label="Mobile Number (WhatsApp)"
            value={mobile}
            onChangeText={onChangeMobile}
            placeholder="98765 43210"
            keyboardType="phone-pad"
            prefix="+91"
          />
          <Field
            icon="call-outline"
            label="Additional Number"
            value={additional}
            onChangeText={onChangeAdditional}
            placeholder="Optional"
            keyboardType="phone-pad"
            prefix="+91"
            last
          />
        </View>

        {/* Helper note */}
        <View style={styles.helperRow}>
          <View style={styles.helperIconWrap}>
            <Ionicons name="lock-closed" size={11} color={PRIMARY} />
          </View>
          <Text style={styles.helperText}>
            Your contact details stay private and are only used for service updates.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.loadingText}>Loading profile…</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky save bar */}
      <SafeAreaView edges={['bottom']} style={styles.saveBarSafe}>
        <View style={styles.saveBar}>
          <Pressable
            style={({ pressed }) => [
              styles.buttonShadow,
              (saving || loading) && { opacity: 0.7 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            disabled={saving || loading || savedFlash}
            onPress={handleSave}
          >
            <LinearGradient
              colors={
                savedFlash
                  ? [SUCCESS, '#059669']
                  : [PRIMARY, PRIMARY_MID, PRIMARY_LIGHT]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : savedFlash ? (
                <Animated.View style={[styles.buttonInner, { opacity: flashOpacity }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Updated</Text>
                </Animated.View>
              ) : (
                <View style={styles.buttonInner}>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Save Changes</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <View style={styles.sectionLabelRow}>
      {icon ? <Ionicons name={icon} size={13} color={PRIMARY} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

function Stat({ icon, label, value, iconColor }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={13} color={iconColor || PRIMARY} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Plain Field — no local focus state, no React.memo trick. Each TextInput
// owns its own native cursor; nothing in the parent or the wrapper reacts to
// focus changes, so the cursor never gets pulled into a different field.
// Visual focus highlight is dropped (it was the source of the bug); the
// label-color stays muted and the border-color stays neutral regardless of
// which field is being typed in.
function Field({ icon, iconColor, label, last, prefix, ...inputProps }) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? (
          <View style={styles.inputIcon}>
            <Ionicons name={icon} size={16} color={iconColor || MUTED} />
          </View>
        ) : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          placeholderTextColor="#94A3B8"
          {...inputProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Banner — slim single row (same shape as Booking Status, KYC View, etc).
  banner: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginRight: 12,
  },
  bannerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  bannerKickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bannerKicker: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginLeft: 4,
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },

  // Identity card
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  identityText: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  avatarWrap: {},
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarImage: { width: 56, height: 56 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  avatarEditBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', color: TEXT, marginRight: 6 },
  shopRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  shopName: { fontSize: 12, color: MUTED, marginLeft: 4, fontWeight: '600' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedText: {
    fontSize: 8.5,
    color: '#047857',
    fontWeight: '800',
    marginLeft: 2,
    letterSpacing: 0.4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  stat: { flex: 1, alignItems: 'center' },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: TEXT },
  statLabel: { fontSize: 10, color: MUTED, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: BORDER },

  // Section labels
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Form cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  // Field
  field: { marginBottom: 10 },
  fieldLast: { marginBottom: 0 },
  label: { fontSize: 11, color: MUTED, fontWeight: '700', marginBottom: 5, letterSpacing: 0.4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  inputRowFocused: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
    shadowColor: PRIMARY,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputIcon: { width: 20, alignItems: 'center', marginRight: 2 },
  prefix: {
    fontSize: 13,
    color: TEXT,
    fontWeight: '700',
    marginRight: 5,
    paddingRight: 5,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT,
    fontWeight: '600',
  },

  // Helper
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  helperIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  helperText: { fontSize: 11.5, color: '#475569', flex: 1, lineHeight: 16, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  loadingText: { color: MUTED, marginLeft: 8, fontSize: 11 },

  // Sticky save bar
  saveBarSafe: { backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  saveBar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  buttonShadow: {
    borderRadius: 999,
    shadowColor: PRIMARY,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 13,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginLeft: 8, letterSpacing: 0.3 },
});
