import prisma from '../config/prisma.js';
import { encrypt, compare } from '../utils/handlePassword.js';
import { tokenSign } from '../utils/handleJwt.js';
import { handleHttpError } from '../utils/handleError.js';

export const registerCtrl = async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return handleHttpError(res, 'EMAIL_ALREADY_EXISTS', 400);
    }

    const hashedPassword = await encrypt(password);

    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: role || 'USER' },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
    });

    res.status(201).json({
      token: tokenSign(user),
      user
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_REGISTER_USER');
  }
};

export const loginCtrl = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return handleHttpError(res, 'USER_NOT_EXISTS', 404);
    }

    const valid = await compare(password, user.password);
    if (!valid) {
      return handleHttpError(res, 'INVALID_PASSWORD', 401);
    }

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      token: tokenSign(user),
      user: userWithoutPassword
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_LOGIN_USER');
  }
};

export const getMeCtrl = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_ME');
  }
};
