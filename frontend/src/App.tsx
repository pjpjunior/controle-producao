import { useState } from 'react';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '');
const apiBase = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({
  baseURL: apiBase.replace(/\/$/, '')
});

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const createCheckout = async () => {
    setLoading(true);
    setMessage('');
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe não inicializado');
      }

      const response = await api.post('/payments/intent', { amount: 5000 });
      const { clientSecret } = response.data;

      const result = await stripe.redirectToCheckout({ sessionId: clientSecret });
      if (result.error) {
        setMessage(result.error.message ?? 'Erro inesperado');
      }
    } catch (err: any) {
      setMessage(err.message ?? 'Falha ao iniciar checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full space-y-6">
        <header className="text-center space-y-2">
          <p className="text-sky-400 tracking-wide uppercase text-xs">Controle de Produção</p>
          <h1 className="text-3xl font-semibold">Dashboard de Pagamentos</h1>
          <p className="text-slate-400">
            Exemplo de integração entre Vite, Tailwind e Stripe consumindo o backend Express.
          </p>
        </header>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <p className="text-slate-300">
            Clique no botão abaixo para criar uma sessão de pagamento de teste utilizando o backend.
          </p>
          <button
            onClick={createCheckout}
            className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 transition text-slate-950 font-semibold disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Processando...' : 'Gerar pagamento de teste'}
          </button>
          {message && <p className="text-red-400 text-sm">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default App;
