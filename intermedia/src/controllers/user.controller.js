import User from '../models/User.js';
import Company from '../models/Company.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import userEvents from '../services/notification.service.js';
import { env } from '../config/index.js';

// ── Helper: generar código de 6 dígitos ─────────────────────────────────────

const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ── 1. Registro — POST /api/user/register ────────────────────────────────────

export const register = async (req, res, next) => {
  const { email, password } = req.body;

  // Solo bloquear si ya existe un usuario verificado con ese email
  const existing = await User.findOne({ email, deleted: false });
  if (existing) {
    return next(AppError.conflict('Ya existe una cuenta con ese email'));
  }

  const hashedPw = await hashPassword(password);
  const verificationCode = generateCode();

  const user = await User.create({
    email,
    password: hashedPw,
    verificationCode,
    verificationAttempts: 3,
    role: 'admin',
    status: 'pending',
  });

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  await User.findByIdAndUpdate(user._id, { refreshToken });

  userEvents.emit('user:registered', { email: user.email, verificationCode });

  res.status(201).json({
    user: { email: user.email, status: user.status, role: user.role },
    accessToken,
    refreshToken,
  });
};

// ── 2. Validación del email — PUT /api/user/validation ────────────────────────

export const validateEmail = async (req, res, next) => {
  const { code } = req.body;

  const user = await User.findById(req.user._id).select(
    '+verificationCode +verificationAttempts'
  );

  if (user.status === 'verified') {
    return next(AppError.badRequest('El email ya ha sido verificado'));
  }

  if (user.verificationAttempts <= 0) {
    return next(AppError.tooManyRequests('Se han agotado los intentos de verificación'));
  }

  if (user.verificationCode !== code) {
    user.verificationAttempts -= 1;
    await user.save();

    if (user.verificationAttempts <= 0) {
      return next(AppError.tooManyRequests('Se han agotado los intentos de verificación'));
    }

    return next(
      AppError.badRequest(
        `Código incorrecto. Intentos restantes: ${user.verificationAttempts}`
      )
    );
  }

  user.status = 'verified';
  user.verificationCode = undefined;
  await user.save();

  userEvents.emit('user:verified', user);

  res.json({ message: 'Email verificado correctamente' });
};

// ── 3. Login — POST /api/user/login ──────────────────────────────────────────

export const login = async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, deleted: false }).select(
    '+password +refreshToken'
  );

  if (!user) {
    return next(AppError.unauthorized('Credenciales incorrectas'));
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return next(AppError.unauthorized('Credenciales incorrectas'));
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  // Devolver usuario sin campos sensibles
  const safeUser = user.toJSON();
  delete safeUser.password;
  delete safeUser.refreshToken;
  delete safeUser.verificationCode;
  delete safeUser.verificationAttempts;

  res.json({ user: safeUser, accessToken, refreshToken });
};

// ── 4. Onboarding — datos personales — PUT /api/user/register ────────────────

export const updatePersonal = async (req, res) => {
  const { name, lastName, nif } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, lastName, nif },
    { new: true, runValidators: true }
  ).populate('company');

  res.json({ user });
};

// ── 5. Onboarding — compañía — PATCH /api/user/company ───────────────────────

export const updateCompany = async (req, res) => {
  const currentUser = await User.findById(req.user._id);

  let companyData;

  if (req.body.isFreelance === true) {
    // Usar datos personales del usuario
    companyData = {
      name: currentUser.name,
      cif: currentUser.nif,
      address: currentUser.address,
      isFreelance: true,
    };
  } else {
    companyData = {
      name: req.body.name,
      cif: req.body.cif,
      address: req.body.address,
      isFreelance: false,
    };
  }

  if (!companyData.cif) {
    throw AppError.badRequest('CIF no disponible. Completa primero los datos personales');
  }

  // Buscar si ya existe una empresa con ese CIF
  const existingCompany = await Company.findOne({
    cif: companyData.cif,
    deleted: false,
  });

  let company;

  if (existingCompany) {
    // Unirse a la empresa existente como guest
    company = existingCompany;
    currentUser.role = 'guest';
  } else {
    // Crear nueva empresa; el usuario es owner con role admin
    company = await Company.create({
      ...companyData,
      owner: currentUser._id,
    });
  }

  currentUser.company = company._id;
  await currentUser.save();

  const updatedUser = await User.findById(currentUser._id).populate('company');

  res.json({ user: updatedUser });
};

