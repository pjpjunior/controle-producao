import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../config/env';

export interface AuthenticatedUser {
  id: number;
  email: string;
  nome: string;
  funcoes: string[];
  ativo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const generateToken = (payload: AuthenticatedUser) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });

type AuthTokenPayload = JwtPayload & AuthenticatedUser & { funcao?: string };

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  const [, token] = authorization.split(' ');

  if (!token) {
    return res.status(401).json({ message: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    const funcoesToken =
      Array.isArray(decoded.funcoes) && decoded.funcoes.length > 0
        ? decoded.funcoes
        : decoded.funcao
          ? [decoded.funcao]
          : [];

    req.user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      funcoes: funcoesToken,
      ativo: typeof decoded.ativo === 'boolean' ? decoded.ativo : true
    };
    next();
  } catch (error) {
    console.error('Erro ao validar token', error);
    return res.status(401).json({ message: 'Token expirado ou inválido' });
  }
};
