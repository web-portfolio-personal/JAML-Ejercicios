# === Stage 1: Instalar deps, generar Prisma Client y limpiar devDeps ===
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODO (incluye prisma CLI) → generar cliente → eliminar devDeps
RUN npm ci && \
    npx prisma generate && \
    npm prune --omit=dev

# === Stage 2: Imagen de producción ===
FROM node:22-alpine AS runner
WORKDIR /app

# Crear usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodeapp

# Copiar node_modules ya podados y el código fuente
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs . .

USER nodeapp

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
