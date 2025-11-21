# Controle de Produção

Sistema completo para controle de ordens de produção (corte, fita, furação, usinagem e demais serviços), composto por frontend em React/Vite e backend em Node.js/Express com PostgreSQL e Prisma.

## Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS + Axios + React Router.
- **Backend:** Node.js + Express + TypeScript + Prisma ORM + JWT + bcrypt.
- **Banco:** PostgreSQL.
- **Infra:** Docker Compose com serviços para frontend, backend, migrações e banco.

## Guia para Contribuidores

Consulte o arquivo [AGENTS.md](./AGENTS.md) para orientações sobre estrutura do projeto, comandos de desenvolvimento, estilo de código, testes e processo de pull requests.

## Pré-requisitos

- Docker e Docker Compose.
- Opcionalmente Node.js 20+ e npm caso queira rodar os pacotes fora do Docker.

## Configuração

1. Copie o arquivo de variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Ajuste os valores conforme necessário:

   - `DATABASE_URL` deve apontar para o Postgres definido no `docker-compose`.
   - `JWT_SECRET` deve ser uma chave segura.
   - `FRONTEND_URL` pode receber múltiplas URLs separadas por vírgula.

## Executando com Docker

```bash
docker compose up --build
```

Serviços disponíveis:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000 (rotas expostas sob `${API_PREFIX}`, padrão `/api`)
- Postgres: localhost:5432 (credenciais em `.env`)

O serviço `migrations` aplica automaticamente as migrations Prisma antes de iniciar o backend.

## Fluxo de uso

1. **Criação do primeiro usuário (admin):**
   - Enquanto não houver usuários cadastrados, o endpoint `POST /api/auth/register` permite criar o primeiro administrador sem autenticação.
   - Body esperado:

     ```json
     {
       "nome": "Admin",
       "email": "admin@empresa.com",
       "senha": "senhaSegura",
       "funcoes": ["admin"]
     }
     ```

2. **Login:** `POST /api/auth/login` retorna token JWT e dados do usuário.
3. **Admin:**
   - Pode cadastrar usuários (`POST /api/auth/register`), pedidos (`POST /api/pedidos`) e serviços (`POST /api/pedidos/:id/servicos`).
   - Consulta geral (`GET /api/pedidos`) mostra status e execuções.
4. **Operador:**
   - Acessa `/operador`, informa o número do pedido (`GET /api/pedidos/:numeroPedido`) e só visualiza os serviços relacionados à sua função.
   - Registra início/fim via `POST /api/servicos/:id/iniciar` e `POST /api/servicos/:id/finalizar`.
5. **Funções personalizadas:**
   - Em `/admin/gestao` é possível criar novas funções/roles (por exemplo `pintura`) que passam a aparecer como checkboxes tanto no cadastro de usuários quanto na atribuição de serviços.
   - A API expõe `GET /api/auth/funcoes` para listar e `POST /api/auth/funcoes` para criar funções; use nomes em minúsculo e combine-os com os tipos de serviço registrados via `POST /api/pedidos/:id/servicos`.

## Scripts principais

### Backend

| Script | Descrição |
| --- | --- |
| `npm run dev` | Executa API em modo desenvolvimento com ts-node-dev. |
| `npm run build` | Compila para `dist/`. |
| `npm run start` | Executa build compilado. |
| `npm run prisma:migrate-dev` | Cria/aplica migrations em ambiente local. |
| `npm run prisma:migrate-deploy` | Aplica migrations existentes (usado no Docker). |
| `npm run prisma:generate` | Regenera o cliente Prisma. |

### Frontend

| Script | Descrição |
| --- | --- |
| `npm run dev` | Inicia Vite em modo desenvolvimento. |
| `npm run build` | Gera build estático. |
| `npm run preview` | Serve o build gerado. |

## Estrutura resumida

- `backend/`
  - `src/`
    - `app.ts`, `server.ts`
    - `config/` (env e Prisma)
    - `middlewares/` (autenticação e admin)
    - `routes/` (auth, pedidos, execução)
  - `prisma/` (schema e migrations)
- `frontend/`
  - `src/`
    - `context/` (AuthProvider que gerencia tokens)
    - `pages/` (Login, Admin e Operador)
    - `components/` (ProtectedRoute, StatusBadge)
    - `lib/api.ts` (instância do Axios com JWT automático)
- `docker-compose.yml` coordena frontend, backend, migrações e Postgres.

## Segurança e próximos passos

- Atualize o `JWT_SECRET` e as senhas de usuários após o primeiro acesso.
- Considere adicionar HTTPS e armazenamento seguro de segredos em produção.
- Expanda relatórios criando endpoints específicos (ex.: produtividade por serviço ou operador).