// ── 6. Logo de la compañía — PATCH /api/user/logo ───────────────────────────

export const uploadLogo = async (req, res, next) => {
  if (!req.user.company) {
    return next(
      AppError.badRequest('Completa el onboarding de empresa antes de subir el logo')
    );
  }

  if (!req.file) {
    return next(AppError.badRequest('No se ha subido ningún archivo'));
  }

  const logoUrl = `${env.PUBLIC_URL}/uploads/${req.file.filename}`;

  const company = await Company.findByIdAndUpdate(
    req.user.company,
    { logo: logoUrl },
    { new: true }
  );

  res.json({ company });
};

// ── 7. Obtener usuario — GET /api/user ───────────────────────────────────────

export const getUser = async (req, res) => {
  const user = await User.findById(req.user._id).populate('company');
  res.json({ user });
};

// ── 8a. Refresh token — POST /api/user/refresh ───────────────────────────────

export const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;

  const payload = verifyToken(refreshToken, env.JWT_REFRESH_SECRET);
  if (!payload) {
    return next(AppError.unauthorized('Refresh token inválido o expirado'));
  }

  const user = await User.findOne({
    _id: payload._id,
    deleted: false,
  }).select('+refreshToken');

  if (!user || user.refreshToken !== refreshToken) {
    return next(AppError.unauthorized('Refresh token inválido'));
  }

  const newAccessToken = signAccessToken(user._id);
  const newRefreshToken = signRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save();

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};

// ── 8b. Logout — POST /api/user/logout ───────────────────────────────────────

export const logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  res.json({ message: 'Sesión cerrada correctamente' });
};

// ── 9. Eliminar usuario — DELETE /api/user ───────────────────────────────────

export const deleteUser = async (req, res) => {
  const soft = req.query.soft === 'true';

  userEvents.emit('user:deleted', req.user);

  if (soft) {
    await User.findByIdAndUpdate(req.user._id, {
      deleted: true,
      deletedAt: new Date(),
      refreshToken: null,
    });
    return res.json({ message: 'Usuario eliminado (soft delete)' });
  }

  await User.findByIdAndDelete(req.user._id);
  res.json({ message: 'Usuario eliminado permanentemente' });
};

// ── BONUS: Cambiar contraseña — PUT /api/user/password ───────────────────────

export const changePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const valid = await comparePassword(oldPassword, user.password);
  if (!valid) {
    return next(AppError.unauthorized('Contraseña actual incorrecta'));
  }

  user.password = await hashPassword(newPassword);
  await user.save();

  res.json({ message: 'Contraseña actualizada correctamente' });
};

// ── 10. Invitar compañero — POST /api/user/invite ────────────────────────────

export const inviteUser = async (req, res, next) => {
  const { email, name, lastName } = req.body;

  if (!req.user.company) {
    return next(
      AppError.badRequest('Debes pertenecer a una empresa para invitar compañeros')
    );
  }

  const existing = await User.findOne({ email, deleted: false });
  if (existing) {
    return next(AppError.conflict('Ya existe una cuenta con ese email'));
  }

  // Contraseña temporal (el invitado deberá cambiarla)
  const tempPw = Math.random().toString(36).slice(-10);
  const hashedPw = await hashPassword(tempPw);
  const verificationCode = generateCode();

  const invited = await User.create({
    email,
    name,
    lastName,
    password: hashedPw,
    verificationCode,
    verificationAttempts: 3,
    role: 'guest',
    status: 'pending',
    company: req.user.company,
  });

  userEvents.emit('user:invited', invited);

  res.status(201).json({
    message: 'Usuario invitado correctamente',
    user: { email: invited.email, status: invited.status, role: invited.role },
  });
};
