import User from '../models/user.model.js';
import { verifyToken } from '../utils/handleJwt.js';
import { handleHttpError } from '../utils/handleError.js';

const authMiddleware = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return handleHttpError(res, 'NOT_TOKEN', 401);
    }

    const token = req.headers.authorization.split(' ').pop();
    const dataToken = verifyToken(token);

    if (!dataToken || !dataToken.userId) {
      return handleHttpError(res, 'INVALID_TOKEN', 401);
    }

    const user = await User.findById(dataToken.userId);

    if (!user) {
      return handleHttpError(res, 'USER_NOT_FOUND', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    handleHttpError(res, 'NOT_SESSION', 401);
  }
};

export default authMiddleware;
