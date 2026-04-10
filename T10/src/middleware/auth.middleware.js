import { verifyToken } from '../utils/jwt.js';
import User from '../models/user.model.js';

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Token no proporcionado' });
  }

  const token = header.split(' ')[1];
  try {
    const { userId } = verifyToken(token);
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(401).json({ error: true, message: 'Usuario no encontrado' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: true, message: 'Token inválido o expirado' });
  }
};

export default authMiddleware;
