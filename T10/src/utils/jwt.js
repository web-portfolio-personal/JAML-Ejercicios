import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export const signToken = (userId) =>
  jwt.sign({ userId }, SECRET, { expiresIn: '2h' });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);
