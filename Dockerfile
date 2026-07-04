# Production image for Wovi Reserve (#4). Multi-stage build → Next.js standalone
# server. Mount a persistent volume at /data and set WOVI_DB_PATH=/data/wovi.db so
# the SQLite database and uploads survive restarts/redeploys.
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ---- deps: install with native build toolchain for better-sqlite3 ----
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV WOVI_DB_PATH=/data/wovi.db
ENV WOVI_UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

# Next standalone output + static assets + the schema file the app reads at runtime.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/lib/schema.sql ./lib/schema.sql
# better-sqlite3's native binding travels with the traced node_modules.

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+ (process.env.PORT||3000) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
