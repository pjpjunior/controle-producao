import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Pool } from 'pg';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_PREFIX = process.env.API_PREFIX || '/api';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
if (pool) {
  pool.on('error', (error) => {
    console.error('Erro de conexão com o Postgres', error);
  });
} else {
  console.warn('DATABASE_URL não definido. O backend será executado sem acesso ao Postgres.');
}

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

const apiRoutes = express.Router();

apiRoutes.get('/health', async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ status: 'warn', message: 'Postgres não configurado' });
    }
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Banco de dados indisponível', error });
  }
});

apiRoutes.post('/payments/intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ message: 'STRIPE_SECRET_KEY não configurada' });
  }

  const { amount = 5000, currency = 'brl' } = req.body ?? {};

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: 'Pedido de teste'
            }
          }
        }
      ],
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`
    });

    res.json({ clientSecret: session.id });
  } catch (error) {
    console.error('Erro ao criar sessão Stripe', error);
    res.status(500).json({ message: 'Erro ao criar sessão de pagamento' });
  }
});

app.use(API_PREFIX, apiRoutes);

app.listen(PORT, () => {
  console.log(`API em execução na porta ${PORT}`);
  console.log(`API prefix configurado em "${API_PREFIX}"`);
});
