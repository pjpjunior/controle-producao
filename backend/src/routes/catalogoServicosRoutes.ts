import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authMiddlewareWithUserCheck as authMiddleware } from '../middlewares/auth';
import { adminOnly } from '../middlewares/adminOnly';

const router = Router();

const catalogoSchema = z.object({
  nome: z.string().trim().min(3, 'Nome é obrigatório'),
  funcao: z.string().trim().min(2, 'Função é obrigatória'),
  precoPadrao: z.coerce.number().min(0, 'Preço deve ser positivo')
});

const importSchema = z
  .array(
    z.object({
      nome: z.string().trim().min(3, 'Nome é obrigatório'),
      funcao: z.string().trim().min(2, 'Função é obrigatória'),
      precoPadrao: z.coerce.number().min(0, 'Preço deve ser positivo')
    })
  )
  .min(1, 'Envie ao menos um serviço')
  .max(500, 'Importe no máximo 500 itens por vez');

router.use(authMiddleware, adminOnly);

router.get('/', async (_req, res) => {
  try {
    const itens = await prisma.servicoCatalogo.findMany({
      orderBy: { nome: 'asc' }
    });
    res.json(itens.map((item) => ({ ...item, precoPadrao: Number(item.precoPadrao) })));
  } catch (error) {
    console.error('Erro ao listar catálogo de serviços', error);
    res.status(500).json({ message: 'Não foi possível listar o catálogo de serviços' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = catalogoSchema.parse(req.body);
    const item = await prisma.servicoCatalogo.create({
      data: {
        nome: data.nome.trim(),
        funcao: data.funcao.trim().toLowerCase(),
        precoPadrao: data.precoPadrao
      }
    });
    res.status(201).json({ ...item, precoPadrao: Number(item.precoPadrao) });
  } catch (error: any) {
    console.error('Erro ao criar item do catálogo', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Já existe um serviço com esse nome' });
    }
    res.status(500).json({ message: 'Não foi possível criar o item do catálogo' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const parsed = importSchema.parse(req.body?.items ?? req.body);
    const data = parsed.map((item) => ({
      nome: item.nome.trim(),
      funcao: item.funcao.trim().toLowerCase(),
      precoPadrao: item.precoPadrao
    }));

    const result = await prisma.servicoCatalogo.createMany({
      data,
      skipDuplicates: true
    });

    res.json({ imported: result.count });
  } catch (error: any) {
    console.error('Erro ao importar catálogo', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível importar o catálogo' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  try {
    const data = catalogoSchema.partial().parse(req.body);
    const item = await prisma.servicoCatalogo.update({
      where: { id },
      data
    });
    res.json({ ...item, precoPadrao: Number(item.precoPadrao) });
  } catch (error: any) {
    console.error('Erro ao atualizar item do catálogo', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Item não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível atualizar o item do catálogo' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    await prisma.servicoCatalogo.delete({ where: { id } });
    res.json({ message: 'Item removido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover item do catálogo', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Item não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível remover o item do catálogo' });
  }
});

export default router;
