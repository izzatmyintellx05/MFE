import { create } from 'zustand';
import { api } from '../api/client';

interface AuthState {
  user: any | null;
  token: string | null;
  // True while the signed-in account still uses the default password
  usingDefaultPassword: boolean;
  login: (email: string, pass: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

const getStoredToken = (): string | null => {
  const t = localStorage.getItem('mfe_token');
  return t && t !== 'undefined' && t !== 'null' ? t : null;
};

const getStoredUser = (): any | null => {
  try {
    const u = localStorage.getItem('mfe_user');
    return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

const DEFAULT_PASSWORD_KEY = 'mfe_default_password';

const getStoredDefaultFlag = (): boolean => {
  try {
    return localStorage.getItem(DEFAULT_PASSWORD_KEY) === '1';
  } catch {
    return false;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  usingDefaultPassword: getStoredDefaultFlag(),

  login: async (email: string, pass: string) => {
    const res = await api.post('/auth/login', { email, password: pass });
    console.log('[AUTH STORE] Full backend response:', res.data);

    // Extract token whether inside res.data.data or res.data directly
    const token =
      res.data?.data?.token ||
      res.data?.token ||
      res.data?.accessToken;

    const user =
      res.data?.data?.user ||
      res.data?.user ||
      res.data?.data;

    if (!token) {
      console.error('[AUTH STORE] Token missing in response:', res.data);
      throw new Error('Authentication token not received from server');
    }

    console.log('[AUTH STORE] Token saved successfully');
    localStorage.setItem('mfe_token', token);
    localStorage.setItem('mfe_user', JSON.stringify(user || { email }));
    const usingDefaultPassword = !!user?.usingDefaultPassword;
    if (usingDefaultPassword) localStorage.setItem(DEFAULT_PASSWORD_KEY, '1');
    else localStorage.removeItem(DEFAULT_PASSWORD_KEY);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    set({ token, user: user || { email }, usingDefaultPassword });
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
    localStorage.removeItem(DEFAULT_PASSWORD_KEY);
    set({ usingDefaultPassword: false });
  },

  logout: () => {
    localStorage.removeItem('mfe_token');
    localStorage.removeItem('mfe_user');
    localStorage.removeItem(DEFAULT_PASSWORD_KEY);
    delete api.defaults.headers.common['Authorization'];
    set({ token: null, user: null, usingDefaultPassword: false });
    window.location.href = '/login';
  },

initAuth: async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/auth/me');
      const user = res.data?.data?.user || res.data?.user || res.data?.data;
      if (user) {
        localStorage.setItem('mfe_user', JSON.stringify(user));
        set({ user, token });
      }
    } catch {
      // Clear token silently without forcing full page reload
      localStorage.removeItem('mfe_token');
      localStorage.removeItem('mfe_user');
      delete api.defaults.headers.common['Authorization'];
      set({ token: null, user: null });
    }
  },
}));