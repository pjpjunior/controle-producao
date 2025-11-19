import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../lib/api';
import { Usuario } from '../types';

interface AuthContextData {
  user: Usuario | null;
  token: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => void;
  refreshUser: () => Promise<Usuario | null>;
}

const TOKEN_KEY = 'controleproducao:token';
const USER_KEY = 'controleproducao:user';

const AuthContext = createContext<AuthContextData | undefined>(undefined);

const normalizeUsuario = (data: any): Usuario => {
  const funcoesPersistidas =
    Array.isArray(data?.funcoes) && data.funcoes.length > 0
      ? data.funcoes
      : data?.funcao
        ? [data.funcao]
        : [];
  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    funcoes: funcoesPersistidas
  };
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      setAuthToken(storedToken);
      try {
        const parsed = JSON.parse(storedUser);
        setUser(normalizeUsuario(parsed));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }

  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const { data } = await api.post<{ token: string; user: Usuario }>('/auth/login', { email, senha });
    const normalizedUser = normalizeUsuario(data.user);

    setToken(data.token);
    setUser(normalizedUser);
    setAuthToken(data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));

    return normalizedUser;
  }, []);

  const refreshUserFromServer = useCallback(async () => {
    if (!token) {
      if (!bootstrapped) {
        setLoading(false);
        setBootstrapped(true);
      }
      return null;
    }

    const shouldShowLoader = !bootstrapped;
    if (shouldShowLoader) {
      setLoading(true);
    }

    try {
      const { data } = await api.get<Usuario>('/auth/me');
      const normalizedUser = normalizeUsuario(data);
      setUser(normalizedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error: any) {
      console.error('Erro ao sincronizar usuário autenticado', error);
      if (error?.response?.status === 401) {
        logout();
      }
      return null;
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
        setBootstrapped(true);
      }
    }
  }, [bootstrapped, logout, token]);

  useEffect(() => {
    refreshUserFromServer();
  }, [refreshUserFromServer]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshUser: refreshUserFromServer
    }),
    [user, token, loading, login, logout, refreshUserFromServer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
