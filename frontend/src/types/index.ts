export type FuncaoUsuario = 'admin' | 'corte' | 'fita' | 'furacao' | 'usinagem' | 'montagem' | 'expedicao' | string;

export type ServicoStatus = 'pendente' | 'em_execucao' | 'pausado' | 'finalizado';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  funcoes: FuncaoUsuario[];
  ativo: boolean;
}

export interface ServicoExecucao {
  id: number;
  user: {
    id: number;
    nome: string;
    funcoes: FuncaoUsuario[];
  };
  horaInicio: string;
  horaFim?: string | null;
  motivoPausa?: string | null;
  quantidadeExecutada?: number;
}

export interface Servico {
  id: number;
  pedidoId: number;
  catalogoId?: number | null;
  catalogoNome?: string | null;
  catalogoFuncao?: string | null;
  tipoServico: string;
  quantidade: number;
  precoUnitario?: number;
  observacoes?: string | null;
  status: ServicoStatus;
  execucoes: ServicoExecucao[];
}

export interface Pedido {
  id: number;
  numeroPedido: string;
  cliente: string;
  dataCriacao: string;
  servicos: Servico[];
}

export type RelatorioPeriodo = 'day' | 'week' | 'month' | 'all' | 'custom';

export interface RelatorioExecucao {
  id: number;
  servicoId: number;
  pedidoId: number | null;
  pedidoNumero: string;
  cliente: string;
  tipoServico: string;
  quantidade: number;
  precoUnitario?: number;
  valorTotal?: number;
  horaInicio: string;
  horaFim: string | null;
  observacoes?: string | null;
  motivoPausa?: string | null;
  catalogoId?: number | null;
  catalogoNome?: string | null;
}

export interface RelatorioServicoResumo {
  tipoServico: string;
  totalServicos: number;
  totalQuantidade: number;
}

export interface RelatorioOperador {
  userId: number;
  nome: string;
  funcoes: FuncaoUsuario[];
  totalServicos: number;
  totalQuantidade: number;
  totalValor?: number;
  porServico: RelatorioServicoResumo[];
  execucoes: RelatorioExecucao[];
}

export interface RelatorioResponse {
  period: RelatorioPeriodo;
  startDate: string | null;
  endDate: string;
  operadores: RelatorioOperador[];
}
