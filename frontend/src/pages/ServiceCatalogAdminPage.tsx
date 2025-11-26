import { FormEvent, useEffect, useState } from 'react';
import api from '../lib/api';
import AdminNavBar from '../components/AdminNavBar';

type ItemCatalogo = {
  id: number;
  nome: string;
  funcao: string;
  precoPadrao: number;
  createdAt: string;
};

const parsePreco = (valor: string) => {
  const normalized = valor.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items: { nome: string; funcao: string; precoPadrao: number }[] = [];
  for (const line of lines.slice(1)) {
    const [nome = '', funcao = '', preco = ''] = line.split(';');
    if (!nome.trim()) continue;
    items.push({
      nome: nome.trim(),
      funcao: funcao.trim().toLowerCase(),
      precoPadrao: parsePreco(preco)
    });
  }
  return items;
};

const ServiceCatalogAdminPage = () => {
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({ nome: '', funcao: '', precoPadrao: '' });
  const [importing, setImporting] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchItens = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ItemCatalogo[]>('/catalogo-servicos');
      setItens(data);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Não foi possível carregar o catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItens();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.funcao.trim()) {
      return showFeedback('error', 'Informe nome e função');
    }
    try {
      const precoPadrao = parsePreco(form.precoPadrao);
      await api.post('/catalogo-servicos', {
        nome: form.nome.trim(),
        funcao: form.funcao.trim().toLowerCase(),
        precoPadrao
      });
      setForm({ nome: '', funcao: '', precoPadrao: '' });
      showFeedback('success', 'Serviço cadastrado no catálogo');
      fetchItens();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao salvar');
    }
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const items = parseCsv(text);
      if (items.length === 0) {
        return showFeedback('error', 'CSV vazio ou sem dados válidos.');
      }
      setImporting(true);
      try {
        await api.post('/catalogo-servicos/import', { items });
        showFeedback('success', `Importação concluída (${items.length} linhas).`);
        fetchItens();
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error?.response?.data?.message ?? 'Erro ao importar CSV');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleDelete = async (id: number, nome: string) => {
    const confirmar = window.confirm(`Remover o serviço "${nome}" do catálogo?`);
    if (!confirmar) return;
    try {
      await api.delete(`/catalogo-servicos/${id}`);
      showFeedback('success', 'Removido com sucesso');
      fetchItens();
    } catch (error: any) {
      console.error(error);
      showFeedback('error', error?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNavBar title="Catálogo de Serviços" subtitle="Gerencie os serviços usados na criação de pedidos" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {feedback && (
          <div
            className={`p-3 rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-emerald-400/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-400/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Novo serviço</h2>
            <p className="text-sm text-slate-400">Alimente aqui o catálogo usado na criação de pedidos.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3">
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome do serviço"
              className="input md:col-span-2"
              required
            />
            <input
              value={form.funcao}
              onChange={(e) => setForm({ ...form, funcao: e.target.value })}
              placeholder="Função (ex.: corte, colagem)"
              className="input"
              required
            />
            <input
              value={form.precoPadrao}
              onChange={(e) => setForm({ ...form, precoPadrao: e.target.value })}
              placeholder="Preço padrão"
              className="input"
              inputMode="decimal"
            />
            <button type="submit" className="btn-primary md:col-span-4 md:w-auto">
              Salvar no catálogo
            </button>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold">Importar via CSV</h3>
                <p className="text-xs text-slate-400">
                  Formato: nome;funcao;precoPadrao · Baixe o modelo e importe.
                </p>
              </div>
              <a
                href="/catalogo-servicos-modelo.csv"
                className="text-xs text-sky-400 hover:text-sky-300 underline"
                download
              >
                Baixar modelo CSV
              </a>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportCsv}
                className="hidden"
              />
              <span className="px-3 py-2 rounded-lg border border-slate-700 hover:border-sky-500 transition text-slate-200">
                {importing ? 'Importando...' : 'Selecionar CSV'}
              </span>
            </label>
          </div>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Serviços cadastrados</h2>
              <p className="text-sm text-slate-400">Esses serviços aparecem no formulário de pedido.</p>
            </div>
            <button
              onClick={fetchItens}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:border-sky-500 text-sm"
            >
              Atualizar
            </button>
          </div>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 bg-slate-900/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : itens.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/60 text-left uppercase text-xs tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2">Função</th>
                    <th className="px-3 py-2">Preço padrão</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-semibold">{item.nome}</td>
                      <td className="px-3 py-2 uppercase text-slate-300">{item.funcao}</td>
                      <td className="px-3 py-2">
                        {Number(item.precoPadrao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDelete(item.id, item.nome)}
                          className="text-xs text-red-300 hover:text-red-200"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ServiceCatalogAdminPage;
