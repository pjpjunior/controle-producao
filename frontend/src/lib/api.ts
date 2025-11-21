import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export const api = axios.create({
  baseURL: baseURL.replace(/\/$/, '')
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
