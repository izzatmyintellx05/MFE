import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or invalid session signs the user out. A failed sign-in is not a session,
    // so the login page keeps its error message instead of reloading.
    const isLoginRequest = String(error.config?.url || '').includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);