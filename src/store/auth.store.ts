import { create } from 'zustand';
import { api } from '../api/client';

interface AuthState {
  user: any | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),

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

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    set({ token, user: user || { email } });
  },

  logout: () => {
    localStorage.removeItem('mfe_token');
    localStorage.removeItem('mfe_user');
    delete api.defaults.headers.common['Authorization'];
    set({ token: null, user: null });
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