# === Stage 1: Instalar dependencias y generar Prisma Client ===
FROM node:22-alpine AS deps
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar solo dependencias de producción y generar el cliente Prisma
RUN npm ci --only=production && npx prisma generate

# === Stage 2: Imagen de producción ===
FROM node:22-alpine AS runner
WORKDIR /app

# Crear usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodeapp

# Copiar dependencias generadas desde el stage anterior
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs . .

USER nodeapp

ENV NODE_ENV=production
EXPOSE 3000

# En producción no usamos --env-file (las vars las inyecta la plataforma)
CMD ["node", "src/index.js"]
