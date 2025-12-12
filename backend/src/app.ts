import express from 'express';
import cors from 'cors';
import env from './config/env';
import routes from './routes';

const app = express();

const isDev = env.nodeEnv !== 'production';

const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return value.trim();
  }
};

const isPrivateHostname = (hostname: string) =>
  ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname) ||
  hostname.startsWith('10.') ||
  hostname.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isPrivateNetworkOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return isPrivateHostname(hostname);
  } catch {
    return false;
  }
};

const allowedOrigins = new Set(env.frontendUrls.map(normalizeOrigin));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (
        isDev ||
        allowedOrigins.has(normalizeOrigin(origin)) ||
        env.frontendUrls.includes('*') ||
        isPrivateNetworkOrigin(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Controle de Produção API', status: 'ok' });
});

app.use(env.apiPrefix, routes);

export default app;
