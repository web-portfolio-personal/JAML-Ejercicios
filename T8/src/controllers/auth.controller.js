import User from '../models/user.model.js';
import { encrypt, compare } from '../utils/handlePassword.js';
import { tokenSign } from '../utils/handleJwt.js';
import { handleHttpError } from '../utils/handleError.js';
import { sendSlackNotification } from '../utils/handleLogger.js';

// POST /api/auth/register
export const registerCtrl = async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return handleHttpError(res, 'EMAIL_ALREADY_EXISTS', 400);
    }

    const password = await encrypt(req.body.password);
    const body = { ...req.body, password };

    const user = await User.create(body);
    user.set('password', undefined, { strict: false });

    // BONUS: Notificar a Slack si se registra un nuevo admin
    if (user.role === 'admin') {
      await sendSlackNotification(
        `👤 *Nuevo admin registrado*: ${user.name} (${user.email})`
      );
    }

    const data = {
      token: tokenSign(user),
      user
    };

    res.status(201).json(data);
  } catch (err) {
    handleHttpError(res, 'ERROR_REGISTER_USER');
  }
};

// POST /api/auth/login
export const loginCtrl = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return handleHttpError(res, 'USER_NOT_EXISTS', 404);
    }

    const checkPassword = await compare(password, user.password);

    if (!checkPassword) {
      return handleHttpError(res, 'INVALID_PASSWORD', 401);
    }

    user.set('password', undefined, { strict: false });

    res.status(201).json({
      token: tokenSign(user),
      user
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_LOGIN_USER');
  }
};

// GET /api/auth/me
export const getMeCtrl = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_ME');
  }
};

// PATCH /api/auth/change-password (BONUS)
export const changePasswordCtrl = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return handleHttpError(res, 'INVALID_CURRENT_PASSWORD', 401);
    }

    const hashedPassword = await encrypt(newPassword);
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    handleHttpError(res, 'ERROR_CHANGE_PASSWORD');
  }
};
