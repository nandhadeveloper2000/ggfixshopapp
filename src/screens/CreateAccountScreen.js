import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, UserPlus, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/rnr';

const GREEN = '#16A34A';
const MUTED = '#64748B';
const SCREEN_BG = '#F6F7F9';

// Placeholder — the full sign-up flow is built later. For now this gives the
// "Create account" option a destination so it isn't a dead button.
export default function CreateAccountScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const contentMaxWidth = isWide ? 440 : undefined;

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate('Login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DCFCE7" />
      <LinearGradient
        colors={['#DCFCE7', '#F0FDF4', SCREEN_BG]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />

      <Pressable
        onPress={goBack}
        hitSlop={10}
        style={{
          position: 'absolute',
          top: Platform.OS === 'ios' ? 56 : 20,
          left: 18,
          zIndex: 10,
          height: 40,
          width: 40,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#DCFCE7',
        }}
      >
        <ArrowLeft size={20} color={GREEN} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingBottom: 32,
          paddingHorizontal: isWide ? 32 : 22,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              height: 72,
              width: 72,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#DCFCE7',
            }}
          >
            <UserPlus size={32} color={GREEN} />
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
            Create account
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E7EB',
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Clock size={14} color={MUTED} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginLeft: 6 }}>
              Coming soon
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: MUTED,
              textAlign: 'center',
              marginTop: 16,
              lineHeight: 20,
            }}
          >
            Sign-up isn't available yet. For now, please contact your administrator to
            get an account, then sign in with your email or mobile number.
          </Text>

          <Button
            onPress={goBack}
            fullWidth
            size="lg"
            style={{ marginTop: 24, height: 54, borderRadius: 16 }}
            textClassName="text-[15px] font-extrabold tracking-wide"
          >
            Back to sign in
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
