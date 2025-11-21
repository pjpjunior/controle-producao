import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

const servicoInclude = {
  execucoes: {
    orderBy: { horaInicio: 'desc' as const },
    include: {
      user: {
        select: { id: true, nome: true, funcoes: true }
      }
    }
  }
};

const mapServicoExecResponse = (
  servico: Prisma.ServicoGetPayload<{ include: typeof servicoInclude }>,
  includePreco: boolean
) => ({
  id: servico.id,
  pedidoId: servico.pedidoId,
  tipoServico: servico.tipoServico,
  quantidade: servico.quantidade,
  observacoes: servico.observacoes,
  status: servico.status,
  precoUnitario: includePreco ? Number(servico.precoUnitario ?? 0) : undefined,
  execucoes: servico.execucoes.map((execucao) => ({
    id: execucao.id,
    horaInicio: execucao.horaInicio,
    horaFim: execucao.horaFim,
    motivoPausa: execucao.motivoPausa,
    quantidadeExecutada: execucao.quantidadeExecutada,
    user: execucao.user
  }))
});

router.use(authMiddleware);

const ensurePermission = (funcoesUsuario: string[] = [], tipoServico: string) => {
  if (funcoesUsuario.includes('admin')) {
    return true;
  }
  return funcoesUsuario.includes(tipoServico);
};

const reportQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'all', 'custom']).default('day'),
    userId: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  })
  .refine(
    (data) => {
      if (data.period !== 'custom') {
        return true;
      }
      return Boolean(data.startDate && data.endDate);
    },
    {
      message: 'Período customizado exige datas inicial e final',
      path: ['startDate']
    }
  );

type ReportPeriod = z.infer<typeof reportQuerySchema>['period'];

const getPeriodStart = (period: ReportPeriod) => {
  if (period === 'all') {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === 'day') {
    return start;
  }

  if (period === 'week') {
    start.setDate(start.getDate() - 7);
    return start;
  }

  start.setMonth(start.getMonth() - 1);
  return start;
};

const normalizeStartOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const normalizeEndOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

const calcularTotalExecutado = async (servicoId: number, ignorarExecucaoId?: number) => {
  const aggregate = await prisma.servicoExecucao.aggregate({
    where: {
      servicoId,
      ...(ignorarExecucaoId ? { NOT: { id: ignorarExecucaoId } } : {})
    },
    _sum: { quantidadeExecutada: true }
  });
  return Number(aggregate._sum.quantidadeExecutada ?? 0);
};

const pauseSchema = z.object({
  quantidadeExecutada: z.coerce.number().int().min(0, 'Quantidade inválida').default(0),
  motivo: z.string().max(200, 'Motivo deve ter no máximo 200 caracteres').optional()
});

const finalizarSchema = z.object({
    quantidadeExecutada: z.coerce.number().int().min(0, 'Quantidade inválida').default(0)
});

router.post('/:id/iniciar', async (req, res) => {
  const servicoId = Number(req.params.id);
  if (Number.isNaN(servicoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const servico = await prisma.servico.findUnique({
      where: { id: servicoId }
    });

    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (!ensurePermission(req.user!.funcoes, servico.tipoServico)) {
      return res.status(403).json({ message: 'Você não tem permissão para executar este serviço' });
    }

    if (servico.status === 'finalizado') {
      return res.status(400).json({ message: 'Serviço já finalizado' });
    }

    if (servico.status === 'em_execucao') {
      return res.status(400).json({ message: 'Serviço já está em execução' });
    }

    const execucaoAberta = await prisma.servicoExecucao.findFirst({
      where: {
        servicoId,
        userId: req.user!.id,
        horaFim: null
      }
    });

    if (execucaoAberta) {
      return res.status(400).json({ message: 'Você já iniciou este serviço. Finalize antes de iniciar novamente.' });
    }

    await prisma.servicoExecucao.create({
      data: {
        servicoId,
        userId: req.user!.id
      }
    });

    const updated = await prisma.servico.update({
      where: { id: servicoId },
      data: { status: 'em_execucao' },
      include: servicoInclude
    });

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.json(mapServicoExecResponse(updated, isAdmin));
  } catch (error) {
    console.error('Erro ao iniciar serviço', error);
    res.status(500).json({ message: 'Não foi possível iniciar o serviço' });
  }
});

router.post('/:id/pausar', async (req, res) => {
  const servicoId = Number(req.params.id);
  if (Number.isNaN(servicoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const { motivo, quantidadeExecutada } = pauseSchema.parse(req.body ?? {});

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId }
    });

    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (!ensurePermission(req.user!.funcoes, servico.tipoServico)) {
      return res.status(403).json({ message: 'Você não tem permissão para executar este serviço' });
    }

    if (servico.status !== 'em_execucao') {
      return res.status(400).json({ message: 'Serviço não está em execução no momento' });
    }

    const execucaoAberta = await prisma.servicoExecucao.findFirst({
      where: {
        servicoId,
        userId: req.user!.id,
        horaFim: null
      },
      orderBy: { horaInicio: 'desc' }
    });

    if (!execucaoAberta) {
      return res.status(400).json({ message: 'Nenhuma execução aberta encontrada para este serviço' });
    }

    const totalExecutado = await calcularTotalExecutado(servicoId, execucaoAberta.id);
    const restante = Math.max(servico.quantidade - totalExecutado, 0);
    if (quantidadeExecutada > restante) {
      return res
        .status(400)
        .json({ message: `Quantidade informada excede o restante do serviço. Restam ${restante} peças.` });
    }

    await prisma.servicoExecucao.update({
      where: { id: execucaoAberta.id },
      data: {
        horaFim: new Date(),
        motivoPausa: motivo?.trim() || null,
        quantidadeExecutada
      }
    });

    const updated = await prisma.servico.update({
      where: { id: servicoId },
      data: { status: 'pausado' },
      include: servicoInclude
    });

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.json(mapServicoExecResponse(updated, isAdmin));
  } catch (error: any) {
    console.error('Erro ao pausar serviço', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível pausar o serviço' });
  }
});

