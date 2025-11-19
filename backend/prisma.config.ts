import { defineConfig, env } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'node:path';

const envPaths = [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '.env')];
envPaths.forEach((envPath) => {
  dotenv.config({ path: envPath });
});

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL')
  }
});
