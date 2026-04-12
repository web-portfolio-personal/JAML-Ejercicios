# BildyApp API — Práctica Intermedia

API REST para la gestión de usuarios de BildyApp. Implementa registro, autenticación, onboarding y administración de cuentas con Node.js, Express 5 y MongoDB.

## Tecnologías

- **Node.js 22+** con ESM (`"type": "module"`)
- **Express 5** — async/await automático, sin try/catch en handlers
- **MongoDB Atlas** + **Mongoose 8** — virtuals, populate, indexes, soft delete
- **Zod** — validación con `.transform()`, `.refine()` y `discriminatedUnion`
- **JWT** — access token (15 min) + refresh token (7 días) con `jti` único
- **bcryptjs** — hash de contraseñas (10 rondas)
- **Multer** — subida de imágenes (logo, 5 MB máx., whitelist MIME)
- **Helmet** + **express-rate-limit** — seguridad y rate limiting
- **EventEmitter** — notificaciones del ciclo de vida del usuario

## Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales de MongoDB y JWT secrets
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor en desarrollo con `--watch` |
| `npm start` | Servidor en producción |
| `npm run test:server` | Servidor en modo test (rate limits desactivados) |
| `npm test` | Suite de tests de integración (requiere `test:server` activo) |

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno (`development`, `production`, `test`) | `development` |
| `PORT` | Puerto del servidor | `3000` |
| `MONGODB_URI` | URI de MongoDB Atlas | — |
| `JWT_SECRET` | Clave secreta access token (min. 32 chars) | — |
| `JWT_REFRESH_SECRET` | Clave secreta refresh token (min. 32 chars) | — |
| `JWT_EXPIRES_IN` | Duración access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token | `7d` |
| `PUBLIC_URL` | URL base pública para logos | `http://localhost:3000` |

## Endpoints

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/health` | — | — | Health check |
| `POST` | `/api/user/register` | — | — | Registro (devuelve tokens) |
| `PUT` | `/api/user/validation` | JWT | — | Verificar email con código de 6 dígitos |
| `POST` | `/api/user/login` | — | — | Login (devuelve tokens) |
| `PUT` | `/api/user/register` | JWT | — | Onboarding: datos personales |
| `PATCH` | `/api/user/company` | JWT | — | Onboarding: empresa o autónomo |
| `PATCH` | `/api/user/logo` | JWT | — | Subir logo de empresa (multipart/form-data) |
| `GET` | `/api/user` | JWT | — | Obtener usuario autenticado con empresa |
| `POST` | `/api/user/refresh` | — | — | Renovar access token |
| `POST` | `/api/user/logout` | JWT | — | Cerrar sesión |
| `DELETE` | `/api/user` | JWT | — | Eliminar usuario (`?soft=true` para soft delete) |
| `PUT` | `/api/user/password` | JWT | — | Cambiar contraseña (bonus) |
| `POST` | `/api/user/invite` | JWT | admin | Invitar compañero a la empresa (bonus) |

## Flujo de uso

```
1. POST /api/user/register          → guarda accessToken + refreshToken
2. (consulta el código en los logs del servidor)
3. PUT  /api/user/validation        → body: { code: "XXXXXX" }
4. PUT  /api/user/register          → body: { name, lastName, nif }
5. PATCH /api/user/company          → body: { isFreelance: false, name, cif, address }
                                      o    { isFreelance: true }
6. PATCH /api/user/logo             → multipart: campo "logo" (imagen)
7. GET  /api/user                   → usuario completo con Company populada
```

## Seguridad

- **Helmet** — cabeceras HTTP seguras
- **CORS** — habilitado globalmente
- **Rate limiting global** — 100 req / 15 min
- **Rate limiting auth** — 10 req / 15 min en `/register` y `/login`
- **Sanitización NoSQL** — elimina claves con `$` y `.` de `req.body` y `req.params`
- **JWT con `jti`** — cada refresh token incluye un UUID único; dos tokens firmados en el mismo segundo son siempre distintos

## EventEmitter — ciclo de vida del usuario

| Evento | Cuándo se emite |
|--------|-----------------|
| `user:registered` | Al registrar un nuevo usuario (muestra código en `development`) |
| `user:verified` | Al verificar el email con el código correcto |
| `user:invited` | Al invitar a un compañero desde una cuenta admin |
| `user:deleted` | Al eliminar un usuario (soft o hard) |

## Tests

```bash
# Terminal 1
npm run test:server

# Terminal 2
npm test
```

La suite cubre 78 tests en 16 grupos: todos los endpoints, happy path y casos de error, validaciones Zod, rotación de tokens, soft/hard delete, seguridad (NoSQL injection, Helmet, CORS, rate limiting) y verificaciones directas en MongoDB.

## Estructura del proyecto

```
bildyapp-api/
├── src/
│   ├── config/
│   │   └── index.js              # Validación de .env con Zod + dbConnect
│   ├── controllers/
│   │   └── user.controller.js    # Lógica de los 12 endpoints
│   ├── middleware/
│   │   ├── auth.middleware.js    # Verificación JWT → req.user
│   │   ├── error-handler.js      # Centraliza Mongoose, Multer y AppError
│   │   ├── role.middleware.js    # checkRole('admin')
│   │   ├── upload.js             # Multer: diskStorage, 5 MB, whitelist MIME
│   │   └── validate.js           # Zod: valida body/params/query
│   ├── models/
│   │   ├── User.js               # Virtual fullName, select:false, indexes
│   │   └── Company.js            # cif unique index, soft delete
│   ├── routes/
│   │   └── user.routes.js        # Rutas + authLimiter inline
│   ├── services/
│   │   └── notification.service.js  # EventEmitter con 4 listeners
│   ├── utils/
│   │   ├── AppError.js           # Clase con 7 métodos factoría
│   │   ├── jwt.js                # signAccessToken / signRefreshToken / verifyToken
│   │   └── password.js           # hashPassword / comparePassword
│   ├── validators/
│   │   └── user.validator.js     # Zod: transform, refine, discriminatedUnion
│   ├── app.js                    # Express: helmet, cors, sanitización, rate limit
│   └── index.js                  # Punto de entrada: dbConnect + listen
├── tests/
│   └── api.test.js               # 78 tests de integración (node:test + fetch)
├── uploads/                      # Logos subidos con Multer
├── .env
├── .env.example
├── .env.test
├── .gitignore
├── api.http
└── package.json
```
