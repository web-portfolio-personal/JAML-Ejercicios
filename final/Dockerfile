# === Stage 1: Instalar dependencias ===
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# === Stage 2: Imagen de producción ===
FROM node:22-alpine AS runner
WORKDIR /app

# Usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodeapp

# Copiar node_modules y código fuente
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs . .

# Crear directorio de uploads con permisos
RUN mkdir -p uploads && chown nodeapp:nodejs uploads

USER nodeapp

ENV NODE_ENV=production
EXPOSE 3000

# Verifica que el servidor responde y que MongoDB está conectado.
# Parsea el JSON del /health y falla si db !== 'connected'.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"db":"connected"' || exit 1

CMD ["node", "src/index.js"]
