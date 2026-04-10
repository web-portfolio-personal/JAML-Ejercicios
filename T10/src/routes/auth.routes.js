import { Router } from 'express';
import User from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: true, message: 'name, email y password son requeridos' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: true, message: 'Email ya registrado' });
    }

    const hashed = await hashPassword(password);
    const user = await User.create({ name, email, password: hashed });
    const token = signToken(user._id);

    res.status(201).json({
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email }
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'email y password son requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: true, message: 'Contraseña incorrecta' });
    }

    const token = signToken(user._id);

    res.json({
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email }
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const { _id, name, email, createdAt } = req.user;
  res.json({ data: { id: _id, name, email, createdAt } });
});

export default router;
