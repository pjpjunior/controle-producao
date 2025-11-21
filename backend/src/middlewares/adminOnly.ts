import { NextFunction, Request, Response } from 'express';

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  if (!req.user.funcoes.includes('admin')) {
    return res.status(403).json({ message: 'Acesso restrito para administradores' });
  }

  return next();
};

export default adminOnly;
