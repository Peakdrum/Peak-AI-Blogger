# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js (standalone output).
# App connects to remote Supabase — no DB container needed.

# ---- base ----
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined at BUILD time, so pass as a build arg.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3020
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# DATABASE_URL is needed at BUILD time because ISR pages prerender against the
# database. This lives ONLY in the builder stage (discarded) — the final runner
# image receives DATABASE_URL at runtime via env_file, so no secret is baked in.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Public assets + standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
