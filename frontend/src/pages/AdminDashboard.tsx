import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Pedido } from '../types';

const DEFAULT_SERVICE_OPTIONS = ['corte', 'fita', 'furacao', 'usinagem', 'montagem', 'expedicao'];

type ServicoSelecionado = {
  id: string;
  tipo: string;
  quantidade: number;
  precoUnitario: number;
  precoUnitarioInput: string;
  observacoes: string;
};

interface FuncaoDisponivel {
  id: number;
  nome: string;
  createdAt: string;
}

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
    servicos: [] as ServicoSelecionado[]
  });
  const [novoServicoSelecionado, setNovoServicoSelecionado] = useState<string>('');
  const servicoIdCounter = useRef(0);

  const parseQuantidadeInput = (valor: string) => {
    const cleaned = valor.replace(/\D/g, '');
    return cleaned ? Number(cleaned) : 0;
  };

  const parsePrecoInput = (valor: string) => {
    const normalized = valor.replace(',', '.').replace(/[^0-9.]/g, '');
    if (!normalized) return 0;
    const [inteiro, ...decimais] = normalized.split('.');
    const decimalPart = decimais.join('').slice(0, 2);
    const final = decimalPart ? `${inteiro || '0'}.${decimalPart}` : inteiro || '0';
    const parsed = Number(final);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  }, []);

  const syncServiceOptions = useCallback((options: string[]) => {
    setServiceOptions(options);
    setNovoPedidoForm((previous) => ({
      ...previous,
      servicos: previous.servicos.filter((servico) => options.includes(servico.tipo))
    }));
    setNovoServicoSelecionado((current) => (options.includes(current) ? current : ''));
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

  useEffect(() => {
    if (serviceOptions.length === 0) {
      setNovoServicoSelecionado('');
      return;
    }
    if (!novoServicoSelecionado || !serviceOptions.includes(novoServicoSelecionado)) {
      setNovoServicoSelecionado(serviceOptions[0]);
    }
  }, [novoServicoSelecionado, serviceOptions]);

  const createServicoSelecionado = useCallback(
    (tipo: string): ServicoSelecionado => ({
      id: `serv-${Date.now()}-${servicoIdCounter.current++}`,
      tipo,
      quantidade: 0,
      precoUnitario: 0,
      precoUnitarioInput: '',
      observacoes: ''
    }),
    [servicoIdCounter]
  );

  const handleAddServico = () => {
    if (!novoServicoSelecionado) {
      return;
    }
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: [
        ...prev.servicos,
        createServicoSelecionado(novoServicoSelecionado)
      ]
    }));
  };

  const handleUpdateServico = (id: string, changes: Partial<ServicoSelecionado>) => {
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: prev.servicos.map((servico) => (servico.id === id ? { ...servico, ...changes } : servico))
    }));
  };

  const handleRemoveServico = (id: string) => {
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: prev.servicos.filter((servico) => servico.id !== id)
    }));
  };

  const handleCreatePedido = async (event: FormEvent) => {
    event.preventDefault();
    if (serviceOptions.length === 0) {
      return showFeedback('error', 'Cadastre funções de serviço antes de criar pedidos.');
    }
    const servicosValidos = novoPedidoForm.servicos.filter((servico) => servico.quantidade && servico.quantidade > 0);

    if (servicosValidos.length === 0) {
      return showFeedback('error', 'Informe ao menos um serviço com quantidade maior que zero.');
    }

    try {
      const { data: pedido } = await api.post('/pedidos', {
        numeroPedido: novoPedidoForm.numeroPedido,
        cliente: novoPedidoForm.cliente
      });

      try {
        for (const servico of servicosValidos) {
          await api.post(`/pedidos/${pedido.id}/servicos`, {
            tipoServico: servico.tipo,
            quantidade: servico.quantidade,
            precoUnitario: servico.precoUnitario ?? 0,
            observacoes: servico.observacoes?.trim() ? servico.observacoes.trim() : undefined
          });
        }
        showFeedback('success', `Pedido ${novoPedidoForm.numeroPedido} cadastrado com ${servicosValidos.length} serviço(s).`);
      } catch (serviceError: any) {
        console.error(serviceError);
        showFeedback(
          'error',
          serviceError?.response?.data?.message ??
            'Pedido criado, mas houve erro ao adicionar alguns serviços. Revise na lista.'
        );
      }

      setNovoPedidoForm({ numeroPedido: '', cliente: '', servicos: [] });
      setNovoServicoSelecionado(serviceOptions[0] ?? '');
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
              <p className="text-sm text-slate-400">Selecione os serviços abaixo, informe quantidades e preços.</p>
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
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <select
                      value={novoServicoSelecionado}
                      onChange={(e) => setNovoServicoSelecionado(e.target.value)}
                      className="input w-full md:w-64"
                      disabled={serviceOptions.length === 0}
                    >
                      <option value="" disabled>
                        Selecione um serviço
                      </option>
                      {serviceOptions.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddServico}
                      disabled={!novoServicoSelecionado}
                      className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      + Adicionar serviço
                    </button>
                  </div>

                  {novoPedidoForm.servicos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum serviço selecionado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {novoPedidoForm.servicos.map((servico, index) => {
                        const total = servico.quantidade * servico.precoUnitario;
                        return (
                          <div
                            key={servico.id}
                            className="border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950/40 space-y-3"
                          >
                            <div className="flex flex-wrap items-center gap-3 justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 uppercase">Serviço #{index + 1}</span>
                                <select
                                  value={servico.tipo}
                                  onChange={(e) => handleUpdateServico(servico.id, { tipo: e.target.value })}
                                  className="input mt-1 w-40 uppercase"
                                >
                                  {serviceOptions.map((tipo) => (
                                    <option key={`${servico.id}-${tipo}`} value={tipo}>
                                      {tipo.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveServico(servico.id)}
                                className="text-xs text-red-300 hover:text-red-200"
                              >
                                Remover
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-slate-400 text-sm">
                                <span className="uppercase text-xs">Qtd.</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={servico.quantidade === 0 ? '' : String(servico.quantidade)}
                                  onChange={(e) =>
                                    handleUpdateServico(servico.id, { quantidade: parseQuantidadeInput(e.target.value) })
                                  }
                                  className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-right"
                                />
                              </label>
                              <label className="flex items-center gap-2 text-slate-400 text-sm">
                                <span className="uppercase text-xs">Preço unit.</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={servico.precoUnitarioInput}
                                  placeholder="0,00"
                                  onChange={(e) => {
                                    const texto = e.target.value;
                                    handleUpdateServico(servico.id, {
                                      precoUnitario: parsePrecoInput(texto),
                                      precoUnitarioInput: texto
                                    });
                                  }}
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
                            <div>
                              <label className="text-xs uppercase text-slate-500 block mb-1">Observações</label>
                              <textarea
                                value={servico.observacoes}
                                onChange={(e) => handleUpdateServico(servico.id, { observacoes: e.target.value })}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                rows={2}
                                placeholder="Ex.: Necessário material específico, prioridade etc."
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                <div key={pedido.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <span className="font-semibold text-white">Pedido #{pedido.numeroPedido}</span>
                      <span className="text-slate-500">|</span>
                      <span>Cliente {pedido.cliente}</span>
                      <span className="text-slate-500">|</span>
                      <span>Criado em {pedido.dataFormatada}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePedido(pedido.id, pedido.numeroPedido)}
                      className="rounded-xl border border-red-500/60 text-red-300 px-4 py-2 text-sm hover:bg-red-500/10 transition w-full md:w-auto"
                    >
                      Excluir pedido
                    </button>
                  </div>

                  <div className="text-sm text-slate-300">
                    Valor bruto:{' '}
                    <span className="font-semibold text-white">
                      {pedido.servicos
                        .reduce(
                          (acc, servico) => acc + (Number(servico.precoUnitario ?? 0) * servico.quantidade),
                          0
                        )
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pedido.servicos.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhum serviço adicionado para este pedido.</p>
                    )}
                    {pedido.servicos.map((servico) => {
                      const precoUnitario = Number(servico.precoUnitario ?? 0);
                      const valorTotal = precoUnitario * servico.quantidade;
                      return (
                        <div
                          key={servico.id}
                          className="border border-slate-800 rounded-2xl p-3 bg-slate-950/40 text-sm text-slate-300"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold uppercase text-white">{servico.tipoServico}</span>
                            <span className="font-semibold text-white">
                              {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Qtde: <span className="text-white font-semibold">{servico.quantidade}</span> · Preço unit.:{' '}
                            <span className="text-white font-semibold">
                              {precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
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
