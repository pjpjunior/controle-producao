import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { FuncaoUsuario, Usuario } from '../types';

interface UsuarioDetalhado extends Usuario {
  createdAt: string;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;
interface FuncaoDisponivel {
  id: number;
  nome: FuncaoUsuario;
  createdAt: string;
}

const TeamManagementPage = () => {
  const { user, logout } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioDetalhado[]>([]);
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState<FuncaoDisponivel[]>([]);
  const [funcoesLoading, setFuncoesLoading] = useState(true);
  const [userForm, setUserForm] = useState({ nome: '', email: '', senha: '', funcoes: [] as FuncaoUsuario[] });
  const [usersLoading, setUsersLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [novaFuncaoNome, setNovaFuncaoNome] = useState('');
  const [creatingFuncao, setCreatingFuncao] = useState(false);
  const [deletingFuncaoId, setDeletingFuncaoId] = useState<number | null>(null);

  const funcoesNomes = useMemo(() => funcoesDisponiveis.map((funcao) => funcao.nome), [funcoesDisponiveis]);
  const podeCriarUsuario = funcoesNomes.length > 0 && userForm.funcoes.length > 0;

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  }, []);

  const sortUsuarios = useCallback(
    (lista: UsuarioDetalhado[]) =>
      [...lista].sort((a, b) => {
        if (a.ativo === b.ativo) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.ativo ? -1 : 1;
      }),
    []
  );

  const fetchFuncoes = useCallback(async () => {
    setFuncoesLoading(true);
    try {
      const { data } = await api.get<FuncaoDisponivel[]>('/auth/funcoes');
      setFuncoesDisponiveis(data);
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Falha ao carregar funções');
    } finally {
      setFuncoesLoading(false);
    }
  }, [showFeedback]);

  const toggleFormFuncao = (funcao: FuncaoUsuario) => {
    setUserForm((previous) => {
      const possui = previous.funcoes.includes(funcao);
      if (possui) {
        if (previous.funcoes.length === 1) {
          showFeedback('error', 'Selecione ao menos uma função');
          return previous;
        }
        return { ...previous, funcoes: previous.funcoes.filter((item) => item !== funcao) };
      }
      return { ...previous, funcoes: [...previous.funcoes, funcao] };
    });
  };

  const handleCreateFuncao = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const nomeNormalizado = novaFuncaoNome.trim().toLowerCase();
      if (nomeNormalizado.length < 3) {
        showFeedback('error', 'Informe um nome com pelo menos 3 caracteres');
        return;
      }
      if (funcoesNomes.includes(nomeNormalizado as FuncaoUsuario)) {
        showFeedback('error', 'Função já cadastrada');
        return;
      }

