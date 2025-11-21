import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Pedido } from '../types';
import StatusBadge from '../components/StatusBadge';

const DEFAULT_SERVICE_OPTIONS = ['corte', 'fita', 'furacao', 'usinagem', 'montagem', 'expedicao'];

type NovoPedidoServicos = Record<
  string,
  {
    quantidade: number;
    precoUnitario: number;
  }
>;

interface FuncaoDisponivel {
  id: number;
  nome: string;
  createdAt: string;
}

const createEmptyServicos = (options: string[] = []): NovoPedidoServicos =>
  options.reduce<NovoPedidoServicos>((acc, tipo) => {
    acc[tipo] = { quantidade: 0, precoUnitario: 0 };
    return acc;
  }, {});

const mergeServicosComOpcoes = (options: string[], atual: NovoPedidoServicos): NovoPedidoServicos => {
  const base = createEmptyServicos(options);
  options.forEach((tipo) => {
    if (atual[tipo]) {
      base[tipo] = atual[tipo];
    }
  });
  return base;
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [serviceOptionsLoading, setServiceOptionsLoading] = useState(true);

  const [novoPedidoForm, setNovoPedidoForm] = useState({
    numeroPedido: '',
    cliente: '',
    servicos: createEmptyServicos()
  });

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  }, []);

  const syncServiceOptions = useCallback((options: string[]) => {
    setServiceOptions(options);
    setNovoPedidoForm((previous) => ({
      ...previous,
      servicos: mergeServicosComOpcoes(options, previous.servicos)
    }));
  }, []);

  const fetchFuncoesOperacionais = useCallback(async () => {
    setServiceOptionsLoading(true);
    try {
      const { data } = await api.get<FuncaoDisponivel[]>('/auth/funcoes');
      const operacionais = data.map((funcao) => funcao.nome).filter((nome) => nome !== 'admin');
      syncServiceOptions(operacionais);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Não foi possível carregar as funções de serviço');
      syncServiceOptions(DEFAULT_SERVICE_OPTIONS);
    } finally {
      setServiceOptionsLoading(false);
    }
  }, [showFeedback, syncServiceOptions]);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Pedido[]>('/pedidos');
      setPedidos(data);
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Falha ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [showFeedback]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    fetchFuncoesOperacionais();
  }, [fetchFuncoesOperacionais]);

  const handleCreatePedido = async (event: FormEvent) => {
    event.preventDefault();
    if (serviceOptions.length === 0) {
      return showFeedback('error', 'Cadastre funções de serviço antes de criar pedidos.');
    }
    const servicosSelecionados = serviceOptions.filter(
      (tipo) => novoPedidoForm.servicos[tipo].quantidade && novoPedidoForm.servicos[tipo].quantidade > 0
    );

    if (servicosSelecionados.length === 0) {
      return showFeedback('error', 'Informe ao menos um serviço com quantidade maior que zero.');
    }

    try {
      const { data: pedido } = await api.post('/pedidos', {
        numeroPedido: novoPedidoForm.numeroPedido,
        cliente: novoPedidoForm.cliente
      });

      try {
        for (const tipo of servicosSelecionados) {
          const dadosServico = novoPedidoForm.servicos[tipo];
          await api.post(`/pedidos/${pedido.id}/servicos`, {
            tipoServico: tipo,
            quantidade: dadosServico.quantidade
          });
        }
        showFeedback('success', `Pedido ${novoPedidoForm.numeroPedido} cadastrado com ${servicosSelecionados.length} serviço(s).`);
      } catch (serviceError: any) {
        console.error(serviceError);
        showFeedback(
          'error',
          serviceError?.response?.data?.message ??
            'Pedido criado, mas houve erro ao adicionar alguns serviços. Revise na lista.'
        );
      }

      setNovoPedidoForm({ numeroPedido: '', cliente: '', servicos: createEmptyServicos(serviceOptions) });
      fetchPedidos();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao criar pedido');
    }
  };

  const handleDeleteServico = async (pedidoId: number, servicoId: number, tipoServico: string) => {
    const confirmar = window.confirm(`Deseja remover o serviço ${tipoServico.toUpperCase()} deste pedido?`);
    if (!confirmar) {
      return;
    }

    try {
      await api.delete(`/pedidos/${pedidoId}/servicos/${servicoId}`);
      showFeedback('success', 'Serviço removido com sucesso');
      fetchPedidos();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao remover serviço');
    }
  };

  const handleDeletePedido = async (pedidoId: number, numeroPedido: string) => {
    const confirmar = window.confirm(`Excluir o pedido #${numeroPedido}? Todos os serviços serão removidos.`);
    if (!confirmar) {
      return;
    }

    try {
      await api.delete(`/pedidos/${pedidoId}`);
      showFeedback('success', `Pedido #${numeroPedido} removido`);
      fetchPedidos();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao remover pedido');
    }
  };

  const formattedPedidos = useMemo(
    () =>
      pedidos.map((pedido) => ({
        ...pedido,
        dataFormatada: new Date(pedido.dataCriacao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      })),
    [pedidos]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Controle de Produção</p>
            <h1 className="text-xl font-semibold">Painel do Administrador</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.nome}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/gestao" className="btn-secondary text-slate-200">
                Gestão
              </Link>
              <Link to="/relatorios" className="btn-secondary text-slate-200">
                Relatórios
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:border-red-400 hover:text-red-300 transition text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {feedback && (
          <div
            className={`p-4 rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-emerald-400/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-400/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section>
          <form onSubmit={handleCreatePedido} className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Criar Pedido</h2>
              <p className="text-sm text-slate-400">Insira o número do pedido.</p>
            </div>
            <input
              placeholder="Número do pedido"
              value={novoPedidoForm.numeroPedido}
              onChange={(e) => setNovoPedidoForm({ ...novoPedidoForm, numeroPedido: e.target.value })}
              className="input"
              required
            />
            <input
              placeholder="Cliente"
              value={novoPedidoForm.cliente}
              onChange={(e) => setNovoPedidoForm({ ...novoPedidoForm, cliente: e.target.value })}
              className="input"
              required
            />
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Informe quantidade e preço unitário para cada serviço (0 para ignorar).</p>
              {serviceOptionsLoading ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-32 rounded-2xl bg-slate-900/70 animate-pulse" />
                  ))}
                </div>
              ) : serviceOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Cadastre funções operacionais para liberar os serviços disponíveis.
                </p>
              ) : (
                <div className="space-y-2">
                  {serviceOptions.map((tipo) => {
                    const quantidade = novoPedidoForm.servicos[tipo].quantidade;
                    const precoUnitario = novoPedidoForm.servicos[tipo].precoUnitario;
                    const total = quantidade * precoUnitario;
                    return (
                      <div key={tipo} className="border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950/40">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold uppercase w-full sm:w-32">{tipo}</span>
                          <label className="flex items-center gap-2 text-slate-400 text-sm">
                            <span className="uppercase text-xs">Qtd.</span>
                            <input
                              type="number"
                              min={0}
                              value={quantidade}
                              onChange={(e) =>
                                setNovoPedidoForm((prev) => ({
                                  ...prev,
                                  servicos: {
                                    ...prev.servicos,
                                    [tipo]: {
                                      ...prev.servicos[tipo],
                                      quantidade: Number(e.target.value)
                                    }
                                  }
                                }))
                              }
                              className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-right"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-slate-400 text-sm">
                            <span className="uppercase text-xs">Preço unit.</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={precoUnitario}
                              onChange={(e) =>
                                setNovoPedidoForm((prev) => ({
                                  ...prev,
                                  servicos: {
                                    ...prev.servicos,
                                    [tipo]: {
                                      ...prev.servicos[tipo],
                                      precoUnitario: Number(e.target.value)
                                    }
                                  }
                                }))
                              }
                              className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-right"
                            />
                          </label>
                          <div className="ml-auto text-right text-sm font-semibold text-slate-200">
                            Total{' '}
                            {Number.isFinite(total)
                              ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'R$ 0,00'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary">
              Salvar pedido e serviços selecionados
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pedidos cadastrados</h2>
              <p className="text-sm text-slate-400">Acompanhe o andamento dos serviços por área.</p>
            </div>
            <button onClick={fetchPedidos} className="px-4 py-2 rounded-xl border border-slate-700 hover:border-sky-500 text-sm">
              Atualizar lista
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 bg-slate-900/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : formattedPedidos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum pedido cadastrado até o momento.</p>
          ) : (
            <div className="space-y-4">
              {formattedPedidos.map((pedido) => (
                <div key={pedido.id} className="card space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Pedido</p>
                      <p className="text-lg font-semibold">#{pedido.numeroPedido}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Cliente</p>
                      <p className="text-lg">{pedido.cliente}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Criado em</p>
                      <p className="text-lg">{pedido.dataFormatada}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePedido(pedido.id, pedido.numeroPedido)}
                      className="rounded-xl border border-red-500/60 text-red-300 px-4 py-2 text-sm hover:bg-red-500/10 transition w-full md:w-auto"
                    >
                      Excluir pedido
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pedido.servicos.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhum serviço adicionado para este pedido.</p>
                    )}
                    {pedido.servicos.map((servico) => {
                      const ultimaExecucao = servico.execucoes[0];
                      return (
                        <div key={servico.id} className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-lg font-semibold uppercase">{servico.tipoServico}</div>
                            <StatusBadge status={servico.status} />
                          </div>
                          <p className="text-sm text-slate-300">
                            Quantidade: <span className="font-semibold text-white">{servico.quantidade}</span>
                          </p>
                          {servico.observacoes && (
                            <p className="text-sm text-slate-400">
                              <span className="font-semibold text-slate-300">Observações:</span> {servico.observacoes}
                            </p>
                          )}
                          <p className="text-xs text-slate-400">
                            {ultimaExecucao
                              ? `Última atualização: ${ultimaExecucao.user.nome} ${
                                  ultimaExecucao.horaFim ? 'finalizou' : 'iniciou'
                                } em ${new Date(
                                  ultimaExecucao.horaFim ?? ultimaExecucao.horaInicio
                                ).toLocaleString('pt-BR')}`
                              : 'Nenhuma execução registrada'}
                          </p>

                          {servico.execucoes.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead>
                                  <tr className="text-xs uppercase text-slate-400 border-b border-slate-800">
                                    <th className="py-2">Operador</th>
                                    <th className="py-2">Função</th>
                                    <th className="py-2">Início</th>
                                    <th className="py-2">Fim</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {servico.execucoes.map((execucao) => (
                                    <tr key={execucao.id} className="border-b border-slate-900/60 last:border-0">
                                      <td className="py-2 text-slate-200">{execucao.user.nome}</td>
                                      <td className="py-2 text-slate-400 uppercase">
                                        {execucao.user.funcoes.map((funcao) => funcao.toUpperCase()).join(' / ')}
                                      </td>
                                      <td className="py-2 text-slate-300">
                                        {new Date(execucao.horaInicio).toLocaleString('pt-BR')}
                                      </td>
                                      <td className="py-2 text-slate-300">
                                        {execucao.horaFim ? new Date(execucao.horaFim).toLocaleString('pt-BR') : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
