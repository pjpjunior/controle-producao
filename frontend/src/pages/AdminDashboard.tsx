import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { Pedido } from '../types';
import AdminNavBar from '../components/AdminNavBar';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';

const safeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uuidv4());

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

const AdminDashboard = () => {
  const criarLinhaVazia = () => ({
    id: safeId(),
    catalogoId: null as number | null,
    nome: '',
    funcao: '',
    quantidade: 0,
    precoUnitario: 0,
    precoUnitarioInput: '0'
  });

  const { user } = useAuth();
  const isAdmin = user?.funcoes.includes('admin') ?? false;
  const isGerente = user?.funcoes.includes('gerente') ?? false;
  const canViewPedidos = isAdmin || isGerente;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catalogo, setCatalogo] = useState<ServicoCatalogo[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(true);
  const [filteredCatalogo, setFilteredCatalogo] = useState<ServicoCatalogo[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState<number | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const suggestionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [editingServicoId, setEditingServicoId] = useState<number | null>(null);
  const [editingPedidoId, setEditingPedidoId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState({ descricao: '', quantidade: '', preco: '' });
  const [editingLoading, setEditingLoading] = useState(false);
  const [lastAddedLineId, setLastAddedLineId] = useState<string | null>(null);

  const [novoPedidoForm, setNovoPedidoForm] = useState({
    numeroPedido: '',
    cliente: '',
    servicos: [criarLinhaVazia()] as ServicoSelecionado[]
  });

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

  const createServicoSelecionado = (servico: ServicoCatalogo): ServicoSelecionado => ({
    id: safeId(),
    catalogoId: servico.id,
    nome: servico.nome,
    funcao: servico.funcao,
    quantidade: 0,
    precoUnitario: servico.precoPadrao,
    precoUnitarioInput: servico.precoPadrao.toFixed(2).replace('.', ',')
  });

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
    if (canViewPedidos) {
      fetchPedidos();
    } else {
      setLoading(false);
      setPedidos([]);
    }
  }, [fetchPedidos, canViewPedidos]);

  useEffect(() => {
    fetchCatalogo();
  }, [fetchCatalogo]);

  const handleServicoNomeChange = (index: number, value: string) => {
    setNovoPedidoForm((prev) => {
      const novo = [...prev.servicos];
      if (!novo[index]) return prev;
      novo[index] = { ...novo[index], nome: value };
      return { ...prev, servicos: novo };
    });

    if (value.length >= 2) {
      const resultados = catalogo.filter((s) => s.nome.toLowerCase().includes(value.toLowerCase()));
      setFilteredCatalogo(resultados);
      suggestionRefs.current = {};
      setAutocompleteIndex(index);
      setSelectedSuggestionIndex(resultados.length > 0 ? 0 : -1);
    } else {
      setFilteredCatalogo([]);
      setAutocompleteIndex(null);
      setSelectedSuggestionIndex(-1);
      suggestionRefs.current = {};
    }
  };

  const handleSelectSugestao = (index: number, servico: ServicoCatalogo) => {
    setNovoPedidoForm((prev) => {
      const novo = [...prev.servicos];
      if (!novo[index]) return prev;
      const quantidadeAtual = novo[index].quantidade && novo[index].quantidade > 0 ? novo[index].quantidade : 0;
      novo[index] = {
        ...novo[index],
        catalogoId: servico.id,
        nome: servico.nome,
        funcao: servico.funcao,
        quantidade: quantidadeAtual,
        precoUnitario: servico.precoPadrao,
        precoUnitarioInput: servico.precoPadrao.toFixed(2).replace('.', ',')
      };
      return { ...prev, servicos: novo };
    });
    setAutocompleteIndex(null);
    setFilteredCatalogo([]);
    setSelectedSuggestionIndex(-1);
    suggestionRefs.current = {};
  };

  const handleQuantidadeChange = (index: number, value: string) => {
    setNovoPedidoForm((prev) => {
      const novo = [...prev.servicos];
      if (!novo[index]) return prev;
      novo[index] = { ...novo[index], quantidade: parseQuantidadeInput(value) };
      return { ...prev, servicos: novo };
    });
  };

  const handleQuantidadeKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const precoInput = document.getElementById(`servico-${novoPedidoForm.servicos[index]?.id}-preco`);
      if (precoInput instanceof HTMLInputElement) {
        precoInput.focus();
      }
    }
  };

  const handleAutocompleteKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (autocompleteIndex !== index || filteredCatalogo.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev + 1) % filteredCatalogo.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev <= 0 ? filteredCatalogo.length - 1 : prev - 1
      );
    } else if (event.key === 'Enter' && selectedSuggestionIndex >= 0) {
      event.preventDefault();
      const servicoSelecionado = filteredCatalogo[selectedSuggestionIndex];
      if (servicoSelecionado) {
        handleSelectSugestao(index, servicoSelecionado);
      }
    } else if (event.key === 'Escape') {
      setAutocompleteIndex(null);
      setFilteredCatalogo([]);
      setSelectedSuggestionIndex(-1);
      suggestionRefs.current = {};
    }
  };

  const handleServicoNomeKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    handleAutocompleteKeyDown(event, index);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const quantidadeInput = document.getElementById(`servico-${novoPedidoForm.servicos[index]?.id}-quantidade`);
      if (quantidadeInput instanceof HTMLInputElement) {
        quantidadeInput.focus();
      }
    }
  };

  useEffect(() => {
    if (selectedSuggestionIndex >= 0) {
      suggestionRefs.current[selectedSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedSuggestionIndex, filteredCatalogo.length, autocompleteIndex]);

  const handlePrecoChange = (index: number, value: string) => {
    setNovoPedidoForm((prev) => {
      const novo = [...prev.servicos];
      if (!novo[index]) return prev;
      novo[index] = {
        ...novo[index],
        precoUnitarioInput: value,
        precoUnitario: parsePrecoInput(value)
      };
      return { ...prev, servicos: novo };
    });
  };

  const adicionarLinha = (focusNewLine = false) => {
    const novaLinha = {
      id: safeId(),
      catalogoId: null,
      nome: '',
      funcao: '',
      quantidade: 0,
      precoUnitario: 0,
      precoUnitarioInput: '0'
    };
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: [...prev.servicos, novaLinha]
    }));
    if (focusNewLine) {
      setLastAddedLineId(novaLinha.id);
    }
  };

  useEffect(() => {
    if (lastAddedLineId) {
      const timeout = setTimeout(() => {
        const input = document.getElementById(`servico-${lastAddedLineId}-nome`);
        if (input instanceof HTMLInputElement) {
          input.focus();
        }
        setLastAddedLineId(null);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [lastAddedLineId]);

  const removerLinha = (index: number) => {
    setNovoPedidoForm((prev) => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== index)
    }));
  };

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

  const handleCreatePedido = async (event: FormEvent) => {
    event.preventDefault();
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
            catalogoId: servico.catalogoId ?? undefined,
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

      setNovoPedidoForm({
        numeroPedido: '',
        cliente: '',
        servicos: [criarLinhaVazia()]
      });
      if (isAdmin) {
        fetchPedidos();
      }
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

  const startEditingServico = (
    pedidoId: number,
    servicoId: number,
    servicoDescricao: string,
    quantidade: number,
    preco: number
  ) => {
    setEditingPedidoId(pedidoId);
    setEditingServicoId(servicoId);
    setEditingForm({
      descricao: servicoDescricao,
      quantidade: String(quantidade),
      preco: preco.toFixed(2).replace('.', ',')
    });
  };

  const submitServicoEdicao = async () => {
    if (!editingPedidoId || !editingServicoId) return;
    const quantidadeNumber = parseQuantidadeInput(editingForm.quantidade);
    const precoNumber = parsePrecoInput(editingForm.preco);
    if (quantidadeNumber <= 0) {
      showFeedback('error', 'Quantidade deve ser maior que zero');
      return;
    }

    setEditingLoading(true);
    try {
      await api.patch(`/pedidos/${editingPedidoId}/servicos/${editingServicoId}`, {
        observacoes: editingForm.descricao.trim(),
        quantidade: quantidadeNumber,
        precoUnitario: precoNumber
      });
      showFeedback('success', 'Serviço atualizado');
      setEditingServicoId(null);
      setEditingPedidoId(null);
      setEditingForm({ descricao: '', quantidade: '', preco: '' });
      fetchPedidos();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao editar serviço');
    } finally {
      setEditingLoading(false);
    }
  };

  const cancelServicoEdicao = () => {
    setEditingServicoId(null);
    setEditingPedidoId(null);
    setEditingForm({ descricao: '', quantidade: '', preco: '' });
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                required
              />
              <input
                placeholder="Cliente"
                value={novoPedidoForm.cliente}
                onChange={(e) => setNovoPedidoForm({ ...novoPedidoForm, cliente: e.target.value })}
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                required
              />
              <button type="submit" className="btn-primary w-full md:w-auto">
                Salvar pedido
              </button>
            </div>

            <p className="text-sm text-slate-400">Planilha de serviços (busque pelo nome para preencher função e preço)</p>

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
              <div className="border border-slate-800 rounded-md mt-6 overflow-hidden bg-slate-900">
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] font-semibold p-3 border-b border-slate-800 bg-slate-800/60 text-slate-100">
                  <div>Serviço</div>
                  <div className="text-right">Quantidade</div>
                  <div className="text-right">Preço</div>
                  <div className="text-center" />
                </div>

                {novoPedidoForm.servicos.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center py-3 px-2 border-b border-slate-800 bg-slate-900 text-slate-100"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        id={`servico-${item.id}-nome`}
                        value={item.nome}
                        onChange={(e) => handleServicoNomeChange(index, e.target.value)}
                        onKeyDown={(e) => handleServicoNomeKeyDown(e, index)}
                        placeholder="Serviço"
                        className="border border-slate-700 rounded p-2 w-full bg-slate-950 text-slate-100"
                      />

                    {autocompleteIndex === index && filteredCatalogo.length > 0 && (
                        <div className="absolute bg-slate-900 shadow-md rounded mt-1 w-full z-50 border border-slate-700 max-h-64 overflow-auto">
                          {filteredCatalogo.map((s, suggestionIndex) => {
                            const isSelected = selectedSuggestionIndex === suggestionIndex;
                            return (
                              <div
                                key={s.id}
                                ref={(el) => {
                                  suggestionRefs.current[suggestionIndex] = el;
                                }}
                                className={`p-2 cursor-pointer text-sm ${
                                  isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/70'
                                }`}
                                onClick={() => handleSelectSugestao(index, s)}
                              >
                                {s.nome} — {s.funcao} —{' '}
                                {Number(s.precoPadrao ?? 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      id={`servico-${item.id}-quantidade`}
                      value={item.quantidade === 0 ? '' : item.quantidade}
                      onChange={(e) => handleQuantidadeChange(index, e.target.value)}
                      onKeyDown={(e) => handleQuantidadeKeyDown(e, index)}
                      className="border border-slate-700 rounded p-2 w-full text-right bg-slate-950 text-slate-100"
                    />

                    <input
                      type="text"
                      inputMode="decimal"
                      id={`servico-${item.id}-preco`}
                      value={item.precoUnitarioInput}
                      onChange={(e) => handlePrecoChange(index, e.target.value)}
                      className="border border-slate-700 rounded p-2 w-full text-right bg-slate-950 text-slate-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          adicionarLinha(true);
                        }
                      }}
                    />

                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => removerLinha(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={adicionarLinha}
                  disabled={catalogo.length === 0}
                  className="text-green-600 hover:text-green-800 p-3 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  + Adicionar linha
                </button>
              </div>
            )}
          </form>
        </section>

        {canViewPedidos ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">Pedidos cadastrados</h2>
                <p className="text-sm text-slate-400">
                  {isAdmin ? 'Acompanhe o andamento dos serviços por área.' : 'Visualização liberada apenas para consulta.'}
                </p>
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
                      {isAdmin && (
                        <button
                          onClick={() => handleDeletePedido(pedido.id, pedido.numeroPedido)}
                          className="rounded-xl border border-red-500/60 text-red-300 px-4 py-2 text-sm hover:bg-red-500/10 transition w-full md:w-auto"
                        >
                          Excluir pedido
                        </button>
                      )}
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
                        const descricao = (servico.observacoes ?? servico.catalogoNome ?? '').trim();
                        const isEditing = editingServicoId === servico.id && editingPedidoId === pedido.id;
                        return (
                          <div
                            key={servico.id}
                            className="border border-slate-800 rounded-2xl p-3 bg-slate-950/40 text-sm text-slate-300"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white">
                                  {descricao && descricao.length > 0 ? descricao : servico.tipoServico}
                                </span>
                                <span className="text-[11px] uppercase text-slate-400 tracking-wide">
                                  {servico.tipoServico}
                                </span>
                              </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    className="text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2 py-1 text-xs"
                                    onClick={() =>
                                      startEditingServico(pedido.id, servico.id, descricao, servico.quantidade, precoUnitario)
                                    }
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="text-red-300 hover:text-red-200 border border-red-500/60 rounded-lg px-2 py-1 text-xs"
                                    onClick={() => handleDeleteServico(pedido.id, servico.id, servico.tipoServico)}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                            </div>
                          {isEditing && isAdmin ? (
                            <div className="mt-2 space-y-2">
                              <input
                                className="input text-sm"
                                value={editingForm.descricao}
                                onChange={(e) => setEditingForm((prev) => ({ ...prev, descricao: e.target.value }))}
                                  placeholder="Descrição"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    className="input text-sm"
                                    value={editingForm.quantidade}
                                    onChange={(e) => setEditingForm((prev) => ({ ...prev, quantidade: e.target.value }))}
                                    placeholder="Quantidade"
                                  />
                                  <input
                                    className="input text-sm"
                                    value={editingForm.preco}
                                    onChange={(e) => setEditingForm((prev) => ({ ...prev, preco: e.target.value }))}
                                    placeholder="Preço"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={submitServicoEdicao}
                                    disabled={editingLoading}
                                    className="btn-primary text-xs"
                                  >
                                    {editingLoading ? 'Salvando...' : 'Salvar'}
                                  </button>
                                  <button type="button" onClick={cancelServicoEdicao} className="btn-secondary text-xs">
                                    Cancelar
                                  </button>
                                </div>
                            </div>
                          ) : (
                              <div className="text-xs text-slate-400 mt-1">
                                Qtde: <span className="text-white font-semibold">{servico.quantidade}</span> · Preço unit.:{' '}
                                <span className="text-white font-semibold">
                                  {precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
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
        ) : (
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold">Pedidos cadastrados</h2>
            <p className="text-sm text-slate-400">
              Apenas administradores podem visualizar e editar pedidos já criados. Você pode usar o formulário acima para
              cadastrar novos pedidos.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
