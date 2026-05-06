# BildyApp API — Práctica Final

API REST completa para la gestión de albaranes digitales de BildyApp. Implementa autenticación JWT, gestión de clientes, proyectos y albaranes con firma digital, generación de PDF, almacenamiento en Cloudinary, notificaciones en tiempo real con Socket.IO, dashboard con aggregation pipeline y Docker.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Runtime | **Node.js 22+** ESM (`"type": "module"`) |
| Framework | **Express 5** — async/await automático |
| Base de datos | **MongoDB Atlas** + **Mongoose 8** |
| Validación | **Zod** — transform, refine, discriminatedUnion |
| Auth | **JWT** — access (15 min) + refresh (7 días) con `jti` único |
| Passwords | **bcryptjs** — hash 10 rondas, complejidad validada |
| Archivos locales | **Multer** — diskStorage + memoryStorage |
| Almacenamiento cloud | **Cloudinary v2** + **Sharp** (resize 800px, WebP) |
| PDF | **pdfkit** — generación en memoria (Buffer) |
| Email | **Nodemailer** — verificación e invitaciones |
| Tiempo real | **Socket.IO 4** — JWT auth + rooms por empresa |
| Swagger | **swagger-jsdoc** + **swagger-ui-express** — OpenAPI 3.0 |
| Seguridad | **Helmet** + **express-rate-limit** + sanitización NoSQL |
| Logging | **Morgan** + **Slack Webhook** (errores 5XX) |
| Tests | **Jest** + **Supertest** + **mongodb-memory-server** |
| Contenedores | **Docker** (multi-stage) + **docker-compose** |
| CI | **GitHub Actions** |

## Instalación

```bash
cd final
npm install
cp .env.example .env
# Edita .env con tus credenciales
npm run dev
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor en desarrollo con `--watch` |
| `npm start` | Servidor en producción |
| `npm test` | Suite de tests con Jest (mongodb-memory-server) |

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | Puerto del servidor (default: `3000`) |
| `MONGODB_URI` | URI de MongoDB Atlas |
| `JWT_SECRET` | Clave access token (min. 32 chars) |
| `JWT_REFRESH_SECRET` | Clave refresh token (min. 32 chars) |
| `JWT_EXPIRES_IN` | Duración access token (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token (default: `7d`) |
| `PUBLIC_URL` | URL base pública |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `MAIL_HOST` | Host SMTP |
| `MAIL_PORT` | Puerto SMTP |
| `MAIL_USER` | Usuario SMTP |
| `MAIL_PASS` | Contraseña SMTP / App Password |
| `MAIL_FROM` | Remitente de los emails |
| `SLACK_WEBHOOK_URL` | Webhook de Slack para errores 5XX |

## Endpoints

### Usuarios (`/api/user`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/health` | — | — | Health check con estado DB |
| `POST` | `/api/user/register` | — | — | Registro (devuelve tokens) |
| `PUT` | `/api/user/validation` | JWT | — | Verificar email |
| `POST` | `/api/user/login` | — | — | Login (devuelve tokens) |
| `PUT` | `/api/user/register` | JWT | — | Onboarding: datos personales |
| `PATCH` | `/api/user/company` | JWT | — | Onboarding: empresa o autónomo |
| `PATCH` | `/api/user/logo` | JWT | — | Subir logo (multipart/form-data) |
| `GET` | `/api/user` | JWT | — | Obtener usuario con empresa |
| `POST` | `/api/user/refresh` | — | — | Renovar access token |
| `POST` | `/api/user/logout` | JWT | — | Cerrar sesión |
| `DELETE` | `/api/user` | JWT | — | Eliminar usuario (`?soft=true`) |
| `PUT` | `/api/user/password` | JWT | — | Cambiar contraseña |
| `POST` | `/api/user/invite` | JWT | admin | Invitar compañero |

### Clientes (`/api/client`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/client` | JWT | Crear cliente |
| `GET` | `/api/client` | JWT | Listar clientes (`?page`, `?limit`, `?search`) |
| `GET` | `/api/client/:id` | JWT | Obtener cliente |
| `PUT` | `/api/client/:id` | JWT | Actualizar cliente |
| `DELETE` | `/api/client/:id` | JWT | Archivar cliente (soft delete) |
| `PATCH` | `/api/client/:id/restore` | JWT | Restaurar cliente archivado |

### Proyectos (`/api/project`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/project` | JWT | Crear proyecto |
| `GET` | `/api/project` | JWT | Listar proyectos (`?page`, `?limit`, `?search`) |
| `GET` | `/api/project/:id` | JWT | Obtener proyecto |
| `PUT` | `/api/project/:id` | JWT | Actualizar proyecto |
| `DELETE` | `/api/project/:id` | JWT | Archivar proyecto (soft delete) |
| `PATCH` | `/api/project/:id/restore` | JWT | Restaurar proyecto archivado |

### Albaranes (`/api/deliverynote`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/deliverynote` | JWT | Crear albarán (formato `hours` o `material`) |
| `GET` | `/api/deliverynote` | JWT | Listar albaranes (`?page`, `?limit`, `?format`, `?project`, `?client`) |
| `GET` | `/api/deliverynote/:id` | JWT | Obtener albarán con datos populados |
| `GET` | `/api/deliverynote/pdf/:id` | JWT | Descargar PDF del albarán |
| `PATCH` | `/api/deliverynote/:id/sign` | JWT | Firmar albarán (multipart: campo `signature`) |
| `DELETE` | `/api/deliverynote/:id` | JWT | Eliminar albarán (solo si no está firmado) |

