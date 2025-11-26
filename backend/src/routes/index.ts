import { Router } from 'express';
import authRoutes from './authRoutes';
import pedidoRoutes from './pedidoRoutes';
import servicoExecRoutes from './servicoExecRoutes';
import catalogoServicosRoutes from './catalogoServicosRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/servicos', servicoExecRoutes);
router.use('/catalogo-servicos', catalogoServicosRoutes);

export default router;
