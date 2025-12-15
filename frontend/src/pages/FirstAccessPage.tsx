import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type SeedStatus = {
  hasUsers: boolean;
};

const FirstAccessPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seedStatus, setSeedStatus] = useState<SeedStatus | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get<SeedStatus>('/auth/seed-status');
        setSeedStatus(data);
        if (data.hasUsers) {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error(err);
        setError('Não foi possível verificar o estado inicial.');
      }
    };
    fetchStatus();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      const isAdmin = user.funcoes.includes('admin');
      const isGerente = user.funcoes.includes('gerente');
      navigate(isAdmin || isGerente ? '/admin' : '/operador', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (senha !== confirmarSenha) {
      setError('As senhas devem coincidir.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/auth/register', {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        funcoes: ['admin']
      });
      setSuccess('Administrador criado com sucesso! Faça login para continuar.');
      setTimeout(() => navigate('/login', { replace: true }), 800);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.message ?? 'Não foi possível criar o administrador.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <p className="text-sky-400 uppercase tracking-[0.3em] text-xs">Primeiro acesso</p>
          <h1 className="text-3xl font-semibold text-white">Criar super admin</h1>
          <p className="text-slate-400 text-sm">
            Cadastre o primeiro usuário administrador para liberar o sistema. Esta tela só aparece quando não há usuários.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Seu nome"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="admin@empresa.com"
              required
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Senha (mínimo 3 caracteres)</label>
              <input
                type="password"
                minLength={3}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Confirmar senha</label>
              <input
                type="password"
                minLength={3}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
          </div>

          {seedStatus && seedStatus.hasUsers && (
            <p className="text-sm text-amber-300 bg-amber-400/10 border border-amber-500/30 rounded-xl px-4 py-2">
              Já existe usuário cadastrado. Redirecionando para login...
            </p>
          )}

          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 rounded-xl px-4 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading || seedStatus?.hasUsers}
            className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 transition text-slate-950 font-semibold py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Criando...' : 'Criar administrador'}
          </button>
        </form>

        <div className="text-center">
          <Link to="/login" className="text-sky-300 hover:text-sky-200 text-sm">
            Já tenho acesso
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FirstAccessPage;