### Dashboard (`/api/dashboard`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/dashboard` | JWT | Estadísticas globales de la compañía |

Respuesta del dashboard:
```json
{
  "summary": {
    "totalNotes": 42,
    "signedNotes": 30,
    "unsignedNotes": 12,
    "hourNotes": 25,
    "materialNotes": 17,
    "totalProjects": 8,
    "totalClients": 5
  },
  "notesByMonth": [...],
  "hoursByProject": [...],
  "materialsByClient": [...]
}
```

## Swagger / OpenAPI

Documentación interactiva disponible en: `http://localhost:3000/api-docs`

## Socket.IO

El servidor expone un namespace por defecto con autenticación JWT:

```js
const socket = io('http://localhost:3000', {
  auth: { token: '<access_token>' }
});

// Al conectar, el socket entra automáticamente en la sala de su empresa
socket.on('client:new',       (client) => { /* nuevo cliente creado */ });
socket.on('project:new',      (project) => { /* nuevo proyecto creado */ });
socket.on('deliverynote:new', (note) => { /* nuevo albarán creado */ });
socket.on('deliverynote:signed', (note) => { /* albarán firmado */ });
```

## Seguridad

- **Helmet** — cabeceras HTTP seguras
- **CORS** — habilitado globalmente
- **Rate limiting global** — 100 req / 15 min
- **Rate limiting auth** — 10 req / 15 min en `/register` y `/login`
- **Sanitización NoSQL** — elimina claves con `$` y `.` de `req.body` y `req.params`
- **Complejidad de contraseña** — mayúscula, minúscula, número y símbolo
- **Invitaciones verificadas** — solo admins con cuenta verificada pueden invitar
- **JWT con `jti`** — tokens únicos incluso emitidos en el mismo segundo

## Docker

```bash
# Construir imagen
docker build -t bildyapp-api .

# Ejecutar con docker-compose (API + MongoDB)
docker-compose up -d

# Ver logs
docker-compose logs -f api
```

## Tests

```bash
npm test
```

La suite incluye **70+ tests** en 5 archivos organizados por dominio:

| Archivo | Cobertura |
|---------|-----------|
| `auth.test.js` | Registro, login, onboarding, JWT, roles |
| `client.test.js` | CRUD completo de clientes |
| `project.test.js` | CRUD completo de proyectos |
| `deliverynote.test.js` | Albaranes, PDF, firma |
| `dashboard.test.js` | Aggregation pipeline |

Cada suite usa `mongodb-memory-server` para aislamiento total — sin dependencia de MongoDB Atlas.

## Estructura del proyecto

```
final/
├── src/
│   ├── config/
│   │   ├── index.js              # Validación de .env con Zod + dbConnect
│   │   └── swagger.js            # Spec OpenAPI 3.0
│   ├── controllers/
│   │   ├── user.controller.js    # Auth, onboarding, perfil
│   │   ├── client.controller.js  # CRUD clientes
│   │   ├── project.controller.js # CRUD proyectos
│   │   ├── deliverynote.controller.js  # Albaranes + PDF + firma
│   │   └── dashboard.controller.js     # Aggregation pipeline
│   ├── middleware/
│   │   ├── auth.middleware.js    # Verificación JWT → req.user
│   │   ├── error-handler.js      # Centraliza Mongoose, Multer, AppError y Slack
│   │   ├── role.middleware.js    # checkRole('admin')
│   │   ├── upload.js             # Multer: disk + memory storage
│   │   └── validate.js           # Zod: valida body/params/query
│   ├── models/
│   │   ├── User.js               # Virtual fullName, indexes, soft delete
│   │   ├── Company.js            # cif unique, soft delete
│   │   ├── Client.js             # cif por empresa, soft delete
│   │   ├── Project.js            # projectCode por empresa, soft delete
│   │   └── DeliveryNote.js       # Albarán: hours/material, firma, PDF
│   ├── routes/
│   │   ├── index.js              # Router principal
│   │   ├── user.routes.js        # Rutas de usuario con Swagger JSDoc
│   │   ├── client.routes.js      # Rutas de clientes
│   │   ├── project.routes.js     # Rutas de proyectos
│   │   ├── deliverynote.routes.js # Rutas de albaranes
│   │   └── dashboard.routes.js   # Ruta del dashboard
│   ├── services/
│   │   ├── notification.service.js  # EventEmitter con 4 listeners
│   │   ├── mail.service.js          # Nodemailer
│   │   ├── storage.service.js       # Cloudinary + Sharp
│   │   ├── pdf.service.js           # pdfkit
│   │   └── logger.service.js        # Slack Webhook para 5XX
│   ├── utils/
│   │   ├── AppError.js           # Clase con 7 métodos factoría
│   │   ├── jwt.js                # signAccessToken / signRefreshToken / verifyToken
│   │   └── password.js           # hashPassword / comparePassword
│   ├── validators/
│   │   └── user.validator.js     # Zod schemas con complejidad de contraseña
│   ├── app.js                    # Express + Socket.IO + Swagger
│   └── index.js                  # Punto de entrada + graceful shutdown
├── tests/
│   ├── helpers/
│   │   └── db.helper.js          # connectTestDb / clearDb / disconnectTestDb
│   ├── jest.setup.js             # Env vars para Jest ESM
│   ├── auth.test.js
│   ├── client.test.js
│   ├── project.test.js
│   ├── deliverynote.test.js
│   └── dashboard.test.js
├── uploads/                      # Logos subidos con Multer
├── .env.example
├── .gitignore
├── api.http                      # REST Client para VS Code
├── docker-compose.yml
├── Dockerfile
└── package.json
```
