import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getSession, clearSession, setAuthExpiredHandler } from '../auth/session';
import { logout } from '../api/auth';
import { setSession, clearSession as clearAuth } from '../store/authSlice';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import OwnerNavigator from './OwnerNavigator';
import TechnicianNavigator from './TechnicianNavigator';

const Stack = createNativeStackNavigator();

function getRoleFromSession(session) {
  const roles = session?.roles || [];
  if (roles.includes('SHOP_OWNER')) return 'SHOP_OWNER';
  if (roles.includes('TECHNICIAN')) return 'TECHNICIAN';
  return roles[0] || null;
}

export default function RootNavigator() {
  const dispatch = useDispatch();
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSessionState(s);
      dispatch(setSession(s));
      setLoading(false);
    });
  }, [dispatch]);

  // When the API client detects an expired/invalid token, drop to Login.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setSessionState(null);
      dispatch(clearAuth());
    });
    return () => setAuthExpiredHandler(null);
  }, [dispatch]);

  const handleLogin = (newSession) => {
    setSessionState(newSession);
    dispatch(setSession(newSession));
  };
  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    await clearSession();
    setSessionState(null);
    dispatch(clearAuth());
  };

  if (loading) {
    return null;
  }

  if (!session?.accessToken) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
        </Stack.Screen>
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      </Stack.Navigator>
    );
  }

  const role = getRoleFromSession(session);

  if (role === 'TECHNICIAN') {
    return <TechnicianNavigator session={session} onLogout={handleLogout} />;
  }

  return <OwnerNavigator session={session} onLogout={handleLogout} />;
}
