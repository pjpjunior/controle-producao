import app from './app';
import env from './config/env';

const start = async () => {
  const port = env.port;

  app.listen(port, () => {
    console.log(`API em execução na porta ${port}`);
    console.log(`Prefixo base: ${env.apiPrefix}`);
  });
};

start();
