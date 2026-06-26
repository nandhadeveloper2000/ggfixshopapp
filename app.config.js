// Use your computer's IP when running on a physical device so the app can reach your backend.
// Run: set EXPO_PUBLIC_API_HOST=192.168.1.5  (then npx expo start)
// Or create .env with EXPO_PUBLIC_API_HOST=192.168.1.5
const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
const masterPort = process.env.EXPO_PUBLIC_MASTER_PORT || '8091';
const masterBase =
  process.env.EXPO_PUBLIC_MASTER_BASE || `http://${host}:${masterPort}/`;

export default {
  expo: {
    name: 'ggfix Shop',
    slug: 'ggfix-shop-app',
    version: '1.0.0',
    platforms: ['ios', 'android', 'web'],
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    jsEngine: 'hermes',
    splash: { resizeMode: 'contain', backgroundColor: '#202124' },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'We use your location to show pickup-enabled repair shops nearby and to set your default delivery address.',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
    },
    android: {
      adaptiveIcon: { backgroundColor: '#202124' },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      usesCleartextTraffic: true,
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'We use your location to show pickup-enabled repair shops nearby.',
        },
      ],
    ],
    extra: {
      API_HOST: host,
      API_BASE_URL: null,
      AUTH_BASE: null,
      MASTER_BASE: masterBase,
      TICKET_BASE: null,
      TECHNICIAN_BASE: null,
      SHOP_BASE: null,
      INVENTORY_BASE: null,
      MARKETPLACE_BASE: null,
      PICKUP_BASE: null,
      ORDER_BASE: null,
    },
  },
};
