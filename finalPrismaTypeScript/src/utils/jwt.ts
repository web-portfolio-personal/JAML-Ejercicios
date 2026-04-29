import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/index';

export interface JwtPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}

// jti único garantiza que tokens emitidos en el mismo segundo sean distintos
export const signAccessToken = (userId: string): string =>
  jwt.sign({ sub: userId, jti: randomUUID() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

// jti (JWT ID) único garantiza que tokens firmados en el mismo segundo sean distintos
export const signRefreshToken = (userId: string): string =>
  jwt.sign({ sub: userId, jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

export const verifyToken = (token: string, secret: string): JwtPayload | null => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
};
