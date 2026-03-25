# T8 - Documentación, Testing y Monitorización

Proyecto que integra Swagger, Jest y notificaciones a Slack.

## Características

- **Swagger**: Documentación interactiva en `/api-docs`
- **Jest + Supertest**: Tests automatizados
- **Slack Webhooks**: Notificación de errores en tiempo real

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm run dev
```

## Endpoints

### Documentación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api-docs` | Swagger UI |

### Auth
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registrar usuario |
| POST | `/api/auth/login` | No | Iniciar sesión |
| GET | `/api/auth/me` | Sí | Obtener perfil |

### Tracks
| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/api/tracks` | No | - | Listar tracks |
| GET | `/api/tracks/:id` | No | - | Obtener track |
| POST | `/api/tracks` | Sí | user/admin | Crear track |
| PUT | `/api/tracks/:id` | Sí | user/admin | Actualizar track |
| DELETE | `/api/tracks/:id` | Sí | admin | Eliminar track |

## Testing

```bash
# Ejecutar todos los tests
npm test

# Watch mode
npm run test:watch

# Cobertura
npm run test:coverage
```

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| PORT | Puerto del servidor (default: 3000) |
| DB_URI | URI de MongoDB |
| JWT_SECRET | Clave secreta para JWT |
| JWT_EXPIRES_IN | Expiración del token (default: 2h) |
| SLACK_WEBHOOK | URL del webhook de Slack |
