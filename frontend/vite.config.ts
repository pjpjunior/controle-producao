import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const rawApiUrl = env.VITE_API_URL ?? '/api';
  const apiPrefix = rawApiUrl.startsWith('/') ? rawApiUrl.replace(/\/$/, '') || '/api' : rawApiUrl;
  const proxyTarget = (env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000').replace(/\/$/, '');
  const isAbsoluteApi = /^https?:\/\//.test(apiPrefix);

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5000,
      proxy: isAbsoluteApi
        ? undefined
        : {
            [apiPrefix]: {
              target: proxyTarget,
              changeOrigin: true
            }
          }
    }
  };
});
