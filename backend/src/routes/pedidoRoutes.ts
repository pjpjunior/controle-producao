import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authMiddlewareWithUserCheck as authMiddleware } from '../middlewares/auth';
import { adminOnly } from '../middlewares/adminOnly';

const router = Router();

const pedidoInclude = {
  servicos: {
    orderBy: { id: 'asc' as const },
    include: {
      catalogo: { select: { id: true, nome: true, funcao: true } },
      execucoes: {
        orderBy: { horaInicio: 'desc' as const },
        include: {
          user: {
            select: { id: true, nome: true, funcoes: true }
          }
        }
      }
    }
  }
};

router.use(authMiddleware);

const createPedidoSchema = z.object({
  numeroPedido: z.string().min(1, 'Número do pedido é obrigatório'),
  cliente: z.string().min(1, 'Cliente é obrigatório')
});

const mapServicoResponse = (
  servico: Prisma.ServicoGetPayload<{ include: (typeof pedidoInclude)['servicos']['include'] }>,
  includePreco: boolean
) => ({
  id: servico.id,
  pedidoId: servico.pedidoId,
  catalogoId: servico.catalogoId ?? null,
  catalogoNome: servico.catalogo?.nome ?? null,
  catalogoFuncao: servico.catalogo?.funcao ?? null,
  tipoServico: servico.tipoServico,
  quantidade: servico.quantidade,
  observacoes: servico.observacoes,
  status: servico.status,
  precoUnitario: includePreco ? Number(servico.precoUnitario ?? 0) : undefined,
  execucoes: servico.execucoes.map((execucao) => ({
    id: execucao.id,
    horaInicio: execucao.horaInicio,
    horaFim: execucao.horaFim,
    quantidadeExecutada: execucao.quantidadeExecutada,
    motivoPausa: execucao.motivoPausa,
    user: execucao.user
  }))
});

const mapPedidoResponse = (
  pedido: Prisma.PedidoGetPayload<{ include: typeof pedidoInclude }>,
  includePreco: boolean
) => ({
  id: pedido.id,
  numeroPedido: pedido.numeroPedido,
  cliente: pedido.cliente,
  dataCriacao: pedido.dataCriacao,
  servicos: pedido.servicos.map((servico) => mapServicoResponse(servico, includePreco))
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const data = createPedidoSchema.parse(req.body);

    const pedido = await prisma.pedido.create({
      data: {
        numeroPedido: data.numeroPedido,
        cliente: data.cliente
      }
    });

    res.status(201).json(pedido);
  } catch (error: any) {
    console.error('Erro ao criar pedido', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Número de pedido já cadastrado' });
    }
    res.status(500).json({ message: 'Não foi possível criar o pedido' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const pedidoId = Number(req.params.id);
  if (Number.isNaN(pedidoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const execucoesCount = await prisma.servicoExecucao.count({
      where: { servico: { pedidoId } }
    });

    if (execucoesCount > 0) {
      return res
        .status(400)
        .json({ message: 'Não é possível excluir pedidos que já tiveram execuções registradas.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.servico.deleteMany({ where: { pedidoId } });
      await tx.pedido.delete({ where: { id: pedidoId } });
    });
    res.json({ message: 'Pedido removido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover pedido', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível remover o pedido' });
  }
});

router.get('/', adminOnly, async (_req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      orderBy: { dataCriacao: 'desc' },
      include: pedidoInclude
    });
    res.json(pedidos.map((pedido) => mapPedidoResponse(pedido, true)));
  } catch (error) {
    console.error('Erro ao listar pedidos', error);
    res.status(500).json({ message: 'Não foi possível buscar os pedidos' });
  }
});

router.get('/:id/servicos', adminOnly, async (req, res) => {
  const pedidoId = Number(req.params.id);
  if (Number.isNaN(pedidoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const servicos = await prisma.servico.findMany({
      where: { pedidoId },
      orderBy: { id: 'asc' },
      include: pedidoInclude.servicos.include
    });

    res.json(servicos.map((servico) => mapServicoResponse(servico, true)));
  } catch (error) {
    console.error('Erro ao buscar serviços do pedido', error);
    res.status(500).json({ message: 'Não foi possível buscar os serviços' });
  }
});

router.get('/:numeroPedido', async (req, res) => {
  const { numeroPedido } = req.params;
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { numeroPedido },
      include: pedidoInclude
    });

    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.json(mapPedidoResponse(pedido, isAdmin));
  } catch (error) {
    console.error('Erro ao buscar pedido', error);
    res.status(500).json({ message: 'Não foi possível buscar o pedido' });
  }
});

const createServicoSchema = z.object({
  catalogoId: z.number().int().positive().optional(),
  tipoServico: z.string().trim().min(3, 'Tipo de serviço obrigatório').optional(),
  quantidade: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.coerce.number().min(0).default(0),
  observacoes: z.string().optional()
}).refine((data) => Boolean(data.catalogoId || data.tipoServico), {
  message: 'Informe o serviço do catálogo ou um tipo de serviço',
  path: ['tipoServico']
});

const updateServicoSchema = z
  .object({
    catalogoId: z.number().int().positive().optional(),
    tipoServico: z.string().trim().min(3).optional(),
    quantidade: z.coerce.number().int().positive().optional(),
    precoUnitario: z.coerce.number().min(0).optional(),
    observacoes: z.string().optional()
  })
  .refine((data) => Boolean(data.catalogoId || data.tipoServico || data.quantidade || data.precoUnitario || data.observacoes), {
    message: 'Envie ao menos um campo para atualizar o serviço',
    path: ['tipoServico']
  });

router.post('/:id/servicos', adminOnly, async (req, res) => {
  const pedidoId = Number(req.params.id);
  if (Number.isNaN(pedidoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId } });

    const data = createServicoSchema.parse(req.body);
    const precoInformado = req.body?.precoUnitario;

    let tipoServico = data.tipoServico?.trim().toLowerCase() ?? '';
    let observacoes = data.observacoes?.trim() || null;
    let precoUnitario = data.precoUnitario ?? 0;

    if (data.catalogoId) {
      const catalogo = await prisma.servicoCatalogo.findUnique({ where: { id: data.catalogoId } });
      if (!catalogo) {
        return res.status(404).json({ message: 'Serviço de catálogo não encontrado' });
      }
      tipoServico = catalogo.funcao;
      observacoes = observacoes || catalogo.nome;
      if (typeof precoInformado === 'undefined') {
        precoUnitario = Number(catalogo.precoPadrao ?? 0);
      }
    }

    const servico = await prisma.servico.create({
      data: {
        pedidoId,
        catalogoId: data.catalogoId,
        tipoServico,
        quantidade: data.quantidade,
        precoUnitario,
        observacoes
      },
      include: pedidoInclude.servicos.include
    });

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.status(201).json(mapServicoResponse(servico, isAdmin));
  } catch (error: any) {
    console.error('Erro ao criar serviço', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    res.status(500).json({ message: 'Não foi possível criar o serviço' });
  }
});

