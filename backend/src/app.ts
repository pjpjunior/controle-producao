import express from 'express';
import cors from 'cors';
import env from './config/env';
import routes from './routes';

const app = express();

const devHosts = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.15.5'];
const devPorts = [8080];
const devFallbackOrigins = new Set(devHosts.flatMap((host) => devPorts.map((port) => `http://${host}:${port}`)));

const allowedOrigins = new Set([
  ...env.frontendUrls,
  ...(env.nodeEnv === 'production' ? [] : Array.from(devFallbackOrigins))
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin) || env.frontendUrls.includes('*')) {
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