      setCreatingFuncao(true);
      try {
        await api.post('/auth/funcoes', { nome: nomeNormalizado });
        showFeedback('success', `Função ${nomeNormalizado.toUpperCase()} adicionada`);
        setNovaFuncaoNome('');
        fetchFuncoes();
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error?.response?.data?.message ?? 'Erro ao criar nova função');
      } finally {
        setCreatingFuncao(false);
      }
    },
    [fetchFuncoes, funcoesNomes, novaFuncaoNome, showFeedback]
  );

  const handleDeleteFuncao = useCallback(
    async (funcaoId: number, nome: string) => {
      const confirmar = window.confirm(`Excluir a função ${nome.toUpperCase()}?`);
      if (!confirmar) {
        return;
      }

      setDeletingFuncaoId(funcaoId);
      try {
        await api.delete(`/auth/funcoes/${funcaoId}`);
        setFuncoesDisponiveis((prev) => prev.filter((funcao) => funcao.id !== funcaoId));
        showFeedback('success', `Função ${nome.toUpperCase()} removida.`);
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error?.response?.data?.message ?? 'Erro ao remover função');
      } finally {
        setDeletingFuncaoId(null);
      }
    },
    [showFeedback]
  );

  const toggleUsuarioFuncao = useCallback(
    async (usuarioId: number, funcao: FuncaoUsuario) => {
      const usuario = usuarios.find((item) => item.id === usuarioId);
      if (!usuario) return;

      const possui = usuario.funcoes.includes(funcao);
      if (possui && usuario.funcoes.length === 1) {
        showFeedback('error', 'Cada usuário precisa de ao menos uma função.');
        return;
      }

      if (possui && funcao === 'admin') {
        const adminsAtivos = usuarios.filter((item) => item.funcoes.includes('admin') && item.ativo);
        if (adminsAtivos.length === 1) {
          showFeedback('error', 'Mantenha pelo menos um administrador cadastrado.');
          return;
        }
      }

      const novasFuncoes = possui
        ? (usuario.funcoes.filter((item) => item !== funcao) as FuncaoUsuario[])
        : ([...usuario.funcoes, funcao] as FuncaoUsuario[]);

      setUpdatingUserId(usuarioId);
      try {
        const { data } = await api.patch<UsuarioDetalhado>(`/auth/users/${usuarioId}/funcoes`, { funcoes: novasFuncoes });
        setUsuarios((prev) =>
          sortUsuarios(prev.map((item) => (item.id === usuarioId ? { ...item, funcoes: data.funcoes } : item)))
        );
        showFeedback('success', 'Funções atualizadas com sucesso.');
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error?.response?.data?.message ?? 'Erro ao atualizar funções');
      } finally {
        setUpdatingUserId(null);
      }
    },
    [showFeedback, sortUsuarios, usuarios]
  );

  const toggleUsuarioAtivo = useCallback(
    async (usuarioId: number, ativo: boolean) => {
      setStatusUpdatingId(usuarioId);
      try {
        const { data } = await api.patch<UsuarioDetalhado>(`/auth/users/${usuarioId}/status`, { ativo });
        setUsuarios((prev) =>
          sortUsuarios(prev.map((item) => (item.id === usuarioId ? { ...item, ativo: data.ativo } : item)))
        );
        showFeedback('success', ativo ? 'Usuário reativado.' : 'Usuário marcado como inativo.');
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error?.response?.data?.message ?? 'Erro ao atualizar status');
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [showFeedback, sortUsuarios]
  );

  const fetchUsuarios = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await api.get<UsuarioDetalhado[]>('/auth/users');
      setUsuarios(sortUsuarios(data));
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Falha ao carregar usuários');
    } finally {
      setUsersLoading(false);
    }
  }, [showFeedback, sortUsuarios]);

  useEffect(() => {
    fetchFuncoes();
  }, [fetchFuncoes]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  useEffect(() => {
    setUserForm((previous) => {
      if (funcoesNomes.length === 0) {
        return { ...previous, funcoes: [] };
      }

      const funcoesValidas = previous.funcoes.filter((funcao) => funcoesNomes.includes(funcao)) as FuncaoUsuario[];
      if (funcoesValidas.length === 0) {
        const sugestao = funcoesNomes.find((funcao) => funcao !== 'admin') ?? funcoesNomes[0];
        return sugestao ? { ...previous, funcoes: [sugestao] as FuncaoUsuario[] } : { ...previous, funcoes: [] };
      }

      if (funcoesValidas.length !== previous.funcoes.length) {
        return { ...previous, funcoes: funcoesValidas };
      }

      return previous;
    });
  }, [funcoesNomes]);

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (userForm.funcoes.length === 0) {
      showFeedback('error', 'Selecione ao menos uma função');
      return;
    }
    try {
      await api.post('/auth/register', { ...userForm });
      showFeedback('success', `Usuário ${userForm.nome} criado com sucesso`);
      const fallback = funcoesNomes.find((funcao) => funcao !== 'admin') ?? funcoesNomes[0] ?? '';
      setUserForm({
        nome: '',
        email: '',
        senha: '',
        funcoes: fallback ? ([fallback] as FuncaoUsuario[]) : []
      });
      fetchUsuarios();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao criar usuário');
    }
  };

  const handleDeleteUser = async (usuarioId: number) => {
    const confirmar = window.confirm('Deseja realmente excluir este usuário?');
    if (!confirmar) {
      return;
    }

    try {
      await api.delete(`/auth/users/${usuarioId}`);
      setUsuarios((prev) => sortUsuarios(prev.filter((usuario) => usuario.id !== usuarioId)));
      showFeedback('success', 'Usuário removido com sucesso');
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao excluir usuário');
    }
  };

  const funcionariosResumo = useMemo(() => {
    const ativos = usuarios.filter((item) => item.ativo);
    const totalAdmins = ativos.filter((item) => item.funcoes.includes('admin')).length;
    return {
      total: ativos.length,
      admins: totalAdmins,
      operadores: ativos.length - totalAdmins
    };
  }, [usuarios]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Controle de Produção</p>
            <h1 className="text-xl font-semibold">Gestão de Funcionários</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.nome}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin" className="btn-secondary text-slate-200">
                Painel
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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <form onSubmit={handleCreateUser} className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Criar Usuário</h2>
                <p className="text-sm text-slate-400">Cadastre novos operadores e administradores.</p>
              </div>
              <input
                placeholder="Nome"
                value={userForm.nome}
                onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                className="input"
                required
              />
              <input
                type="email"
                placeholder="E-mail"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="input"
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={userForm.senha}
                onChange={(e) => setUserForm({ ...userForm, senha: e.target.value })}
                className="input"
                required
              />
              <div>
                <p className="text-xs uppercase text-slate-400 mb-2">Funções atribuídas</p>
                {funcoesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-10 bg-slate-900/70 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : funcoesNomes.length === 0 ? (
                  <p className="text-sm text-slate-500">Cadastre funções para habilitar os checkboxes.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {funcoesNomes.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm cursor-pointer hover:border-slate-600 transition"
                      >
                        <input
                          type="checkbox"
                          className="accent-sky-500"
                          checked={userForm.funcoes.includes(option)}
                          onChange={() => toggleFormFuncao(option)}
                        />
                        <span className="uppercase tracking-wide">{option.toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary disabled:opacity-60" disabled={!podeCriarUsuario}>
                Salvar usuário
              </button>
            </form>

            <div className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Funções disponíveis</h2>
                <p className="text-sm text-slate-400">Adicione novas funções que aparecerão como checkbox.</p>
              </div>
              <form onSubmit={handleCreateFuncao} className="flex flex-col sm:flex-row gap-3">
                <input
                  placeholder="Ex.: pintura"
                  value={novaFuncaoNome}
                  onChange={(e) => setNovaFuncaoNome(e.target.value)}
                  className="input flex-1"
                  required
                />
                <button
                  type="submit"
                  className="btn-secondary whitespace-nowrap disabled:opacity-60"
                  disabled={creatingFuncao}
                >
                  {creatingFuncao ? 'Adicionando...' : 'Adicionar função'}
                </button>
              </form>
              <div className="flex flex-col gap-2">
                {funcoesLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-8 w-24 rounded-full bg-slate-900/70 animate-pulse" />
                  ))
                ) : funcoesDisponiveis.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma função cadastrada ainda.</p>
                ) : (
                  funcoesDisponiveis.map((funcao) => (
                    <div
                      key={funcao.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-300"
                    >
                      <span>{funcao.nome.toUpperCase()}</span>
                      <button
                        type="button"
                        className="text-red-300 border border-red-500/60 rounded-lg px-3 py-1 normal-case text-[11px] hover:bg-red-500/10 disabled:opacity-50"
                        disabled={funcao.nome === 'admin' || deletingFuncaoId === funcao.id}
                        onClick={() => handleDeleteFuncao(funcao.id, funcao.nome)}
                      >
                        {deletingFuncaoId === funcao.id ? 'Removendo...' : 'Excluir'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Funcionários cadastrados</h2>
                <p className="text-sm text-slate-400">
                  {funcionariosResumo.total} ativos · {funcionariosResumo.admins} admin · {funcionariosResumo.operadores}{' '}
                  operadores
                </p>
              </div>
              <button onClick={fetchUsuarios} className="btn-secondary">
                Atualizar
              </button>
            </div>

            {usersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 bg-slate-900/80 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : usuarios.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {usuarios.map((usuario) => (
                  <div
                    key={usuario.id}
                    className={`border rounded-2xl p-4 space-y-4 ${
                      usuario.ativo ? 'border-slate-800 bg-slate-950/40' : 'border-amber-400/50 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          {usuario.nome}
                          {!usuario.ativo && (
                            <span className="text-[11px] uppercase tracking-wide text-amber-300 border border-amber-300/40 px-2 py-0.5 rounded-full">
                              Inativo
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-400">{usuario.email}</p>
                      </div>
                      <div className="text-sm text-slate-400">
                        <p className="text-xs uppercase text-slate-500">Criado em</p>
                        <p className="font-semibold text-slate-100">{formatDate(usuario.createdAt)}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                          type="checkbox"
                          className="accent-amber-400"
                          checked={!usuario.ativo}
                          disabled={statusUpdatingId === usuario.id}
                          onChange={(event) => toggleUsuarioAtivo(usuario.id, !event.target.checked)}
                        />
                        <span>{statusUpdatingId === usuario.id ? 'Atualizando...' : 'Inativo'}</span>
                      </label>
                      <button
                        onClick={() => handleDeleteUser(usuario.id)}
                        className="rounded-xl border border-red-500/60 text-red-300 px-4 py-2 text-sm hover:bg-red-500/10 transition"
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase text-slate-500">Funções liberadas</p>
                        <p className="text-xs text-slate-500">
                          {usuario.funcoes.length} selecionada{usuario.funcoes.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      {funcoesLoading ? (
                        <div className="h-10 bg-slate-900/70 rounded-xl animate-pulse" />
                      ) : funcoesNomes.length === 0 ? (
                        <p className="text-xs text-slate-500">Cadastre funções para gerenciar permissões.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {funcoesNomes.map((option) => {
                            const checked = usuario.funcoes.includes(option);
                            const disabled = updatingUserId === usuario.id;
                            return (
                              <label
                                key={`${usuario.id}-${option}`}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs uppercase tracking-wide transition cursor-pointer ${
                                  checked
                                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                                    : 'border-slate-800 text-slate-300 hover:border-slate-600'
                                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  className="accent-sky-500"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleUsuarioFuncao(usuario.id, option)}
                                />
                                <span>{option.toUpperCase()}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {updatingUserId === usuario.id && (
                        <p className="text-xs text-slate-500">Atualizando permissões...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default TeamManagementPage;
