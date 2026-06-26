import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User,
  QrCode,
  Store,
  FileText,
  Truck,
  Package,
  Users,
  CalendarClock,
  ShieldCheck,
  Phone,
  ArrowLeftRight,
  X,
  Check,
  ChevronRight,
  ScrollText,
  Lock,
  HelpCircle,
  Headphones,
  LogOut,
  Sparkles,
  Crown,
} from 'lucide-react-native';
import { getSession } from '../../auth/session';
import { switchShop, fetchMe } from '../../api/auth';
import { listShopKycDocuments } from '../../api/shops';

// Swiggy / Zomato green palette — shared with the rest of the owner app.
const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN     = '#16A34A';
const DANGER           = '#DC2626';

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

function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MyAccountScreen({ onLogout, navigation }) {
  const [user, setUser] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  // null = unknown (haven't checked yet); true/false once we know.
  const [hasKycDocs, setHasKycDocs] = useState(null);

  const reloadSession = async () => {
    // Prefer live /auth/me so the screen reflects DB state (shopName, shops,
    // phone, avatar...) — heals old sessions taken before LoginResponse grew.
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      try { setUser(await getSession()); } catch { setUser(null); }
    }
  };

  useEffect(() => { reloadSession(); }, []);

  // Refresh KYC submission status whenever this screen comes into focus, so the
  // KYC Documents row can route the user to View (already uploaded) vs Intro
  // (first time) without a manual reload.
  useFocusEffect(
    useCallback(() => {
      const sid = user?.shopId;
      if (!sid) return;
      let cancelled = false;
      (async () => {
        try {
          const list = await listShopKycDocuments(sid);
          if (!cancelled) setHasKycDocs(Array.isArray(list) && list.length > 0);
        } catch {
          if (!cancelled) setHasKycDocs(false);
        }
      })();
      return () => { cancelled = true; };
    }, [user?.shopId])
  );

  const ownerName = user?.name || 'Shop Owner';
  const shopName = user?.shopName || (user?.shops?.find?.((s) => s.isActive)?.name) || '';
  const phone = user?.phone || '';
  const shops = user?.shops || [];
  const hasMultipleShops = shops.length > 1;
  const initials = useMemo(() => initialsOf(ownerName), [ownerName]);

  const handleSwitch = async (shopId) => {
    if (!shopId || shopId === user?.shopId) { setShowSwitcher(false); return; }
    setSwitching(true);
    try {
      await switchShop(shopId);
      await reloadSession();
      setShowSwitcher(false);
    } catch (e) {
      setShowSwitcher(false);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      {/* Slim green hero — matches the rest of the owner-side Swiggy/Zomato
          screens (back/title row + small badge). Subtitle and big copy have
          been moved into the content area so the header band stays short. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: BRAND_GREEN_DARK }}>
        <LinearGradient
          colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 6,
            paddingBottom: 14,
            paddingHorizontal: 16,
          }}
        >
          <View className="flex-row items-center">
            <Text className="flex-1 text-white text-[17px] font-extrabold" numberOfLines={1}>
              My Account
            </Text>
            <View
              className="flex-row items-center px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <Crown size={11} color="#FFFFFF" />
              <Text
                className="ml-1 text-white text-[10.5px] font-extrabold"
                style={{ letterSpacing: 0.6 }}
              >
                OWNER
              </Text>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28, paddingTop: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card */}
        <View
          className="bg-white rounded-3xl p-4"
          style={cardShadow}
        >
          <View className="flex-row items-center">
            <View
              style={{
                padding: 3,
                borderRadius: 36,
                backgroundColor: '#FFFFFF',
                borderWidth: 2,
                borderColor: '#DCFCE7',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: BRAND_GREEN_DARK,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  className="text-white font-extrabold"
                  style={{ fontSize: 19, letterSpacing: 1 }}
                >
                  {initials}
                </Text>
              </View>
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center flex-wrap">
                <Text className="text-[16px] font-extrabold text-gray-900 mr-2" numberOfLines={1}>
                  {ownerName}
                </Text>
                <View
                  className="flex-row items-center px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#DCFCE7' }}
                >
                  <ShieldCheck size={10} color={BRAND_GREEN_DARK} />
                  <Text
                    className="ml-0.5 text-[8.5px] font-extrabold"
                    style={{ color: BRAND_GREEN_DARK, letterSpacing: 0.4 }}
                  >
                    VERIFIED
                  </Text>
                </View>
              </View>
              {phone ? (
                <View className="flex-row items-center mt-1.5">
                  <Phone size={11} color="#64748B" />
                  <Text className="ml-1 text-[12px] font-semibold text-gray-500">
                    {phone}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Active shop pill */}
          <Pressable
            onPress={() => hasMultipleShops && setShowSwitcher(true)}
            disabled={!hasMultipleShops}
            className="mt-3.5 flex-row items-center rounded-2xl px-3 py-2.5"
            style={{
              backgroundColor: hasMultipleShops ? '#F0FDF4' : '#F8FAFC',
              borderWidth: 1,
              borderColor: hasMultipleShops ? '#BBF7D0' : '#E2E8F0',
            }}
          >
            <View
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: '#FFFFFF',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 10,
                borderWidth: 1, borderColor: '#BBF7D0',
              }}
            >
              <Store size={14} color={BRAND_GREEN_DARK} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[9.5px] font-extrabold"
                style={{ color: BRAND_GREEN_DARK, letterSpacing: 1 }}
              >
                ACTIVE SHOP
              </Text>
              <Text className="text-[13.5px] font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                {shopName || 'No shop linked'}
              </Text>
            </View>
            {hasMultipleShops ? (
              <View
                className="flex-row items-center px-2.5 py-1.5 rounded-full"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <ArrowLeftRight size={11} color="#FFFFFF" />
                <Text className="ml-1 text-white text-[10.5px] font-extrabold">
                  Switch ({shops.length})
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Promo card / shop perks */}
        <View className="mt-4" style={cardShadow}>
          <LinearGradient
            colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22, padding: 16, overflow: 'hidden' }}
          >
            <View
              style={{
                position: 'absolute', right: -30, top: -30,
                width: 110, height: 110, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.10)',
              }}
            />
            <View
              style={{
                position: 'absolute', right: 30, bottom: -40,
                width: 80, height: 80, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            />
            <View className="flex-row items-center">
              <View
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
                  marginRight: 12,
                }}
              >
                <Sparkles size={22} color="#FFFFFF" strokeWidth={2.3} />
              </View>
              <View className="flex-1">
                <Text className="text-white text-[15px] font-extrabold">
                  GGfix Partner Benefits
                </Text>
                <Text className="text-white/85 text-[11px] mt-0.5">
                  Verified shop perks · Faster payouts · Priority support
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* My Profile group */}
        <SectionLabel>My Profile</SectionLabel>
        <View className="bg-white rounded-2xl px-3 mt-1" style={softShadow}>
          <MenuRow
            Icon={User}
            tint="#DCFCE7"
            accent={BRAND_GREEN_DARK}
            label="Personal Information"
            sub="Name, mobile, email"
            onPress={() => navigation?.navigate?.('OwnerPersonalInfo')}
          />
          <MenuRow
            Icon={QrCode}
            tint="#EDE9FE"
            accent="#6D28D9"
            label="My QR Code"
            sub="Share your shop instantly"
            onPress={() => navigation?.navigate?.('OwnerQrCode')}
          />
          <MenuRow
            Icon={Store}
            tint="#DBEAFE"
            accent="#1D4ED8"
            label="Shop Information"
            sub="Address, opening hours, GST"
            onPress={() => navigation?.navigate?.('OwnerShopInfo')}
          />
          <MenuRow
            Icon={FileText}
            tint="#FEF3C7"
            accent="#B45309"
            label="KYC Documents"
            sub="Aadhar, PAN, GST / Udyam"
            onPress={() => navigation?.navigate?.(hasKycDocs ? 'OwnerKycView' : 'OwnerKycIntro')}
          />
          <MenuRow
            Icon={Truck}
            tint="#CFFAFE"
            accent="#0E7490"
            label="Service Pickup Options"
            sub="Slot timings & pickup zones"
            onPress={() => navigation?.navigate?.('OwnerPickupSlots')}
          />
          <MenuRow
            Icon={Package}
            tint="#FCE7F3"
            accent="#BE185D"
            label="My Orders"
            sub="Marketplace purchases"
            onPress={() => navigation?.navigate?.('MarketplaceOrders')}
          />
          <MenuRow
            Icon={Users}
            tint="#E0E7FF"
            accent="#4338CA"
            label="Employee Management"
            sub="Add, edit & track your team"
            onPress={() => navigation?.navigate?.('OwnerEmployeeList')}
          />
          <MenuRow
            Icon={CalendarClock}
            tint="#FEE2E2"
            accent="#B91C1C"
            label="Leave Requests"
            sub="Approve or reject leave"
            onPress={() => navigation?.navigate?.('OwnerLeaveRequests')}
            last
          />
        </View>

        {/* More group */}
        <SectionLabel>More</SectionLabel>
        <View className="bg-white rounded-2xl px-3 mt-1" style={softShadow}>
          <MenuRow
            Icon={ScrollText}
            tint="#F1F5F9"
            accent="#475569"
            label="Terms & Conditions"
            sub="Platform usage rules"
          />
          <MenuRow
            Icon={Lock}
            tint="#F1F5F9"
            accent="#475569"
            label="Privacy Policy"
            sub="How we handle your data"
          />
          <MenuRow
            Icon={HelpCircle}
            tint="#F1F5F9"
            accent="#475569"
            label="FAQs"
            sub="Common questions answered"
          />
          <MenuRow
            Icon={Headphones}
            tint="#DCFCE7"
            accent={BRAND_GREEN_DARK}
            label="Help & Support"
            sub="Talk to the GGfix team"
            last
          />
        </View>

        {/* Logout */}
        {onLogout ? (
          <Pressable
            onPress={onLogout}
            className="mt-4 flex-row items-center justify-center rounded-2xl py-3.5 bg-white"
            style={{
              borderWidth: 1,
              borderColor: '#FEE2E2',
              ...softShadow,
            }}
          >
            <LogOut size={16} color={DANGER} />
            <Text className="ml-2 text-[14px] font-extrabold" style={{ color: DANGER }}>
              Log Out
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Shop switcher modal */}
      <Modal
        visible={showSwitcher}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitcher(false)}
      >
        <Pressable
          onPress={() => setShowSwitcher(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 28,
            }}
          >
            <View
              style={{
                alignSelf: 'center', width: 44, height: 5,
                borderRadius: 999, backgroundColor: '#E2E8F0',
                marginBottom: 12,
              }}
            />
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[17px] font-extrabold text-gray-900">Switch Shop</Text>
              <Pressable
                onPress={() => setShowSwitcher(false)}
                hitSlop={8}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                <X size={14} color="#0F172A" />
              </Pressable>
            </View>
            <Text className="text-[12px] text-gray-500 mb-3">
              Choose which of your shops to manage.
            </Text>
            {shops.map((s) => {
              const active = s.id === user?.shopId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleSwitch(s.id)}
                  disabled={switching || active}
                  className="flex-row items-center rounded-2xl border mb-2"
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: active ? '#F0FDF4' : '#FFFFFF',
                    borderColor: active ? BRAND_GREEN : '#E5E7EB',
                  }}
                >
                  <View
                    className="w-9 h-9 rounded-2xl items-center justify-center mr-3"
                    style={{ backgroundColor: active ? BRAND_GREEN : '#DCFCE7' }}
                  >
                    <Store size={16} color={active ? '#FFFFFF' : BRAND_GREEN_DARK} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-extrabold"
                      style={{ color: active ? BRAND_GREEN_DARK : '#0F172A' }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
                      {s.slug}
                    </Text>
                  </View>
                  {active ? (
                    <View
                      className="w-7 h-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: '#DCFCE7' }}
                    >
                      <Check size={16} color={BRAND_GREEN_DARK} />
                    </View>
                  ) : (
                    <ChevronRight size={16} color="#94A3B8" />
                  )}
                </Pressable>
              );
            })}
            {switching ? (
              <View className="flex-row items-center justify-center mt-2">
                <ActivityIndicator color={BRAND_GREEN_DARK} />
                <Text className="ml-2 text-[12px] text-gray-500">Switching…</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionLabel({ children }) {
  return (
    <View className="mt-4 mb-1 ml-1">
      <Text
        className="text-[11px] font-extrabold uppercase"
        style={{ color: BRAND_GREEN_DARK, letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}

function MenuRow({ Icon, tint, accent, label, sub, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#F8FAFC' }}
      className="flex-row items-center"
      style={{
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#F1F5F9',
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: tint,
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Icon size={17} color={accent} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-extrabold text-gray-900">{label}</Text>
        {sub ? (
          <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} color="#94A3B8" />
    </Pressable>
  );
}
