import dotenv from 'dotenv';

dotenv.config();

const normalizeUrls = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não configurada');
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  apiPrefix: process.env.API_PREFIX ?? '/api',
  frontendUrls: normalizeUrls(process.env.FRONTEND_URL) ?? ['http://localhost:5000'],
  databaseUrl
};

export default env;