router.post('/:id/finalizar', async (req, res) => {
  const servicoId = Number(req.params.id);
  if (Number.isNaN(servicoId)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    const { quantidadeExecutada } = finalizarSchema.parse(req.body ?? {});

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId }
    });

    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (!ensurePermission(req.user!.funcoes, servico.tipoServico)) {
      return res.status(403).json({ message: 'Você não tem permissão para executar este serviço' });
    }

    if (servico.status === 'pendente') {
      return res.status(400).json({ message: 'Serviço ainda não foi iniciado' });
    }

    const execucaoAberta = await prisma.servicoExecucao.findFirst({
      where: {
        servicoId,
        userId: req.user!.id,
        horaFim: null
      },
      orderBy: { horaInicio: 'desc' }
    });

    if (!execucaoAberta) {
      return res.status(400).json({ message: 'Nenhuma execução aberta encontrada para este serviço' });
    }

    const totalExecutado = await calcularTotalExecutado(servicoId, execucaoAberta.id);
    const restante = Math.max(servico.quantidade - totalExecutado, 0);
    if (quantidadeExecutada > restante) {
      return res
        .status(400)
        .json({ message: `Quantidade informada excede o restante do serviço. Restam ${restante} peças.` });
    }

    await prisma.servicoExecucao.update({
      where: { id: execucaoAberta.id },
      data: { horaFim: new Date(), quantidadeExecutada }
    });

    const updated = await prisma.servico.update({
      where: { id: servicoId },
      data: { status: 'finalizado' },
      include: servicoInclude
    });

    const isAdmin = req.user?.funcoes.includes('admin') ?? false;
    res.json(mapServicoExecResponse(updated, isAdmin));
  } catch (error) {
    console.error('Erro ao finalizar serviço', error);
    res.status(500).json({ message: 'Não foi possível finalizar o serviço' });
  }
});

