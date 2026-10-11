# syntax=docker/dockerfile:1
#
# DiaInsights frontend (Next.js standalone).
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# NEXT_PUBLIC_API_URL must arrive as a build arg. Setting it in `docker compose up`
# at runtime does nothing. It must also be a URL the BROWSER can reach -- never the
# compose service name, which only resolves inside the docker network.

# ----------------------------------------------------------------- deps
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` installs exactly what the lockfile pins, unlike `npm install`.
RUN npm ci

# --------------------------------------------------------------- builder
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --------------------------------------------------------------- runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The node image already provides an unprivileged `node` user (uid 1000).
RUN groupmod --gid 1001 node && usermod --uid 1001 --gid 1001 node

# `output: "standalone"` puts a self-contained server plus only the traced
# dependencies in .next/standalone. Static assets and public/ are NOT in there and
# must be copied alongside it.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

# No curl in the slim image; use the node runtime we already ship.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["node", "server.js"]