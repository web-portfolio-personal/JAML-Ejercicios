# BildyApp API — TypeScript + Prisma (Bonus T9 + T12)

Versión TypeScript + Prisma de la práctica final. Implementa exactamente las mismas funcionalidades que `final/` pero con **TypeScript strict mode** (T12) y **Prisma ORM** con soporte para **PostgreSQL** en producción y **SQLite** en desarrollo/tests (T9).

## Diferencias respecto a `final/`

| Aspecto | `final/` | `finalPrismaTypeScript/` |
|---------|---------|--------------------------|
| Lenguaje | JavaScript (ESM) | TypeScript strict mode |
| ORM | Mongoose 8 | Prisma 5 |
| Base de datos | MongoDB | SQLite (dev) / PostgreSQL (prod) |
| Modelos | `src/models/*.js` | `prisma/schema.prisma` |
| Tipos | — | Interfaces TypeScript + tipos Prisma |
| IDs | ObjectId (24 hex) | cuid (string) |
| Tests DB | mongodb-memory-server | SQLite file (prisma/test.db) |

## TypeScript (Bonus T12)

- `tsconfig.json` con `"strict": true`
- Tipos generados automáticamente por Prisma (`@prisma/client`)
- Módulo augmentation de Express (`src/types/express.d.ts`) para `req.user`
- Interfaces tipadas en todos los controllers y middleware
- `ts-jest` para transformar TypeScript en Jest

## Prisma (Bonus T9)

El schema define todos los modelos con relaciones explícitas:

```
Company ←── User ←── RefreshToken
    ↓         ↓
  Client   Project
    ↓  ↘   ↙  ↓
       DeliveryNote
```

**Para producción con PostgreSQL:** cambiar `provider = "sqlite"` a `"postgresql"` en `prisma/schema.prisma` y restaurar los tipos nativos (`Json?`, enums `Role`, `Status`, `NoteFormat`).

## Instalación

```bash
cd finalPrismaTypeScript
npm install
npx prisma generate
npx prisma db push          # crea SQLite dev.db
cp .env.example .env
# Edita .env con tus credenciales (JWT_SECRET mínimo 32 chars)
npm run dev
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor con tsx watch |
| `npm run build` | Compilar TypeScript → dist/ |
| `npm start` | Ejecutar dist/index.js |
| `npm run prisma:generate` | Regenerar cliente Prisma |
| `npm run prisma:migrate` | Crear migración (PostgreSQL) |
| `npm test` | Tests con Jest + ts-jest (SQLite) |

## Tests

```bash
npm test
```

- **70 tests** en 5 suites (auth, client, project, deliverynote, dashboard)
- Usa **SQLite en memoria** vía `file:./prisma/test.db`
- Limpieza completa entre tests con `prisma.deleteMany()`
- Sin dependencias externas — funciona en cualquier entorno

## Migración a PostgreSQL

```bash
# 1. Actualizar schema.prisma:
#    - provider = "postgresql"
#    - Restaurar campos Json? y enums Role/Status/NoteFormat
# 2. Actualizar DATABASE_URL en .env
# 3. Ejecutar migraciones:
npx prisma migrate dev --name init
```

## Tecnologías

- **TypeScript 5** — strict mode, moduleResolution bundler
- **Prisma 5** — ORM type-safe, migrations, SQLite/PostgreSQL
- **Express 5** — async/await automático
- **Socket.IO 4** — tiempo real con JWT auth
- **Zod** — validación de entradas y env vars
- **Jest + ts-jest + Supertest** — tests de integración
- **Cloudinary + Sharp** — almacenamiento de imágenes/PDF
- **pdfkit** — generación de PDF
- **Nodemailer** — envío de emails
