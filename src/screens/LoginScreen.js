import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
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
  KeyRound,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { login, requestOtp } from '../api/auth';
import { AUTH_BASE } from '../api/config';
import { Button, Input } from '../components/rnr';

const GREEN = '#16A34A';
const MUTED = '#64748B';
const INK = '#0F172A';
const SCREEN_BG = '#F6F7F9';
const FIELD_BG = '#FFFFFF';
const FIELD_BORDER = '#E5E7EB';

export default function LoginScreen({ onLogin, navigation }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 600;
  const isShort = height < 700;
  const contentMaxWidth = isWide ? 440 : undefined;

  // Two-step flow: enter identifier -> Continue -> enter credential (password/OTP).
  const [step, setStep] = useState('IDENTIFIER'); // IDENTIFIER | CREDENTIAL
  const [mode, setMode] = useState('PASSWORD'); // PASSWORD | OTP (step 2)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [otpHint, setOtpHint] = useState(null);

  const trimmedId = identifier.trim();
  const isPhone =
    trimmedId.length > 0 && !trimmedId.includes('@') && /^[0-9 +]+$/.test(trimmedId);
  const phoneDigits = trimmedId.replace(/\D/g, '');
  const prettyId = isPhone ? `+91 ${phoneDigits}` : trimmedId;

  const goCredential = () => {
    setError(null);
    if (!trimmedId) { setError('Enter your mobile number or email'); return; }
    if (isPhone && phoneDigits.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setMode('PASSWORD');
    setStep('CREDENTIAL');
  };

  const backToIdentifier = () => {
    setError(null);
    setPassword('');
    setOtp('');
    setOtpHint(null);
    setStep('IDENTIFIER');
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'PASSWORD' && !password.trim()) { setError('Enter your password'); return; }
    if (mode === 'OTP' && !otp.trim()) { setError('Enter the OTP'); return; }
    try {
      setLoading(true);
      const id = isPhone ? phoneDigits : trimmedId;
      const credential = mode === 'OTP' ? { otp: otp.trim() } : { password };
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

  const handleSendOtp = async () => {
    setError(null);
    setOtpHint(null);
    try {
      setLoading(true);
      const idToSend = isPhone ? phoneDigits : trimmedId;
      const res = await requestOtp(idToSend);
      setOtpHint(res?.channel === 'MOBILE' ? 'Use OTP 123456.' : 'Code sent to your email.');
    } catch (e) {
      setError(e?.message || 'Could not send the code');
    } finally {
      setLoading(false);
    }
  };

  const renderError = () =>
    error ? (
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
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DCFCE7" />
      <LinearGradient
        colors={['#DCFCE7', '#F0FDF4', SCREEN_BG]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 28,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: '100%',
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              paddingHorizontal: isWide ? 32 : 22,
            }}
          >
            {/* Brand */}
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
                <Image source={require('../../assets/logo.png')} style={{ height: 46, width: 46, borderRadius: 12 }} resizeMode="contain" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: GREEN, letterSpacing: -0.3 }}>
                GGFIX
              </Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                Repair · Buy · Sell — at your fingertips
              </Text>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 }}>
              Sign in
            </Text>

            {step === 'IDENTIFIER' ? (
              /* ---------- Step 1: identifier ---------- */
              <>
                <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 19 }}>
                  Enter your mobile number or email to continue.
                </Text>

                <Text style={fieldLabel}>Enter mobile number or email</Text>
                <View style={fieldRow}>
                  {isPhone && (
                    <View style={ccChip}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>🇮🇳 +91</Text>
                    </View>
                  )}
                  <Input
                    placeholder="Mobile number or email"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className="flex-1 bg-transparent border-0"
                    style={fieldInput}
                  />
                  {trimmedId.length > 0 && (
                    <Pressable onPress={() => setIdentifier('')} hitSlop={8}>
                      <X size={18} color={MUTED} />
                    </Pressable>
                  )}
                </View>

                {renderError()}

                <Button
                  onPress={goCredential}
                  loading={loading}
                  fullWidth
                  size="lg"
                  rightIcon={!loading ? <ChevronRight size={18} color="#fff" /> : null}
                  style={{ marginTop: 14, height: 56, borderRadius: 16 }}
                  textClassName="text-[15.5px] font-extrabold tracking-wide"
                >
                  Continue
                </Button>

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
                  <Text style={{ fontSize: 13, color: MUTED }}>New to GGFIX? </Text>
                  <Pressable onPress={() => navigation?.navigate('CreateAccount')} hitSlop={8}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: GREEN }}>Create account</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              /* ---------- Step 2: credential ---------- */
              <>
                {/* identifier + Change */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    marginBottom: 14,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK }} numberOfLines={1}>
                    {prettyId}
                  </Text>
                  <Pressable onPress={backToIdentifier} hitSlop={8}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: GREEN }}>Change</Text>
                  </Pressable>
                </View>

                {mode === 'PASSWORD' ? (
                  <>
                    <View style={labelRow}>
                      <Text style={fieldLabelInline}>Password</Text>
                      <Pressable onPress={() => navigation?.navigate('ForgotPassword')} hitSlop={8}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: GREEN }}>Forgot password?</Text>
                      </Pressable>
                    </View>
                    <View style={fieldRow}>
                      <Lock size={18} color={MUTED} />
                      <Input
                        placeholder="••••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        className="flex-1 bg-transparent border-0 ml-2"
                        style={fieldInput}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={labelRow}>
                      <Text style={fieldLabelInline}>One-time password (OTP)</Text>
                      {!isPhone && (
                        <Pressable onPress={handleSendOtp} hitSlop={8}>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: GREEN }}>Send code</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={fieldRow}>
                      <KeyRound size={18} color={MUTED} />
                      <Input
                        placeholder="6-digit OTP"
                        value={otp}
                        onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        className="flex-1 bg-transparent border-0 ml-2"
                        style={fieldInput}
                      />
                    </View>
                    {otpHint ? (
                      <Text style={{ fontSize: 12, color: GREEN, marginTop: 8 }}>{otpHint}</Text>
                    ) : isPhone ? (
                      <Text style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Default OTP is 123456.</Text>
                    ) : null}
                  </>
                )}

                {renderError()}

                <Button
                  onPress={handleSubmit}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 14, height: 56, borderRadius: 16 }}
                  textClassName="text-[15.5px] font-extrabold tracking-wide"
                >
                  Sign in
                </Button>

                <OrDivider />

                {mode === 'PASSWORD' ? (
                  <OutlineButton
                    onPress={() => { setMode('OTP'); setError(null); }}
                    icon={<KeyRound size={16} color={GREEN} />}
                    label="Sign in with OTP"
                  />
                ) : (
                  <OutlineButton
                    onPress={() => { setMode('PASSWORD'); setError(null); }}
                    icon={<Lock size={16} color={GREEN} />}
                    label="Sign in with password"
                  />
                )}
              </>
            )}

            <Text style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 18, lineHeight: 16 }}>
              By continuing, you agree to our{' '}
              <Text style={{ color: INK, fontWeight: '600' }}>Terms of Service</Text>
              {'  ·  '}
              <Text style={{ color: INK, fontWeight: '600' }}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OrDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: FIELD_BORDER }} />
      <Text style={{ marginHorizontal: 12, fontSize: 12, color: MUTED, fontWeight: '600' }}>or</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: FIELD_BORDER }} />
    </View>
  );
}

function OutlineButton({ onPress, icon, label }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: GREEN,
        backgroundColor: '#F0FDF4',
      }}
    >
      {icon}
      <Text style={{ marginLeft: 8, fontSize: 14.5, fontWeight: '700', color: GREEN }}>{label}</Text>
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
  color: INK,
  height: '100%',
  paddingVertical: 0,
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: '600',
  color: INK,
  marginBottom: 6,
  marginTop: 16,
  marginLeft: 2,
};

const fieldLabelInline = {
  fontSize: 12,
  fontWeight: '600',
  color: INK,
  marginLeft: 2,
};

const labelRow = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  marginTop: 2,
};

const ccChip = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 10,
  marginRight: 8,
  borderRightWidth: 1,
  borderRightColor: FIELD_BORDER,
  height: '60%',
};
