import { execSync } from 'child_process';
import prisma from './prisma';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureFuncoesSeed = async () => {
  // Mantém apenas a função admin para liberar criação do primeiro usuário;
  // outras funções e catálogo serão criados manualmente via aplicação.
  await prisma.funcao.upsert({
    where: { nome: 'admin' },
    update: {},
    create: { nome: 'admin' }
  });
};

const logFirstAccessWarning = async () => {
  const totalUsers = await prisma.user.count();
  if (totalUsers === 0) {
    console.log('[DB] Nenhum usuário encontrado. Crie o primeiro administrador em /primeiro-acesso.');
  }
};

export const ensureDatabase = async (retries = 5, intervalMs = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (attempt > 1) {
        console.log('[DB] Conexão restabelecida com sucesso.');
      }
      await ensureFuncoesSeed();
      await logFirstAccessWarning();
      return;
    } catch (error: any) {
      const code = error?.code ?? error?.name ?? 'UNKNOWN';
      const message = error?.message ?? 'Erro desconhecido ao conectar no banco';
      console.warn(`[DB] Falha ao conectar (tentativa ${attempt}/${retries}) - ${code}: ${message}`);

      try {
        console.log('[DB] Tentando criar/atualizar estrutura com prisma migrate deploy...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      } catch (migrateError: any) {
        console.error('[DB] migrate deploy falhou', migrateError?.message ?? migrateError);
      }

      if (attempt === retries) {
        throw error;
      }

      await wait(intervalMs);
    }
  }
};

export default ensureDatabase;
