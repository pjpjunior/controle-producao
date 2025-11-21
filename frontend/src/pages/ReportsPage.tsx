import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { RelatorioExecucao, RelatorioResponse, Usuario } from '../types';

const ReportsPage = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.funcoes?.includes('admin');

  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [report, setReport] = useState<RelatorioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const today = useMemo(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }, []);
  const [customStart, setCustomStart] = useState<string>(today);
  const [customEnd, setCustomEnd] = useState<string>(today);
  const [selectedFuncao, setSelectedFuncao] = useState<string>('all');
  const [removingServicoId, setRemovingServicoId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const formatCurrency = useCallback(
    (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const fetchUsuarios = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    try {
      const { data } = await api.get<Usuario[]>('/auth/users');
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao buscar usuários para o relatório', err);
    }
  }, [isAdmin]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!customStart || !customEnd) {
        setLoading(false);
        setError('Selecione as datas inicial e final.');
        return;
      }
      if (new Date(customStart) > new Date(customEnd)) {
        setLoading(false);
        setError('A data inicial deve ser anterior ou igual à data final.');
        return;
      }

      const searchParams = new URLSearchParams({ period: 'custom' });
      if (isAdmin && selectedOperator !== 'all') {
        searchParams.append('userId', selectedOperator);
      }
      searchParams.append('startDate', `${customStart}T00:00:00`);
      searchParams.append('endDate', `${customEnd}T23:59:59`);
      const { data } = await api.get<RelatorioResponse>(`/servicos/relatorios?${searchParams.toString()}`);
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message ?? 'Não foi possível carregar o relatório');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, isAdmin, selectedOperator]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const showActionFeedback = useCallback((payload: { type: 'success' | 'error'; text: string }) => {
    setActionFeedback(payload);
  }, []);

  useEffect(() => {
    if (!actionFeedback) {
      return;
    }
    const timeout = setTimeout(() => setActionFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [actionFeedback]);

  const operadoresRaw = report?.operadores ?? [];

  const funcoesDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    operadoresRaw.forEach((operador) => {
      operador.porServico.forEach((servico) => tipos.add(servico.tipoServico));
    });
    return Array.from(tipos).sort((a, b) => a.localeCompare(b));
  }, [operadoresRaw]);

  useEffect(() => {
    if (selectedFuncao !== 'all' && !funcoesDisponiveis.includes(selectedFuncao)) {
      setSelectedFuncao('all');
    }
  }, [funcoesDisponiveis, selectedFuncao]);

  const handleDeleteServico = useCallback(
    async (servicoId: number, pedidoId: number | null, tipoServico: string) => {
      if (!isAdmin) {
        return;
      }
      if (!pedidoId) {
        showActionFeedback({ type: 'error', text: 'Não foi possível identificar o pedido deste serviço.' });
        return;
      }
      const confirmar = window.confirm(`Excluir o serviço ${tipoServico.toUpperCase()} do pedido selecionado?`);
      if (!confirmar) {
        return;
      }
      setRemovingServicoId(servicoId);
      try {
        await api.delete(`/pedidos/${pedidoId}/servicos/${servicoId}`);
        showActionFeedback({ type: 'success', text: 'Serviço removido do pedido.' });
        await fetchReport();
      } catch (err: any) {
        console.error(err);
        showActionFeedback({
          type: 'error',
          text: err?.response?.data?.message ?? 'Erro ao remover serviço'
        });
      } finally {
        setRemovingServicoId(null);
      }
    },
    [fetchReport, isAdmin, showActionFeedback]
  );

  const operadores = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const filtraPorFuncao = (execucao: RelatorioExecucao) =>
      selectedFuncao === 'all' ? true : execucao.tipoServico === selectedFuncao;

    return operadoresRaw
      .map((operador) => {
        const execucoesPorFuncao = operador.execucoes.filter(filtraPorFuncao);
        const execucoesFiltradas = !termo
          ? execucoesPorFuncao
          : execucoesPorFuncao.filter((execucao) => {
              const alvo = `${execucao.pedidoNumero} ${execucao.cliente} ${execucao.tipoServico}`.toLowerCase();
              return alvo.includes(termo);
            });

        if (execucoesFiltradas.length === 0) {
          return null;
        }

        const totalQuantidade = execucoesFiltradas.reduce((acc, execucao) => acc + execucao.quantidade, 0);
        const totalValor = isAdmin
          ? execucoesFiltradas.reduce((acc, execucao) => acc + (execucao.valorTotal ?? 0), 0)
          : undefined;
        const porServico = Object.values(
          execucoesFiltradas.reduce<
            Record<
              string,
              {
                tipoServico: string;
                totalServicos: number;
                totalQuantidade: number;
              }
            >
          >((acc, execucao) => {
            const tipo = execucao.tipoServico;
            if (!acc[tipo]) {
              acc[tipo] = { tipoServico: tipo, totalServicos: 0, totalQuantidade: 0 };
            }
            acc[tipo].totalServicos += 1;
            acc[tipo].totalQuantidade += execucao.quantidade;
            return acc;
          }, {})
        ).sort((a, b) => a.tipoServico.localeCompare(b.tipoServico));

        return {
          ...operador,
          totalServicos: execucoesFiltradas.length,
          totalQuantidade,
          totalValor,
          porServico,
          execucoes: execucoesFiltradas
        };
      })
      .filter((operador): operador is (typeof operadoresRaw)[number] => Boolean(operador));
  }, [isAdmin, operadoresRaw, searchTerm, selectedFuncao]);

  const rangeLabel = useMemo(() => {
    if (!report) return '';
    const end = new Date(report.endDate);
    if (!report.startDate) {
      return `Até ${end.toLocaleDateString('pt-BR')}`;
    }
    const start = new Date(report.startDate);
    return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
  }, [report]);

  const totaisGerais = useMemo(
    () =>
      operadores.reduce(
        (acc, operador) => {
          acc.totalServicos += operador.totalServicos;
          acc.totalQuantidade += operador.totalQuantidade;
          acc.totalValor += operador.totalValor ?? 0;
          return acc;
        },
        { totalServicos: 0, totalQuantidade: 0, totalValor: 0 }
      ),
    [operadores]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Controle de Produção</p>
            <h1 className="text-xl font-semibold">Relatórios de Execução</h1>
            <p className="text-xs text-slate-400">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.nome}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Link to="/admin" className="btn-secondary text-slate-200">
                  Painel
                </Link>
              ) : (
                <Link to="/operador" className="btn-secondary text-slate-200">
                  Painel
                </Link>
              )}
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

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="card space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-start" className="text-sm text-slate-400">
                Data inicial
              </label>
              <div className="flex gap-2">
                <input
                  ref={startInputRef}
                  id="custom-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => startInputRef.current?.showPicker?.()}
                  className="btn-secondary whitespace-nowrap"
                >
                  Calendário
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-end" className="text-sm text-slate-400">
                Data final
              </label>
              <div className="flex gap-2">
                <input
                  ref={endInputRef}
                  id="custom-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => endInputRef.current?.showPicker?.()}
                  className="btn-secondary whitespace-nowrap"
                >
                  Calendário
                </button>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-3 items-center">
              <label htmlFor="operador" className="text-sm text-slate-400">
                Operador:
              </label>
              <select
                id="operador"
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="input md:w-64"
              >
                <option value="all">Todos os operadores</option>
                {usuarios.map((operador) => (
                  <option key={operador.id} value={operador.id}>
                    {operador.nome} ({operador.funcoes.map((funcao) => funcao.toUpperCase()).join(' / ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <label htmlFor="funcao" className="text-sm text-slate-400">
              Função/serviço:
            </label>
            <select
              id="funcao"
              value={selectedFuncao}
              onChange={(e) => setSelectedFuncao(e.target.value)}
              className="input md:w-64"
              disabled={funcoesDisponiveis.length === 0}
            >
              <option value="all">Todas as funções</option>
              {funcoesDisponiveis.map((funcao) => (
                <option key={funcao} value={funcao}>
                  {funcao.toUpperCase()}
                </option>
              ))}
            </select>
            {funcoesDisponiveis.length === 0 && (
              <span className="text-xs text-slate-500">Nenhum serviço encontrado no período selecionado.</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="search-term" className="text-sm text-slate-400">
              Buscar trabalhos
            </label>
            <input
              id="search-term"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              placeholder="Pedido, cliente ou serviço"
            />
            <p className="text-xs text-slate-500">
              A pesquisa é aplicada apenas aos resultados já carregados para o período selecionado.
            </p>
          </div>

          <button onClick={fetchReport} className="btn-secondary">
            Aplicar filtros
          </button>
        </section>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200">{error}</div>
        )}

        {actionFeedback && (
          <div
            className={`p-3 rounded-xl border text-sm ${
              actionFeedback.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {actionFeedback.text}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card h-32 animate-pulse bg-slate-900/60" />
            ))}
          </div>
        ) : operadores.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma execução registrada para os filtros selecionados.</p>
        ) : (
          <>
            <section className="grid md:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="card">
                <p className="text-xs text-slate-400 uppercase">Total de operadores listados</p>
                <p className="text-3xl font-semibold">{operadores.length}</p>
              </div>
              <div className="card">
                <p className="text-xs text-slate-400 uppercase">Serviços executados</p>
                <p className="text-3xl font-semibold">{totaisGerais.totalServicos}</p>
              </div>
              <div className="card">
                <p className="text-xs text-slate-400 uppercase">Quantidade total</p>
                <p className="text-3xl font-semibold">{totaisGerais.totalQuantidade}</p>
              </div>
              {isAdmin && (
                <div className="card">
                  <p className="text-xs text-slate-400 uppercase">Valor total estimado</p>
                  <p className="text-3xl font-semibold">{formatCurrency(totaisGerais.totalValor)}</p>
                </div>
              )}
            </section>

            <section className="space-y-6">
              {operadores.map((operador) => (
                <div key={operador.userId} className="card space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Operador</p>
                      <p className="text-lg font-semibold">{operador.nome}</p>
                      <p className="text-xs text-slate-500 uppercase">
                        {operador.funcoes.map((funcao) => funcao.toUpperCase()).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase">Serviços registrados</p>
                      <p className="text-3xl font-semibold text-sky-300">{operador.totalServicos}</p>
                      <p className="text-xs text-slate-500">Quantidade total: {operador.totalQuantidade}</p>
                      {isAdmin && (
                        <p className="text-xs text-slate-500">
                          Valor total: {formatCurrency(operador.totalValor ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-300">Resumo por serviço</h4>
                    {operador.porServico.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum serviço registrado neste período.</p>
                    ) : (
                      <div className="grid md:grid-cols-3 gap-3">
                        {operador.porServico.map((servico) => (
                          <div key={servico.tipoServico} className="rounded-2xl border border-slate-800 p-4 bg-slate-950/50">
                            <p className="text-xs uppercase text-slate-400">{servico.tipoServico}</p>
                            <p className="text-lg font-semibold text-white">{servico.totalServicos} execuções</p>
                            <p className="text-xs text-slate-400">Qtd. total: {servico.totalQuantidade}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-300">Execuções registradas</h4>
                    {operador.execucoes.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum registro encontrado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="text-xs uppercase text-slate-400 border-b border-slate-800">
                              <th className="py-2 pr-4">Pedido</th>
                              <th className="py-2 pr-4">Serviço</th>
                              <th className="py-2 pr-4">Quantidade</th>
                              <th className="py-2 pr-4">Observações</th>
                              {isAdmin && <th className="py-2 pr-4">Preço unit.</th>}
                              {isAdmin && <th className="py-2 pr-4">Total</th>}
                              <th className="py-2 pr-4">Início</th>
                              <th className="py-2 pr-4">Fim</th>
                              {isAdmin && <th className="py-2 pr-4 text-right">Ações</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {operador.execucoes.map((execucao) => (
                              <tr key={execucao.id} className="border-b border-slate-900/60 last:border-0">
                                <td className="py-2 pr-4">
                                  <div className="font-semibold text-slate-200">#{execucao.pedidoNumero || execucao.servicoId}</div>
                                  <div className="text-xs text-slate-500">{execucao.cliente}</div>
                                </td>
                                <td className="py-2 pr-4 uppercase text-slate-300">{execucao.tipoServico}</td>
                                <td className="py-2 pr-4 text-slate-300">{execucao.quantidade}</td>
                                <td className="py-2 pr-4 text-slate-300 max-w-xs whitespace-pre-wrap break-words">
                                  {execucao.observacoes?.trim() || '—'}
                                </td>
                                {isAdmin && (
                                  <td className="py-2 pr-4 text-slate-300">
                                    {formatCurrency(execucao.precoUnitario ?? 0)}
                                  </td>
                                )}
                                {isAdmin && (
                                  <td className="py-2 pr-4 text-slate-300 font-semibold">
                                    {formatCurrency(execucao.valorTotal ?? (execucao.precoUnitario ?? 0) * execucao.quantidade)}
                                  </td>
                                )}
                                <td className="py-2 pr-4 text-slate-300">
                                  {new Date(execucao.horaInicio).toLocaleString('pt-BR')}
                                </td>
                              <td className="py-2 pr-4 text-slate-300">
                                {execucao.horaFim ? new Date(execucao.horaFim).toLocaleString('pt-BR') : '—'}
                              </td>
                              {isAdmin && (
                                <td className="py-2 pr-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteServico(execucao.servicoId, execucao.pedidoId, execucao.tipoServico)
                                    }
                                    disabled={!execucao.pedidoId || removingServicoId === execucao.servicoId}
                                    className="text-xs px-3 py-1 rounded-lg border border-red-500/40 text-red-200 hover:bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {removingServicoId === execucao.servicoId ? 'Excluindo...' : 'Excluir'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default ReportsPage;
