import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { Pedido } from '../types';
import AdminNavBar from '../components/AdminNavBar';

type ServicoCatalogo = {
  id: number;
  nome: string;
  funcao: string;
  precoPadrao: number;
  createdAt: string;
};

type ServicoSelecionado = {
  id: string;
  catalogoId: number | null;
  nome: string;
  funcao: string;
  quantidade: number;
  precoUnitario: number;
  precoUnitarioInput: string;
};

interface FuncaoDisponivel {
  id: number;
  nome: string;
  createdAt: string;
}

const AdminDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catalogo, setCatalogo] = useState<ServicoCatalogo[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(true);

  const [novoPedidoForm, setNovoPedidoForm] = useState({
    numeroPedido: '',
    cliente: '',
    servicos: [] as ServicoSelecionado[]
  });
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

  const fetchCatalogo = useCallback(async () => {
    setCatalogoLoading(true);
    try {
      const { data } = await api.get<ServicoCatalogo[]>('/catalogo-servicos');
      setCatalogo(data);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Não foi possível carregar o catálogo de serviços');
    } finally {
      setCatalogoLoading(false);
    }
  }, [showFeedback]);

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
    fetchCatalogo();
  }, [fetchCatalogo]);

  const createServicoSelecionado = useCallback(
    (item: ServicoCatalogo | null): ServicoSelecionado => ({
      id: `serv-${Date.now()}-${servicoIdCounter.current++}`,
      catalogoId: item?.id ?? null,
      nome: item?.nome ?? '',
      funcao: item?.funcao ?? '',
      quantidade: 1,
      precoUnitario: item?.precoPadrao ?? 0,
      precoUnitarioInput: item ? item.precoPadrao.toFixed(2).replace('.', ',') : ''
    }),
    [servicoIdCounter]
  );

  const handleAddServico = () => {
    const first = catalogo[0] ?? null;
    if (!first) {
      return showFeedback('error', 'Cadastre itens no catálogo de serviços antes de adicionar linhas.');
    }
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: [
        ...prev.servicos,
        createServicoSelecionado(first)
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
    const servicosValidos = novoPedidoForm.servicos.filter(
      (servico) => servico.quantidade && servico.quantidade > 0 && servico.funcao
    );

    if (servicosValidos.length === 0) {
      return showFeedback('error', 'Informe ao menos um serviço com função e quantidade maior que zero.');
    }

    try {
      const { data: pedido } = await api.post('/pedidos', {
        numeroPedido: novoPedidoForm.numeroPedido,
        cliente: novoPedidoForm.cliente
      });

      try {
        for (const servico of servicosValidos) {
          await api.post(`/pedidos/${pedido.id}/servicos`, {
            tipoServico: servico.funcao,
            quantidade: servico.quantidade,
            precoUnitario: servico.precoUnitario ?? 0,
            observacoes: servico.nome ? servico.nome : undefined
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
      <AdminNavBar title="Painel do Administrador" subtitle="Criar pedidos e atribuir serviços" />

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
              <p className="text-sm text-slate-400">Informe número e cliente, adicione linhas de serviço e salve o pedido.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
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
              <button type="submit" className="btn-primary w-full md:w-auto">
                Salvar pedido
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-400">Planilha de serviços</p>
              <button
                type="button"
                onClick={handleAddServico}
                disabled={catalogo.length === 0}
                className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                + Adicionar linha
              </button>
            </div>

            {catalogoLoading ? (
              <div className="grid md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-32 rounded-2xl bg-slate-900/70 animate-pulse" />
                ))}
              </div>
            ) : catalogo.length === 0 ? (
              <p className="text-sm text-slate-500">
                Cadastre itens no catálogo de serviços para liberar as linhas de pedido.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                <table className="min-w-full text-sm text-slate-200">
                  <thead className="bg-slate-900/60 text-left uppercase text-xs tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Serviço</th>
                      <th className="px-3 py-2 w-32">Qtd.</th>
                      <th className="px-3 py-2 w-32">Preço</th>
                      <th className="px-3 py-2 w-24 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novoPedidoForm.servicos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-sm text-slate-500 text-center">
                          Nenhum serviço na planilha. Clique em Salvar para inserir uma linha e depois ajuste serviço,
                          quantidade e preço.
                        </td>
                      </tr>
                    ) : (
                      novoPedidoForm.servicos.map((servico) => {
                        return (
                          <tr key={servico.id} className="border-t border-slate-800">
                            <td className="px-3 py-2">
                              <select
                                value={servico.catalogoId ?? ''}
                                onChange={(e) => {
                                  const novoId = Number(e.target.value);
                                  const item = catalogo.find((c) => c.id === novoId) ?? null;
                                  handleUpdateServico(servico.id, {
                                    catalogoId: item?.id ?? null,
                                    nome: item?.nome ?? '',
                                    funcao: item?.funcao ?? '',
                                    precoUnitario: item?.precoPadrao ?? servico.precoUnitario,
                                    precoUnitarioInput: item ? item.precoPadrao.toFixed(2).replace('.', ',') : servico.precoUnitarioInput
                                  });
                                }}
                                className="input w-full uppercase"
                              >
                                <option value="" disabled>
                                  Selecione
                                </option>
                                {catalogo.map((item) => (
                                  <option key={`${servico.id}-${item.id}`} value={item.id}>
                                    {item.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={servico.quantidade === 0 ? '' : String(servico.quantidade)}
                                onChange={(e) =>
                                  handleUpdateServico(servico.id, { quantidade: parseQuantidadeInput(e.target.value) })
                                }
                                className="input text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
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
                                className="input text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveServico(servico.id)}
                                className="text-xs text-red-300 hover:text-red-200"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}

                  </tbody>
                </table>
              </div>
            )}
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
