import User from '../models/user.model.js';
import { encrypt, compare } from '../utils/handlePassword.js';
import { tokenSign } from '../utils/handleJwt.js';
import { handleHttpError } from '../utils/handleError.js';

// POST /api/auth/register
export const registerCtrl = async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return handleHttpError(res, 'EMAIL_ALREADY_EXISTS', 409);
    }

    const password = await encrypt(req.body.password);
    const body = { ...req.body, password };

    const user = await User.create(body);
    user.set('password', undefined, { strict: false });

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

    res.json({
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
    res.json(req.user);
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_ME');
  }
};
