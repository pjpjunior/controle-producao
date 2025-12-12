import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const TOKEN_KEY = 'controleproducao:token';

export const api = axios.create({
  baseURL: baseURL.replace(/\/$/, '')
});

api.interceptors.request.use((config) => {
  const alreadyHasToken = config.headers?.Authorization;
  if (!alreadyHasToken) {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
