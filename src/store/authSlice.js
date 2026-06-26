import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken: null,
  userId: null,
  shopId: null,
  shopSlug: null,
  roles: [],
  email: null,
  fullName: null,
  mobile: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      const s = action.payload || {};
      state.accessToken = s.accessToken ?? null;
      state.userId = s.userId ?? null;
      state.shopId = s.shopId ?? null;
      state.shopSlug = s.shopSlug ?? null;
      state.roles = Array.isArray(s.roles) ? s.roles : [];
      state.email = s.email ?? null;
      state.fullName = s.fullName ?? null;
      state.mobile = s.mobile ?? null;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;

export const selectSession = (state) => state.auth;
export const selectShopId = (state) => state.auth.shopId;
export const selectUserId = (state) => state.auth.userId;
export const selectRoles = (state) => state.auth.roles;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectIsLoggedIn = (state) => !!state.auth.accessToken;

export default authSlice.reducer;
