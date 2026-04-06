import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';

export const signAccessToken = (userId) =>
  jwt.sign({ _id: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const signRefreshToken = (userId) =>
  jwt.sign({ _id: userId }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

export const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};
