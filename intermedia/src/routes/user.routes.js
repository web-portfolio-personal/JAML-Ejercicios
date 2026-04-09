import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRole from '../middleware/role.middleware.js';
import upload from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  codeSchema,
  loginSchema,
  personalSchema,
  companySchema,
  refreshSchema,
  passwordSchema,
  inviteSchema,
} from '../validators/user.validator.js';

const router = Router();

// ── Auth pública ─────────────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', validate(refreshSchema), ctrl.refresh);

// ── Verificación de email ────────────────────────────────────────────────────
router.put('/validation', authMiddleware, validate(codeSchema), ctrl.validateEmail);

// ── Onboarding ───────────────────────────────────────────────────────────────
router.put('/register', authMiddleware, validate(personalSchema), ctrl.updatePersonal);
router.patch('/company', authMiddleware, validate(companySchema), ctrl.updateCompany);
router.patch('/logo', authMiddleware, upload.single('logo'), ctrl.uploadLogo);

// ── Usuario autenticado ───────────────────────────────────────────────────────
router.get('/', authMiddleware, ctrl.getUser);
router.post('/logout', authMiddleware, ctrl.logout);
router.delete('/', authMiddleware, ctrl.deleteUser);

// ── Bonus ────────────────────────────────────────────────────────────────────
router.put('/password', authMiddleware, validate(passwordSchema), ctrl.changePassword);
router.post('/invite', authMiddleware, checkRole('admin'), validate(inviteSchema), ctrl.inviteUser);

export default router;
