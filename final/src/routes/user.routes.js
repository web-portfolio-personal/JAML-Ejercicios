import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

// Rate limiting estricto para endpoints de autenticación (10 req / 15 min; sin límite en test)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Demasiados intentos de autenticación, inténtalo más tarde' },
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación y gestión de usuarios
 */

/**
 * @swagger
 * /api/user/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar un nuevo usuario
 *     description: |
 *       Crea un usuario con estado "pending". Envía un código de verificación por email.
 *       La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 8, example: "Admin123!" }
 *     responses:
 *       201:
 *         description: Usuario registrado. Se envía email de verificación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Error de validación
 *       409:
 *         description: Email ya registrado
 */
router.post('/register', authLimiter, validate(registerSchema), ctrl.register);

/**
 * @swagger
 * /api/user/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login correcto. Devuelve accessToken y refreshToken.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);

/**
 * @swagger
 * /api/user/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token con refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Nuevos accessToken y refreshToken (rotation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', validate(refreshSchema), ctrl.refresh);

/**
 * @swagger
 * /api/user/validation:
 *   put:
 *     tags: [Auth]
 *     summary: Verificar email con código de 6 dígitos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, pattern: '^[0-9]{6}$', example: "123456" }
 *     responses:
 *       200:
 *         description: Email verificado correctamente
 *       400:
 *         description: Código incorrecto o expirado
 */
router.put('/validation', authMiddleware, validate(codeSchema), ctrl.validateEmail);

/**
 * @swagger
 * /api/user/register:
 *   put:
 *     tags: [Auth]
 *     summary: Completar perfil personal (onboarding — paso 1)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:     { type: string }
 *               lastName: { type: string }
 *               nif:      { type: string }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.put('/register', authMiddleware, validate(personalSchema), ctrl.updatePersonal);

/**
 * @swagger
 * /api/user/company:
 *   patch:
 *     tags: [Auth]
 *     summary: Registrar o actualizar la compañía del usuario (onboarding — paso 2)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cif]
 *             properties:
 *               name:        { type: string }
 *               cif:         { type: string }
 *               isFreelance: { type: boolean }
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Compañía creada/actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       409:
 *         description: CIF ya registrado
 */
router.patch('/company', authMiddleware, validate(companySchema), ctrl.updateCompany);

/**
 * @swagger
 * /api/user/logo:
 *   patch:
 *     tags: [Auth]
 *     summary: Subir logo del usuario a Cloudinary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [logo]
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Imagen de perfil (jpg/png/webp, máx 5 MB)
 *     responses:
 *       200:
 *         description: Logo subido. Devuelve URL de Cloudinary.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logoUrl: { type: string, format: uri }
 */
router.patch('/logo', authMiddleware, upload.single('logo'), ctrl.uploadLogo);

/**
 * @swagger
 * /api/user:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener datos del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario con compañía si existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: No autenticado
 */
router.get('/', authMiddleware, ctrl.getUser);

/**
 * @swagger
 * /api/user/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión (invalida el refresh token)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 */
router.post('/logout', authMiddleware, ctrl.logout);

/**
 * @swagger
 * /api/user:
 *   delete:
 *     tags: [Auth]
 *     summary: Eliminar cuenta del usuario autenticado (soft delete)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuenta eliminada correctamente
 *       401:
 *         description: No autenticado
 */
router.delete('/', authMiddleware, ctrl.deleteUser);

/**
 * @swagger
 * /api/user/password:
 *   put:
 *     tags: [Auth]
 *     summary: Cambiar contraseña del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8, example: "NewPass123!" }
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Contraseña actual incorrecta o nueva inválida
 */
router.put('/password', authMiddleware, validate(passwordSchema), ctrl.changePassword);

/**
 * @swagger
 * /api/user/invite:
 *   post:
 *     tags: [Auth]
 *     summary: Invitar un usuario a la compañía (solo admin verificado)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       201:
 *         description: Invitación enviada. Devuelve credenciales temporales.
 *       400:
 *         description: Email inválido o admin no verificado
 *       403:
 *         description: Solo admins pueden invitar usuarios
 *       409:
 *         description: El email ya está registrado en la plataforma
 */
router.post('/invite', authMiddleware, checkRole('admin'), validate(inviteSchema), ctrl.inviteUser);

export default router;
