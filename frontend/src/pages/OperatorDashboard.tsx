import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Pedido, Servico } from '../types';
import StatusBadge from '../components/StatusBadge';

const OperatorDashboard = () => {
  const { user, logout, refreshUser } = useAuth();

  const [numeroPedido, setNumeroPedido] = useState('');
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const buscarPedido = useCallback(
    async (numero: string) => {
      setLoading(true);
      setMessage(null);
      try {
        await refreshUser();
        const { data } = await api.get<Pedido>(`/pedidos/${numero}`);
        setPedido(data);
      } catch (error: any) {
        console.error(error);
        setPedido(null);
        setMessage({ type: 'error', text: error?.response?.data?.message ?? 'Pedido não encontrado' });
      } finally {
        setLoading(false);
      }
    },
    [refreshUser]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!numeroPedido) {
      return;
    }
    buscarPedido(numeroPedido);
  };

  const servicosVisiveis = useMemo(() => {
    if (!pedido) return [];
    const funcoesUsuario = user?.funcoes ?? [];
    if (funcoesUsuario.includes('admin')) return pedido.servicos;
    return pedido.servicos.filter((servico) => funcoesUsuario.includes(servico.tipoServico));
  }, [pedido, user]);

  const refreshPedido = useCallback(async () => {
    if (pedido) {
      await buscarPedido(pedido.numeroPedido);
    }
  }, [buscarPedido, pedido]);

  const iniciarServico = async (servico: Servico) => {
    setActionLoading(servico.id);
    setMessage(null);
    try {
      await api.post(`/servicos/${servico.id}/iniciar`);
      setMessage({ type: 'success', text: 'Serviço iniciado!' });
      await refreshPedido();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error?.response?.data?.message ?? 'Erro ao iniciar serviço' });
    } finally {
      setActionLoading(null);
    }
  };

  const finalizarServico = async (servico: Servico) => {
    setActionLoading(servico.id);
    setMessage(null);
    try {
      await api.post(`/servicos/${servico.id}/finalizar`);
      setMessage({ type: 'success', text: 'Serviço finalizado!' });
      await refreshPedido();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error?.response?.data?.message ?? 'Erro ao finalizar serviço' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Controle de Produção</p>
            <h1 className="text-xl font-semibold">
              Painel do Operador
              {user?.funcoes?.length ? (
                <span className="block text-xs text-slate-400 font-normal">
                  Funções: {user.funcoes.map((funcao) => funcao.toUpperCase()).join(' · ')}
                </span>
              ) : null}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm">{user?.nome}</p>
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
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Buscar pedido</h2>
            <p className="text-sm text-slate-400">Digite o número do pedido informado pelo administrativo.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              placeholder="Número do pedido"
              className="input flex-1"
              required
            />
            <button type="submit" className="btn-primary md:w-auto">
              {loading ? 'Buscando...' : 'Ver serviços'}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`p-4 rounded-xl border ${
              message.type === 'success'
                ? 'bg-emerald-400/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-400/10 border-red-500/30 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {pedido && (
          <section className="card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
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
                <p className="text-lg">
                  {new Date(pedido.dataCriacao).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {servicosVisiveis.length === 0 && (
                <p className="text-sm text-slate-400">Nenhum serviço atribuído à sua função para este pedido.</p>
              )}
              {servicosVisiveis.map((servico) => {
                const ultimaExecucao = servico.execucoes[0];
                const podeIniciar = servico.status === 'pendente';
                const podeFinalizar = servico.status === 'em_execucao';
                return (
                  <div key={servico.id} className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-400 uppercase">Serviço</p>
                        <p className="text-lg font-semibold uppercase">{servico.tipoServico}</p>
                      </div>
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
                          } em ${new Date(ultimaExecucao.horaFim ?? ultimaExecucao.horaInicio).toLocaleString('pt-BR')}`
                        : 'Nenhuma execução registrada'}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => iniciarServico(servico)}
                        disabled={!podeIniciar || actionLoading === servico.id}
                        className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading === servico.id && podeIniciar ? 'Registrando...' : 'Iniciar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => finalizarServico(servico)}
                        disabled={!podeFinalizar || actionLoading === servico.id}
                        className="btn-accent disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading === servico.id && podeFinalizar ? 'Finalizando...' : 'Finalizar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default OperatorDashboard;