router.get('/relatorios', async (req, res) => {
  try {
    const { period, userId, startDate: customStart, endDate: customEnd } = reportQuerySchema.parse(req.query);
    const requester = req.user!;
    const includePreco = requester.funcoes.includes('admin');

    let targetUserId: number | null = null;
    if (!requester.funcoes.includes('admin')) {
      targetUserId = requester.id;
    } else if (userId && userId !== 'all') {
      const parsed = Number(userId);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ message: 'Parâmetro userId inválido' });
      }
      targetUserId = parsed;
    }

    const periodStart =
      period === 'custom' ? (customStart ? normalizeStartOfDay(customStart) : null) : getPeriodStart(period);
    const periodEnd =
      period === 'custom'
        ? customEnd
          ? normalizeEndOfDay(customEnd)
          : null
        : (() => {
            const now = new Date();
            now.setMilliseconds(999);
            return now;
          })();

    if (periodStart && periodEnd && periodStart > periodEnd) {
      return res.status(400).json({ message: 'Data inicial deve ser anterior à final' });
    }

    const whereDates =
      periodStart || periodEnd
        ? {
            horaInicio: {
              ...(periodStart ? { gte: periodStart } : {}),
              ...(periodEnd ? { lte: periodEnd } : {})
            }
          }
        : {};

    const execucoes = await prisma.servicoExecucao.findMany({
      where: {
        ...(targetUserId ? { userId: targetUserId } : {}),
        ...whereDates
      },
      include: {
        user: {
          select: { id: true, nome: true, funcoes: true }
        },
        servico: {
          select: {
            id: true,
            tipoServico: true,
            quantidade: true,
            precoUnitario: true,
            observacoes: true,
            pedidoId: true,
            pedido: {
              select: {
                id: true,
                numeroPedido: true,
                cliente: true
              }
            }
          }
        }
      },
      orderBy: { horaInicio: 'desc' }
    });

    const operadoresMap = new Map<
      number,
      {
        userId: number;
        nome: string;
        funcoes: string[];
        totalServicos: number;
        totalQuantidade: number;
        totalValor: number;
        porServico: Record<
          string,
          {
            tipoServico: string;
            totalServicos: number;
            totalQuantidade: number;
          }
        >;
        execucoes: Array<{
          id: number;
          servicoId: number;
          pedidoNumero: string;
          pedidoId: number | null;
          cliente: string;
          tipoServico: string;
          quantidade: number;
          precoUnitario?: number;
          valorTotal?: number;
          horaInicio: Date;
          horaFim: Date | null;
          motivoPausa?: string | null;
          observacoes?: string | null;
        }>;
      }
    >();

  execucoes.forEach((execucao) => {
    const operadorId = execucao.userId;
    if (!operadoresMap.has(operadorId)) {
      operadoresMap.set(operadorId, {
        userId: execucao.user.id,
        nome: execucao.user.nome,
        funcoes: execucao.user.funcoes ?? [],
        totalServicos: 0,
        totalQuantidade: 0,
        totalValor: 0,
        porServico: {},
        execucoes: []
      });
    }
    const operador = operadoresMap.get(operadorId)!;
    operador.totalServicos += 1;
    const quantidadeExecutada = execucao.quantidadeExecutada ?? execucao.servico.quantidade;
    operador.totalQuantidade += quantidadeExecutada;
    const precoUnitario = Number(execucao.servico.precoUnitario ?? 0);
    const valorTotal = precoUnitario * quantidadeExecutada;
    if (includePreco) {
      operador.totalValor += valorTotal;
    }

    const tipo = execucao.servico.tipoServico;
    if (!operador.porServico[tipo]) {
      operador.porServico[tipo] = {
        tipoServico: tipo,
        totalServicos: 0,
        totalQuantidade: 0
      };
    }
    operador.porServico[tipo].totalServicos += 1;
    operador.porServico[tipo].totalQuantidade += execucao.servico.quantidade;

    operador.execucoes.push({
      id: execucao.id,
      servicoId: execucao.servicoId,
      pedidoNumero: execucao.servico.pedido?.numeroPedido ?? '',
      pedidoId: execucao.servico.pedidoId ?? execucao.servico.pedido?.id ?? null,
      cliente: execucao.servico.pedido?.cliente ?? '',
      tipoServico: tipo,
      quantidade: quantidadeExecutada,
      precoUnitario: includePreco ? precoUnitario : undefined,
      valorTotal: includePreco ? valorTotal : undefined,
      horaInicio: execucao.horaInicio,
      horaFim: execucao.horaFim,
      motivoPausa: execucao.motivoPausa,
      observacoes: execucao.servico.observacoes
    });
  });

  const operadores = Array.from(operadoresMap.values()).map((operador) => ({
    userId: operador.userId,
    nome: operador.nome,
    funcoes: operador.funcoes,
    totalServicos: operador.totalServicos,
    totalQuantidade: operador.totalQuantidade,
    totalValor: includePreco ? operador.totalValor : undefined,
    porServico: Object.values(operador.porServico).sort((a, b) => a.tipoServico.localeCompare(b.tipoServico)),
    execucoes: operador.execucoes
  }));

    res.json({
      period,
      startDate: periodStart?.toISOString() ?? null,
      endDate: (periodEnd ?? new Date()).toISOString(),
      operadores
    });
  } catch (error: any) {
    console.error('Erro ao gerar relatório', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Parâmetros inválidos', errors: error.flatten() });
    }
    res.status(500).json({ message: 'Não foi possível gerar o relatório' });
  }
});

export default router;
