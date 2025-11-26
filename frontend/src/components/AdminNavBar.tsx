import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AdminNavBarProps {
  title: string;
  subtitle?: string;
}

const AdminNavBar = ({ title, subtitle }: AdminNavBarProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/admin', label: 'Criar' },
    { to: '/admin/catalogo-servicos', label: 'Catálogo de serviços' },
    { to: '/admin/gestao', label: 'Usuários' },
    { to: '/relatorios', label: 'Relatórios' }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Controle de Produção</p>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm font-medium">{user?.nome}</p>
            <p className="text-xs text-slate-400 break-all">{user?.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`btn-secondary text-slate-200 ${location.pathname === item.to ? 'border-sky-500 text-sky-200' : ''}`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:border-red-400 hover:text-red-300 transition text-sm"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminNavBar;
