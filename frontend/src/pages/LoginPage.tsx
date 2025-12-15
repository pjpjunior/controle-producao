import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

type SeedStatus = {
  hasUsers: boolean;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loginInput, setLoginInput] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<SeedStatus | null>(null);

  useEffect(() => {
    const fetchSeedStatus = async () => {
      try {
        const { data } = await api.get<SeedStatus>('/auth/seed-status');
        setSeedStatus(data);
        if (!data.hasUsers) {
          navigate('/primeiro-acesso', { replace: true });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSeedStatus();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await login(loginInput, senha);
      const isAdmin = user.funcoes.includes('admin');
      const isGerente = user.funcoes.includes('gerente');
      const destino = isAdmin || isGerente ? '/admin' : '/operador';
      navigate(destino, { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.message ?? 'Não foi possível realizar o login';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <p className="text-sky-400 uppercase tracking-[0.3em] text-xs">Controle de Produção</p>
          <h1 className="text-3xl font-semibold text-white">Acesse o painel</h1>
          <p className="text-slate-400 text-sm">
            Informe suas credenciais para registrar execuções de corte, fita, furação ou usinagem.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Usuário ou e-mail</label>
            <input
              type="text"
              value={loginInput}
              onChange={(event) => setLoginInput(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Usuário ou e-mail"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 transition text-slate-950 font-semibold py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {seedStatus && !seedStatus.hasUsers && (
            <p className="text-sm text-slate-400 text-center">
              Sem usuários cadastrados.{' '}
              <Link to="/primeiro-acesso" className="text-sky-300 hover:text-sky-200">
                Criar primeiro administrador
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
