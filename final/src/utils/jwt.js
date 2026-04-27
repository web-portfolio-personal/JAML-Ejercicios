import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/index.js';

// jti único garantiza que tokens emitidos en el mismo segundo sean distintos
export const signAccessToken = (userId) =>
  jwt.sign({ _id: userId, jti: randomUUID() }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

// jti (JWT ID) único garantiza que tokens firmados en el mismo segundo sean distintos
export const signRefreshToken = (userId) =>
  jwt.sign({ _id: userId, jti: randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

export const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};
