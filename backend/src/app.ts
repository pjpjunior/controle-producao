import express from 'express';
import cors from 'cors';
import env from './config/env';
import routes from './routes';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (env.frontendUrls.includes(origin) || env.frontendUrls.includes('*')) {
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
