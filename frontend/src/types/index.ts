export type FuncaoUsuario = 'admin' | 'corte' | 'fita' | 'furacao' | 'usinagem' | 'montagem' | 'expedicao' | string;

export type ServicoStatus = 'pendente' | 'em_execucao' | 'finalizado';

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
}

export interface Servico {
  id: number;
  pedidoId: number;
  tipoServico: string;
  quantidade: number;
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
  pedidoNumero: string;
  cliente: string;
  tipoServico: string;
  quantidade: number;
  horaInicio: string;
  horaFim: string | null;
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
  porServico: RelatorioServicoResumo[];
  execucoes: RelatorioExecucao[];
}

export interface RelatorioResponse {
  period: RelatorioPeriodo;
  startDate: string | null;
  endDate: string;
  operadores: RelatorioOperador[];
}
