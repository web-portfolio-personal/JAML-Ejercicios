import { handleHttpError } from '../utils/handleError.js';

const checkRol = (roles) => (req, res, next) => {
  try {
    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    next();
  } catch (err) {
    handleHttpError(res, 'ERROR_PERMISSIONS', 403);
  }
};

export default checkRol;
