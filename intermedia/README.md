# BildyApp API — Práctica Intermedia

API REST para la gestión de usuarios de BildyApp. Implementa registro, autenticación, onboarding y administración de cuentas con Node.js, Express 5 y MongoDB.

## Tecnologías

- **Node.js 22+** con ESM (`"type": "module"`)
- **Express 5** — async/await automático
- **MongoDB Atlas** + **Mongoose 8**
- **Zod** — validación con `.transform()`, `.refine()` y `discriminatedUnion`
- **JWT** — access token (15 min) + refresh token (7 días)
- **bcryptjs** — hash de contraseñas
- **Multer** — subida de imágenes (logo)
- **Helmet** + **express-rate-limit** + **express-mongo-sanitize** — seguridad

## Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales de MongoDB y JWT secrets
npm run dev
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default: 3000) |
| `MONGODB_URI` | URI de MongoDB Atlas |
| `JWT_SECRET` | Clave secreta access token (min. 32 chars) |
| `JWT_REFRESH_SECRET` | Clave secreta refresh token (min. 32 chars) |
| `JWT_EXPIRES_IN` | Duración access token (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token (default: `7d`) |
| `PUBLIC_URL` | URL base para logos (default: `http://localhost:3000`) |

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/user/register` | — | Registro (devuelve tokens) |
| `PUT` | `/api/user/validation` | ✅ | Verificar email con código |
| `POST` | `/api/user/login` | — | Login (devuelve tokens) |
| `PUT` | `/api/user/register` | ✅ | Onboarding: datos personales |
| `PATCH` | `/api/user/company` | ✅ | Onboarding: empresa o autónomo |
| `PATCH` | `/api/user/logo` | ✅ | Subir logo de empresa (multipart) |
| `GET` | `/api/user` | ✅ | Obtener usuario con empresa |
| `POST` | `/api/user/refresh` | — | Renovar access token |
| `POST` | `/api/user/logout` | ✅ | Cerrar sesión |
| `DELETE` | `/api/user?soft=true` | ✅ | Eliminar usuario (hard o soft) |
| `PUT` | `/api/user/password` | ✅ | Cambiar contraseña (bonus) |
| `POST` | `/api/user/invite` | ✅ admin | Invitar compañero a la empresa |

## Flujo de uso

1. `POST /register` → guarda **accessToken** y **refreshToken**
2. Consulta el código de verificación en los logs del servidor (o en MongoDB)
3. `PUT /validation` con el código de 6 dígitos
4. `PUT /register` (PUT) → nombre, apellidos, NIF
5. `PATCH /company` → datos de empresa o `isFreelance: true`
6. `PATCH /logo` → imagen en campo `logo` (multipart/form-data)
7. `GET /` → usuario completo con populate de Company

## EventEmitter (eventos de ciclo de vida)

El servidor emite los siguientes eventos por consola:

| Evento | Cuándo |
|--------|--------|
| `user:registered` | Al registrar un usuario (incluye código) |
| `user:verified` | Al verificar el email |
| `user:invited` | Al invitar a un compañero |
| `user:deleted` | Al eliminar un usuario |
