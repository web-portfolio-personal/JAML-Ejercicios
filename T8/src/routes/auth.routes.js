import { Router } from 'express';
import {
  registerCtrl,
  loginCtrl,
  getMeCtrl,
  changePasswordCtrl
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema
} from '../validators/auth.validator.js';
import authMiddleware from '../middleware/session.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Registrar nuevo usuario
 *     description: Crea una cuenta de usuario y devuelve un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MiPassword123
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: user
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Error de validación o email duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', validate(registerSchema), registerCtrl);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Iniciar sesión
 *     description: Autentica un usuario y devuelve un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MiPassword123
 *     responses:
 *       201:
 *         description: Login exitoso, devuelve token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Contraseña incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validate(loginSchema), loginCtrl);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener usuario actual
 *     description: Devuelve los datos del usuario autenticado
 *     security:
 *       - BearerToken: []
 *     responses:
 *       200:
 *         description: Datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me', authMiddleware, getMeCtrl);

/**
 * @openapi
 * /api/auth/change-password:
 *   patch:
 *     tags:
 *       - Auth
 *     summary: Cambiar contraseña (BONUS)
 *     description: Cambia la contraseña del usuario autenticado
 *     security:
 *       - BearerToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: MiPassword123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NuevaPassword456
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       401:
 *         description: Contraseña actual incorrecta o no autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/change-password', authMiddleware, validate(changePasswordSchema), changePasswordCtrl);

export default router;
