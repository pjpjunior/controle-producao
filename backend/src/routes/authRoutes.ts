import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authMiddleware, authMiddlewareWithUserCheck, generateToken } from '../middlewares/auth';
import { adminOnly } from '../middlewares/adminOnly';

const router = Router();

const emailSchema = z
  .string()
  .trim()
  .min(3, 'E-mail obrigatório')
  .regex(/^[^\s@]+@[^\s@]+$/, 'E-mail inválido');

const funcoesArraySchema = z
  .array(
    z
      .string()
      .trim()
      .min(3, 'Função obrigatória')
  )
  .min(1, 'Selecione ao menos uma função');

const registerSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  email: emailSchema,
  senha: z.string().min(6, 'Senha deve conter ao menos 6 caracteres'),
  funcoes: funcoesArraySchema
});

const normalizeFuncoes = (funcoes: readonly string[]) => {
  const lower = funcoes.map((funcao) => funcao.trim().toLowerCase());
  return Array.from(new Set(lower));
};

const findInvalidFuncoes = async (funcoes: string[]) => {
  if (funcoes.length === 0) {
    return [];
  }

  const disponiveis = await prisma.funcao.findMany({
    where: { nome: { in: funcoes } },
    select: { nome: true }
  });

  const validSet = new Set(disponiveis.map((item) => item.nome));
  return funcoes.filter((funcao) => !validSet.has(funcao));
};

const ensureAdminCreationRights = async (req: Request, res: Response, next: NextFunction) => {
  const totalUsers = await prisma.user.count();
  if (totalUsers === 0) {
    return next();
  }

  return authMiddleware(req, res, () => adminOnly(req, res, next));
};

router.post('/register', ensureAdminCreationRights, async (req, res) => {
  try {
    const { nome, email, senha, funcoes } = registerSchema.parse(req.body);
    const funcoesNormalizadas = normalizeFuncoes(funcoes);
    const funcoesInvalidas = await findInvalidFuncoes(funcoesNormalizadas);
    if (funcoesInvalidas.length > 0) {
      return res.status(400).json({
        message: `Funções inválidas: ${funcoesInvalidas.join(', ')}`
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'E-mail já cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({
      data: { nome, email, funcoes: funcoesNormalizadas, senhaHash, ativo: true }
    });

    res.status(201).json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      funcoes: user.funcoes,
      ativo: user.ativo,
      createdAt: user.createdAt
    });
  } catch (error: any) {
    console.error('Erro ao registrar usuário', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível criar o usuário' });
  }
});

router.get('/seed-status', async (_req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    res.json({ hasUsers: totalUsers > 0 });
  } catch (error) {
    console.error('Erro ao consultar usuários existentes', error);
    res.status(500).json({ message: 'Não foi possível verificar usuários existentes' });
  }
});

const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Senha obrigatória')
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuário inativo. Procure o administrador.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, user.senhaHash);
    if (!senhaCorreta) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      funcoes: user.funcoes,
      ativo: user.ativo
    };
    const token = generateToken(payload);

    res.json({ token, user: payload });
  } catch (error: any) {
    console.error('Erro ao autenticar usuário', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível realizar login' });
  }
});

router.get('/me', authMiddlewareWithUserCheck, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        funcoes: true,
        ativo: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erro ao carregar usuário logado', error);
    res.status(500).json({ message: 'Não foi possível carregar o usuário atual' });
  }
});

router.get('/users', authMiddlewareWithUserCheck, adminOnly, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        nome: true,
        email: true,
        funcoes: true,
        ativo: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários', error);
    res.status(500).json({ message: 'Não foi possível buscar os usuários' });
  }
});

router.delete('/users/:id', authMiddlewareWithUserCheck, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Usuário removido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover usuário', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível remover o usuário' });
  }
});

const updateFuncoesSchema = z.object({
  funcoes: funcoesArraySchema
});

const updateStatusSchema = z.object({
  ativo: z.boolean()
});

router.patch('/users/:id/funcoes', authMiddlewareWithUserCheck, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const { funcoes } = updateFuncoesSchema.parse(req.body);
    const funcoesNormalizadas = normalizeFuncoes(funcoes);
    const funcoesInvalidas = await findInvalidFuncoes(funcoesNormalizadas);
    if (funcoesInvalidas.length > 0) {
      return res.status(400).json({
        message: `Funções inválidas: ${funcoesInvalidas.join(', ')}`
      });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { funcoes: funcoesNormalizadas },
      select: {
        id: true,
        nome: true,
        email: true,
        funcoes: true,
        createdAt: true
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar funções do usuário', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível atualizar as funções do usuário' });
  }
});

const createFuncaoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, 'Nome obrigatório')
    .max(30, 'Nome muito longo')
});

router.get('/funcoes', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const funcoes = await prisma.funcao.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        createdAt: true
      }
    });

    res.json(funcoes);
  } catch (error) {
    console.error('Erro ao buscar funções', error);
    res.status(500).json({ message: 'Não foi possível listar as funções disponíveis' });
  }
});

router.post('/funcoes', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome } = createFuncaoSchema.parse(req.body);
    const normalized = nome.trim().toLowerCase();
    const funcao = await prisma.funcao.create({
      data: { nome: normalized }
    });

    res.status(201).json(funcao);
  } catch (error: any) {
    console.error('Erro ao criar função', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Função já cadastrada' });
    }
    res.status(500).json({ message: 'Não foi possível criar a função' });
  }
});

router.delete('/funcoes/:id', authMiddleware, adminOnly, async (req, res) => {
  const funcaoId = Number(req.params.id);
  if (Number.isNaN(funcaoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const funcao = await prisma.funcao.findUnique({ where: { id: funcaoId } });
    if (!funcao) {
      return res.status(404).json({ message: 'Função não encontrada' });
    }

    if (funcao.nome === 'admin') {
      return res.status(400).json({ message: 'Não é permitido remover a função ADMIN.' });
    }

    const usuariosComFuncao = await prisma.user.count({
      where: {
        funcoes: { has: funcao.nome }
      }
    });

    if (usuariosComFuncao > 0) {
      return res
        .status(400)
        .json({ message: 'Remova a função dos usuários associados antes de excluir esta função.' });
    }

    await prisma.funcao.delete({ where: { id: funcaoId } });
    res.json({ message: 'Função removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover função', error);
    res.status(500).json({ message: 'Não foi possível remover a função' });
  }
});

router.patch('/users/:id/status', authMiddlewareWithUserCheck, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const { ativo } = updateStatusSchema.parse(req.body);
    const usuario = await prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (!ativo && usuario.funcoes.includes('admin')) {
      const adminsAtivos = await prisma.user.count({
        where: {
          id: { not: userId },
          funcoes: { has: 'admin' },
          ativo: true
        }
      });
      if (adminsAtivos === 0) {
        return res.status(400).json({ message: 'Mantenha pelo menos um administrador ativo.' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ativo },
      select: {
        id: true,
        nome: true,
        email: true,
        funcoes: true,
        ativo: true,
        createdAt: true
      }
    });
    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar status do usuário', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível atualizar o status do usuário' });
  }
});

export default router;