router.patch('/:pedidoId/servicos/:servicoId', adminOnly, async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const servicoId = Number(req.params.servicoId);
  if (Number.isNaN(pedidoId) || Number.isNaN(servicoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const servico = await prisma.servico.findFirst({ where: { id: servicoId, pedidoId } });
    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    const parsed = updateServicoSchema.parse(req.body);
    const precoInformado = req.body?.precoUnitario;

    let tipoServico = parsed.tipoServico?.trim().toLowerCase() ?? servico.tipoServico;
    let observacoes = typeof parsed.observacoes === 'string' ? parsed.observacoes.trim() : servico.observacoes;
    let precoUnitario = typeof parsed.precoUnitario === 'number' ? parsed.precoUnitario : Number(servico.precoUnitario ?? 0);
    let catalogoId = parsed.catalogoId ?? servico.catalogoId ?? null;

    if (parsed.catalogoId) {
      const catalogo = await prisma.servicoCatalogo.findUnique({ where: { id: parsed.catalogoId } });
      if (!catalogo) {
        return res.status(404).json({ message: 'Serviço de catálogo não encontrado' });
      }
      tipoServico = catalogo.funcao;
      if (typeof parsed.observacoes === 'undefined') {
        observacoes = catalogo.nome;
      }
      if (typeof precoInformado === 'undefined') {
        precoUnitario = Number(catalogo.precoPadrao ?? 0);
      }
      catalogoId = catalogo.id;
    }

    const updated = await prisma.servico.update({
      where: { id: servicoId },
      data: {
        catalogoId,
        tipoServico,
        quantidade: parsed.quantidade ?? servico.quantidade,
        precoUnitario,
        observacoes
      },
      include: pedidoInclude.servicos.include
    });

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.json(mapServicoResponse(updated, isAdmin));
  } catch (error: any) {
    console.error('Erro ao atualizar serviço', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível atualizar o serviço' });
  }
});

router.delete('/:pedidoId/servicos/:servicoId', adminOnly, async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const servicoId = Number(req.params.servicoId);
  if (Number.isNaN(pedidoId) || Number.isNaN(servicoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const servico = await prisma.servico.findFirst({ where: { id: servicoId, pedidoId } });
    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    await prisma.servico.delete({ where: { id: servicoId } });
    res.json({ message: 'Serviço removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover serviço', error);
    res.status(500).json({ message: 'Não foi possível remover o serviço' });
  }
});

export default router;
