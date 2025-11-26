# Repository Guidelines

## Estrutura do Projeto e Organização dos Módulos
O backend fica em `backend/`: `src/app.ts` monta o app Express, `src/server.ts` controla o bootstrap e as pastas `config/`, `middlewares/` e `routes/` separam carregamento de env, guardas e controladores HTTP. Esquemas e migrações residem em `backend/prisma/`; atualize `schema.prisma` e rode `npm run prisma:generate` antes de enviar alterações. O frontend está em `frontend/src`, onde `pages/` trazem Login/Admin/Operador, `components/` concentra peças reutilizáveis como `StatusBadge`, `context/AuthContext.tsx` mantém o estado autenticado e `lib/api.ts` encapsula o Axios com JWT. O `docker-compose.yml` sobe todos os serviços, enquanto `pgdata/` guarda o volume do Postgres e pode ser limpo quando precisar reiniciar o banco local.

## Comandos de Build, Teste e Desenvolvimento
- `docker compose up --build`: compila as imagens, dispara as migrações Prisma via serviço `migrations` e publica frontend (8080), backend (3000) e banco (5432).
- `cd backend && npm run dev`: executa a API com `ts-node-dev`; combine `npm run build && npm run start` para testar o bundle, e sempre aplique mudanças de schema com `npm run prisma:migrate-dev`.
- `cd frontend && npm run dev`: inicia o Vite com hot reload; use `npm run build && npm run preview` para validar o pacote estático antes de publicar.

## Estilo de Código e Convenções de Nomenclatura
Ambos os pacotes rodam TypeScript estrito (ver `tsconfig.json`), então não abra PRs com erros de tipagem. Padrão recomendado: indentação de 2 espaços, ponto e vírgula final e aspas simples, como em `frontend/src/components/StatusBadge.tsx`. Componentes React e tipos usam PascalCase (`AuthProvider`, `ServicoStatus`), funções e hooks ficam em camelCase, e arquivos de rotas devem refletir o recurso (`routes/pedidos.ts`). Ao usar Tailwind, ordene utilitários do mais genérico ao específico para reduzir diffs. Não há linter obrigatório; aplique seu formatador, mas evite mudanças cosméticas isoladas.

## Diretrizes de Testes
Ainda não existem testes automatizados, portanto descreva no PR os passos manuais realizados (ex.: criar pedido via `POST /api/pedidos`, validar fluxo `/operador`). Ao introduzir testes, mantenha-os próximos ao módulo (`backend/src/pedidos/__tests__/*.test.ts`, `frontend/src/pages/__tests__/*.test.tsx`) e padronize ferramentas: Jest + Supertest para API, Vitest + React Testing Library para o frontend. Cubra novas regras de negócio (autenticação, transições de status) e providencie seeds ou factories para cenários complexos.

## Diretrizes de Commits e Pull Requests
Os commits recentes (`Adjust Postgres volume path`, `Setup Stripe .env`) ilustram o formato preferido: mensagens curtas, imperativas e em inglês. Mantenha o resumo abaixo de 50 caracteres, detalhe no corpo se necessário e referencie issues com `Refs #123`. Cada PR deve trazer objetivo, mudanças relevantes, impacto em migrações ou variáveis de ambiente, evidências visuais para ajustes de UI e um plano de testes numerado. Vincule issues relacionadas, solicite revisão de responsáveis de frontend e backend quando alterar contratos compartilhados e aguarde o OK (ou CI) antes de fazer merge.

## Segurança e Dicas de Configuração
Copie `.env.example` para `.env` em cada pacote, mantenha segredos (`JWT_SECRET`, `DATABASE_URL`) fora do git e gere novos valores ao compartilhar dumps. Em Docker, exponha apenas as portas necessárias e prefira `npm run prisma:migrate-deploy` em CI para evitar drift. Quando precisar resetar o banco, apague `pgdata/`, mas não versione esse diretório. Em produção, coloque um proxy HTTPS na frente do backend; em desenvolvimento, configure `FRONTEND_URL` com todas as origens permitidas para não enfrentar erros de CORS.
