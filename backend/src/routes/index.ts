import { Router } from 'express';
import authRoutes from './authRoutes';
import pedidoRoutes from './pedidoRoutes';
import servicoExecRoutes from './servicoExecRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/servicos', servicoExecRoutes);

export default router;
