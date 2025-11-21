import app from './app';
import env from './config/env';
import { ensureDatabase } from './config/database';

const start = async () => {
  const port = env.port;

  try {
    await ensureDatabase();

    app.listen(port, () => {
      console.log(`API em execução na porta ${port}`);
      console.log(`Prefixo base: ${env.apiPrefix}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar a API: não foi possível preparar o banco de dados.', error);
    process.exit(1);
  }
};

start();
