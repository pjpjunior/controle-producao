import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Pedido, Servico } from '../types';
import StatusBadge from '../components/StatusBadge';

const calcularProgressoServico = (servico: Servico) => {
  const executado = servico.execucoes.reduce((total, execucao) => total + (execucao.quantidadeExecutada ?? 0), 0);
  const restante = Math.max(servico.quantidade - executado, 0);
  return { executado, restante };
};

const formatarDuracao = (ms: number) => {
  const totalSegundos = Math.max(Math.floor(ms / 1000), 0);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [];
  if (horas) partes.push(`${horas}h`);
  if (minutos) partes.push(`${minutos}min`);
  if (!horas && segundos) partes.push(`${segundos}s`);
  return partes.join(' ') || '0s';
};

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

  const registrarProducao = async (servico: Servico) => {
    const { executado, restante } = calcularProgressoServico(servico);
    if (restante <= 0) {
      setMessage({ type: 'error', text: 'Este serviço já atingiu a quantidade prevista.' });
      return;
    }

    const execucaoAberta = servico.execucoes.find((execucao) => !execucao.horaFim);
    if (!execucaoAberta) {
      setMessage({ type: 'error', text: 'Nenhuma execução aberta encontrada para este serviço.' });
      return;
    }

    const quantidadeInput = window.prompt(
      `Quanto foi produzido nesta retomada?\nJá produzido: ${executado} · Falta: ${restante} (total ${servico.quantidade}).`,
      ''
    );
    if (quantidadeInput === null) {
      return;
    }
    const incremento = Number(quantidadeInput.replace(',', '.'));
    if (!Number.isFinite(incremento) || incremento < 0) {
      setMessage({ type: 'error', text: 'Informe uma quantidade válida (zero ou mais).' });
      return;
    }
    if (incremento > restante) {
      setMessage({ type: 'error', text: `Quantidade não pode ser maior que o restante (${restante}).` });
      return;
    }

    const vaiFinalizar = executado + incremento === servico.quantidade;

    let motivo: string | undefined;
    if (!vaiFinalizar) {
      const motivoInput = window.prompt('Qual o motivo da pausa?', '');
      motivo = motivoInput ? motivoInput : undefined;
    }

    setActionLoading(servico.id);
    setMessage(null);

    try {
      if (vaiFinalizar) {
        const { data } = await api.post<Servico>(`/servicos/${servico.id}/finalizar`, {
          quantidadeExecutada: Math.floor(incremento)
        });

        const ultimaExecucao = data.execucoes.find((execucao) => execucao.horaFim) ?? data.execucoes[0];
        const duracao =
          ultimaExecucao && ultimaExecucao.horaFim
            ? formatarDuracao(new Date(ultimaExecucao.horaFim).getTime() - new Date(ultimaExecucao.horaInicio).getTime())
            : null;

        setMessage({
          type: 'success',
          text: `Serviço finalizado${duracao ? ` em ${duracao}` : '!'}`
        });

        // Efeito visual de comemoração (confete leve, carregado sob demanda)
        import('canvas-confetti')
          .then((confetti) => {
            const count = 180;
            const defaults = { origin: { y: 0.6 } };
            const fire = (particleRatio: number, opts: Record<string, unknown>) => {
              confetti.default({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio)
              });
            };

            // "Realistic look" preset inspirado na doc do canvas-confetti
            fire(0.25, { spread: 26, startVelocity: 55 });
            fire(0.2, { spread: 60 });
            fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
            fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
            fire(0.1, { spread: 120, startVelocity: 45 });
          })
          .catch(() => {
            // Sem impacto se o efeito não carregar
          });
      } else {
        const payload: any = { quantidadeExecutada: Math.floor(incremento) };
        if (motivo) {
          payload.motivo = motivo;
        }
        await api.post(`/servicos/${servico.id}/pausar`, payload);
        setMessage({ type: 'success', text: 'Pausa registrada.' });
      }

      await refreshPedido();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error?.response?.data?.message ?? 'Erro ao registrar produção' });
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
                const podeIniciar = servico.status === 'pendente' || servico.status === 'pausado';
                const podeRegistrar = servico.status === 'em_execucao';
                const { executado, restante } = calcularProgressoServico(servico);
                return (
                  <div key={servico.id} className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-400 uppercase">Serviço</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-lg font-semibold uppercase">{servico.tipoServico}</p>
                          {servico.observacoes && (
                            <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                              {servico.observacoes}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={servico.status} />
                    </div>
                    <p className="text-sm text-slate-300">
                      Quantidade: <span className="font-semibold text-white">{servico.quantidade}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Produzido: <span className="text-white font-semibold">{executado}</span> · Restam{' '}
                      <span className="text-white font-semibold">{restante}</span>
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => iniciarServico(servico)}
                        disabled={!podeIniciar || actionLoading === servico.id}
                        className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading === servico.id && podeIniciar ? 'Registrando...' : servico.status === 'pausado' ? 'Retomar' : 'Iniciar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => registrarProducao(servico)}
                        disabled={!podeRegistrar || actionLoading === servico.id}
                        className="btn-accent disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading === servico.id && podeRegistrar ? 'Salvando...' : 'Pausar / Finalizar'}
                      </button>
                    </div>
                    {servico.status === 'pausado' && (
                      <p className="text-xs text-amber-300">
                        Serviço pausado. Retome quando o material estiver disponível ou quando voltar do intervalo.
                      </p>
                    )}
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
