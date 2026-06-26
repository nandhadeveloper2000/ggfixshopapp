import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Smartphone,
  Lock,
  AtSign,
  KeyRound,
  ChevronRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { login } from '../api/auth';
import { AUTH_BASE } from '../api/config';
import { Button, Input } from '../components/rnr';

const GREEN = '#16A34A';
const MUTED = '#64748B';
const SCREEN_BG = '#F6F7F9';
const FIELD_BG = '#FFFFFF';
const FIELD_BORDER = '#E5E7EB';
const SEGMENT_BG = '#ECEEF1';

export default function LoginScreen({ onLogin }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 600;
  const isShort = height < 700;
  const contentMaxWidth = isWide ? 440 : undefined;

  const [authMethod, setAuthMethod] = useState('OTP');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [identifier, setIdentifier] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const usingOtp = authMethod === 'OTP';

  const handleSubmit = async () => {
    setError(null);
    try {
      setLoading(true);
      const id = identifier.trim();
      if (!id) { setError('Email or mobile is required'); return; }
      if (usingOtp && !otp.trim()) { setError('OTP is required'); return; }
      if (!usingOtp && !password.trim()) { setError('Password is required'); return; }
      const credential = usingOtp ? { otp: otp.trim() } : { password };
      const data = await login(id, credential);

      // Block SUPER_ADMIN in the mobile shop app — they belong in the admin web.
      if (data?.loginType === 'SUPER_ADMIN') {
        setError('Super-admin accounts must sign in from the admin web app.');
        return;
      }
      onLogin(data);
    } catch (e) {
      const msg = e?.message || 'Authentication failed';
      const isLocalhost = /localhost|127\.0\.0\.1/.test(String(msg));
      if (isLocalhost) {
        const urlMatch = String(msg).match(/URL:\s*(\S+)/i);
        const triedUrl = urlMatch ? urlMatch[1] : '(unknown)';
        setError(
          `Can't reach server (trying localhost). Tried: ${triedUrl}. ` +
            `Current AUTH_BASE: ${AUTH_BASE}. Restart Expo with EXPO_PUBLIC_API_HOST=YOUR_PC_IP.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const ctaLabel = usingOtp ? 'Verify OTP' : 'Log in';

  return (
    <View style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DCFCE7" />
      <LinearGradient
        colors={['#DCFCE7', '#F0FDF4', SCREEN_BG]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              paddingHorizontal: 22,
              paddingTop: Platform.OS === 'ios' ? (isShort ? 28 : 44) : (isShort ? 22 : 32),
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: isShort ? 14 : 20 }}>
              <View
                style={{
                  height: 64,
                  width: 64,
                  borderRadius: 20,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  shadowColor: GREEN,
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 3,
                  borderWidth: 1,
                  borderColor: '#DCFCE7',
                }}
              >
                <Smartphone size={30} color={GREEN} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: GREEN, letterSpacing: -0.3 }}>
                GGfix
              </Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                Repair · Buy · Sell — at your fingertips
              </Text>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
              Sign in
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 19 }}>
              Enter your email or mobile number. We'll detect whether you're an owner, shop, or employee.
            </Text>

            <View style={{ marginTop: 14 }} />

            <FieldGroup label="Email or mobile number">
              <View style={fieldRow}>
                <AtSign size={18} color={MUTED} />
                <Input
                  placeholder="you@example.com or 10-digit mobile"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 bg-transparent border-0 ml-2"
                  style={fieldInput}
                />
              </View>
            </FieldGroup>

            <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />

            <FieldGroup label={usingOtp ? 'Enter OTP' : 'Password'}>
              <View style={fieldRow}>
                {usingOtp ? <KeyRound size={18} color={MUTED} /> : <Lock size={18} color={MUTED} />}
                {usingOtp ? (
                  <Input
                    placeholder="6-digit OTP"
                    value={otp}
                    onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    className="flex-1 bg-transparent border-0 ml-2"
                    style={fieldInput}
                  />
                ) : (
                  <Input
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    className="flex-1 bg-transparent border-0 ml-2"
                    style={fieldInput}
                  />
                )}
              </View>
              {usingOtp ? (
                <Text style={hint}>Default OTP for new accounts is 123456.</Text>
              ) : (
                <Text style={hint}>Default password for new accounts is 123456.</Text>
              )}
            </FieldGroup>

            {error ? (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderColor: '#FECACA',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 18 }}>{error}</Text>
              </View>
            ) : null}

            <Button
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              size="lg"
              rightIcon={!loading ? <ChevronRight size={18} color="#fff" /> : null}
              style={{ marginTop: 18, height: 56, borderRadius: 16 }}
              textClassName="text-[15.5px] font-extrabold tracking-wide"
            >
              {ctaLabel}
            </Button>

            <Text
              style={{
                fontSize: 11,
                color: MUTED,
                textAlign: 'center',
                marginTop: 24,
                lineHeight: 16,
              }}
            >
              By continuing, you agree to our{' '}
              <Text style={{ color: '#0F172A', fontWeight: '600' }}>Terms of Service</Text>
              {'  ·  '}
              <Text style={{ color: '#0F172A', fontWeight: '600' }}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldGroup({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A', marginBottom: 6, marginLeft: 2 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function AuthMethodToggle({ value, onChange }) {
  const isPwd = value === 'PASSWORD';
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: SEGMENT_BG,
        borderRadius: 12,
        padding: 4,
        marginBottom: 14,
      }}
    >
      <SmallTab active={isPwd} onPress={() => onChange('PASSWORD')} icon={<Lock size={13} color={isPwd ? GREEN : MUTED} />} label="Password" />
      <SmallTab active={!isPwd} onPress={() => onChange('OTP')} icon={<KeyRound size={13} color={!isPwd ? GREEN : MUTED} />} label="OTP" />
    </View>
  );
}

function SmallTab({ active, onPress, icon, label }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: active ? '#fff' : 'transparent',
        shadowColor: '#0F172A',
        shadowOpacity: active ? 0.06 : 0,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: active ? 1 : 0,
      }}
    >
      {icon}
      <Text
        style={{
          marginLeft: 6,
          fontSize: 12,
          fontWeight: '700',
          color: active ? GREEN : MUTED,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const fieldRow = {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: FIELD_BG,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: FIELD_BORDER,
  paddingHorizontal: 14,
  height: 50,
};

const fieldInput = {
  fontSize: 15,
  color: '#0F172A',
  height: '100%',
  paddingVertical: 0,
};

const hint = {
  fontSize: 10.5,
  color: MUTED,
  marginTop: 6,
  marginLeft: 4,
};
